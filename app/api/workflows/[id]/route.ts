/**
 * Admin 앱 - 워크플로우 상세 API
 * GET: 워크플로우 상세 조회
 * PATCH: 워크플로우 상태 업데이트
 * DELETE: 워크플로우 삭제
 */

import { NextRequest, NextResponse } from "next/server";
import { prisma, WorkflowStatus } from "@polarad/database";
import { requireAdmin } from "@/lib/auth";
import { logStateChange, logDesignUpload } from "@/lib/notification/slackClient";
import { sendTelegramMessage, NotificationTemplates } from "@/lib/notification/telegramClient";

// 워크플로우 타입 한글 레이블
const WORKFLOW_TYPE_LABELS: Record<string, string> = {
  NAMECARD: "명함",
  NAMETAG: "명찰",
  CONTRACT: "계약서",
  ENVELOPE: "봉투",
  WEBSITE: "웹사이트",
  BLOG: "블로그",
  META_ADS: "메타 광고",
  NAVER_ADS: "네이버 광고",
};

// 워크플로우 상태 한글 레이블
const WORKFLOW_STATUS_LABELS: Record<string, string> = {
  PENDING: "대기",
  SUBMITTED: "접수됨",
  IN_PROGRESS: "제작 중",
  DESIGN_UPLOADED: "디자인 완료",
  ORDER_REQUESTED: "주문 요청",
  ORDER_APPROVED: "주문 승인",
  COMPLETED: "완료",
  SHIPPED: "배송됨",
  CANCELLED: "취소됨",
};

interface RouteParams {
  params: Promise<{ id: string }>;
}

// GET: 워크플로우 상세 조회
export async function GET(request: NextRequest, { params }: RouteParams) {
  try {
    await requireAdmin();
    const { id } = await params;

    const workflow = await prisma.workflow.findUnique({
      where: { id },
      include: {
        user: {
          select: {
            id: true,
            clientName: true,
            name: true,
            email: true,
            phone: true,
          },
        },
        logs: {
          orderBy: { createdAt: "desc" },
        },
      },
    });

    if (!workflow) {
      return NextResponse.json(
        { error: "워크플로우를 찾을 수 없습니다" },
        { status: 404 }
      );
    }

    return NextResponse.json({
      success: true,
      data: workflow,
    });
  } catch (error) {
    if (error instanceof Error && error.message === "UNAUTHORIZED") {
      return NextResponse.json({ error: "인증이 필요합니다" }, { status: 401 });
    }
    console.error("[Admin API] GET /api/workflows/[id] error:", error);
    return NextResponse.json(
      { error: "워크플로우 조회 중 오류가 발생했습니다" },
      { status: 500 }
    );
  }
}

// PATCH: 워크플로우 상태 업데이트
export async function PATCH(request: NextRequest, { params }: RouteParams) {
  try {
    await requireAdmin();
    const { id } = await params;
    const body = await request.json();

    const {
      status,
      designUrl,
      finalUrl,
      courier,
      trackingNumber,
      revisionNote,
      adminNote,
      changedBy,
    } = body;

    // 워크플로우 존재 확인
    const existingWorkflow = await prisma.workflow.findUnique({
      where: { id },
    });

    if (!existingWorkflow) {
      return NextResponse.json(
        { error: "워크플로우를 찾을 수 없습니다" },
        { status: 404 }
      );
    }

    // 상태 변경 시 타임스탬프 업데이트
    const updateData: Record<string, unknown> = {};
    const now = new Date();

    if (status && status !== existingWorkflow.status) {
      updateData.status = status;

      // 상태별 타임스탬프 설정
      switch (status as WorkflowStatus) {
        case "SUBMITTED":
          updateData.submittedAt = now;
          break;
        case "IN_PROGRESS":
          updateData.designStartedAt = now;
          break;
        case "DESIGN_UPLOADED":
          updateData.designUploadedAt = now;
          break;
        case "ORDER_REQUESTED":
          updateData.orderRequestedAt = now;
          break;
        case "ORDER_APPROVED":
          updateData.orderApprovedAt = now;
          break;
        case "COMPLETED":
          updateData.completedAt = now;
          break;
        case "SHIPPED":
          updateData.shippedAt = now;
          break;
      }
    }

    if (designUrl !== undefined) updateData.designUrl = designUrl;
    if (finalUrl !== undefined) updateData.finalUrl = finalUrl;
    if (courier !== undefined) updateData.courier = courier;
    if (trackingNumber !== undefined) updateData.trackingNumber = trackingNumber;
    if (adminNote !== undefined) updateData.adminNote = adminNote;

    // 수정 요청 시 카운트 증가
    if (revisionNote) {
      updateData.revisionNote = revisionNote;
      updateData.revisionCount = existingWorkflow.revisionCount + 1;
    }

    // 워크플로우 업데이트
    const workflow = await prisma.workflow.update({
      where: { id },
      data: updateData,
    });

    // 상태 변경 로그 생성
    if (status && status !== existingWorkflow.status) {
      await prisma.workflowLog.create({
        data: {
          workflowId: id,
          fromStatus: existingWorkflow.status,
          toStatus: status,
          changedBy: changedBy || "admin",
          note: adminNote || null,
        },
      });

      // Slack 채널에 상태 변경 로그 전송
      try {
        // 사용자의 Submission에서 Slack 채널 ID 조회
        const submission = await prisma.submission.findUnique({
          where: { userId: existingWorkflow.userId },
          select: { slackChannelId: true },
        });

        if (submission?.slackChannelId) {
          await logStateChange({
            channelId: submission.slackChannelId,
            fromState: WORKFLOW_STATUS_LABELS[existingWorkflow.status] || existingWorkflow.status,
            toState: WORKFLOW_STATUS_LABELS[status] || status,
            changedBy: changedBy || "관리자",
          });

          // 디자인 업로드 시 파일도 함께 전송
          if (status === "DESIGN_UPLOADED" && designUrl) {
            await logDesignUpload({
              channelId: submission.slackChannelId,
              itemName: WORKFLOW_TYPE_LABELS[existingWorkflow.type] || existingWorkflow.type,
              designUrl,
            });
          }
        }

        // 사용자에게 Telegram 알림 전송 (중요 상태 변경)
        const user = await prisma.user.findUnique({
          where: { id: existingWorkflow.userId },
          select: { telegramChatId: true, telegramEnabled: true },
        });

        if (user?.telegramEnabled && user.telegramChatId) {
          const workflowTypeLabel = WORKFLOW_TYPE_LABELS[existingWorkflow.type] || existingWorkflow.type;

          // 디자인 업로드, 완료, 배송 시 알림
          if (status === "DESIGN_UPLOADED") {
            await sendTelegramMessage(
              user.telegramChatId,
              NotificationTemplates.designUploaded(workflowTypeLabel)
            );
          } else if (status === "COMPLETED") {
            await sendTelegramMessage(
              user.telegramChatId,
              NotificationTemplates.workflowCompleted(workflowTypeLabel)
            );
          } else if (status === "SHIPPED" && trackingNumber) {
            await sendTelegramMessage(
              user.telegramChatId,
              NotificationTemplates.shipped(workflowTypeLabel, trackingNumber)
            );
          }
        }
      } catch (notificationError) {
        console.error("[Workflow] 알림 전송 실패:", notificationError);
        // 알림 실패해도 API는 성공 처리
      }
    }

    return NextResponse.json({
      success: true,
      data: workflow,
      message: "워크플로우가 업데이트되었습니다",
    });
  } catch (error) {
    if (error instanceof Error && error.message === "UNAUTHORIZED") {
      return NextResponse.json({ error: "인증이 필요합니다" }, { status: 401 });
    }
    console.error("[Admin API] PATCH /api/workflows/[id] error:", error);
    return NextResponse.json(
      { error: "워크플로우 업데이트 중 오류가 발생했습니다" },
      { status: 500 }
    );
  }
}

// DELETE: 워크플로우 삭제
export async function DELETE(request: NextRequest, { params }: RouteParams) {
  try {
    await requireAdmin();
    const { id } = await params;

    // 워크플로우 존재 확인
    const existingWorkflow = await prisma.workflow.findUnique({
      where: { id },
    });

    if (!existingWorkflow) {
      return NextResponse.json(
        { error: "워크플로우를 찾을 수 없습니다" },
        { status: 404 }
      );
    }

    // 워크플로우 삭제 (관련 로그도 cascade로 삭제됨)
    await prisma.workflow.delete({
      where: { id },
    });

    return NextResponse.json({
      success: true,
      message: "워크플로우가 삭제되었습니다",
    });
  } catch (error) {
    if (error instanceof Error && error.message === "UNAUTHORIZED") {
      return NextResponse.json({ error: "인증이 필요합니다" }, { status: 401 });
    }
    console.error("[Admin API] DELETE /api/workflows/[id] error:", error);
    return NextResponse.json(
      { error: "워크플로우 삭제 중 오류가 발생했습니다" },
      { status: 500 }
    );
  }
}
