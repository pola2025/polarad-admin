/**
 * Admin API - Submission 승인
 * POST: Submission 승인 + 워크플로우 자동 생성 + Slack 채널 생성
 */

import { NextRequest, NextResponse } from "next/server";
import { prisma, WorkflowType } from "@polarad/database";
import { requireAdmin } from "@/lib/auth";
import { createSlackChannel, pushSubmissionData } from "@/lib/notification/slackClient";
import { sendTelegramMessage, NotificationTemplates } from "@/lib/notification/telegramClient";

// 기본 워크플로우 타입
const DEFAULT_WORKFLOW_TYPES: WorkflowType[] = [
  "NAMECARD",
  "NAMETAG",
  "CONTRACT",
  "ENVELOPE",
  "WEBSITE",
];

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const admin = await requireAdmin();
    const { id } = await params;
    const body = await request.json();
    const { workflowTypes = DEFAULT_WORKFLOW_TYPES } = body;

    // 현재 Submission 조회
    const submission = await prisma.submission.findUnique({
      where: { id },
      include: {
        user: {
          select: {
            id: true,
            name: true,
            clientName: true,
            email: true,
            phone: true,
            telegramChatId: true,
            telegramEnabled: true,
          },
        },
      },
    });

    if (!submission) {
      return NextResponse.json(
        { error: "Submission을 찾을 수 없습니다" },
        { status: 404 }
      );
    }

    if (submission.status === "APPROVED") {
      return NextResponse.json(
        { error: "이미 승인된 Submission입니다" },
        { status: 400 }
      );
    }

    // 1. Slack 채널 생성
    let slackChannelId: string | null = null;
    try {
      slackChannelId = await createSlackChannel({
        clientName: submission.user.clientName,
        userName: submission.user.name,
        userEmail: submission.user.email,
        userPhone: submission.user.phone,
        brandName: submission.brandName || submission.user.clientName,
      });

      // Slack에 제출 정보 푸시
      if (slackChannelId) {
        await pushSubmissionData({
          channelId: slackChannelId,
          submissionData: {
            브랜드명: submission.brandName,
            연락처: submission.contactPhone,
            이메일: submission.contactEmail,
            배송주소: submission.deliveryAddress,
            홈페이지스타일: submission.websiteStyle,
            홈페이지컬러: submission.websiteColor,
            블로그디자인노트: submission.blogDesignNote,
            추가요청사항: submission.additionalNote,
          },
        });
      }
    } catch (slackError) {
      console.error("[Approve] Slack 채널 생성 실패:", slackError);
      // Slack 실패해도 승인 진행
    }

    // 2. Submission 상태 업데이트
    const updatedSubmission = await prisma.submission.update({
      where: { id },
      data: {
        status: "APPROVED",
        reviewedAt: new Date(),
        reviewedBy: admin.userId,
        rejectionReason: null,
        slackChannelId,
      },
    });

    // 3. 워크플로우 일괄 생성
    const workflows = await Promise.all(
      workflowTypes.map((type: WorkflowType) =>
        prisma.workflow.upsert({
          where: {
            userId_type: {
              userId: submission.userId,
              type,
            },
          },
          create: {
            userId: submission.userId,
            type,
            status: "SUBMITTED",
            submittedAt: new Date(),
          },
          update: {
            status: "SUBMITTED",
            submittedAt: new Date(),
          },
        })
      )
    );

    // 4. WorkflowLog 생성
    await Promise.all(
      workflows.map((workflow) =>
        prisma.workflowLog.create({
          data: {
            workflowId: workflow.id,
            fromStatus: null,
            toStatus: "SUBMITTED",
            changedBy: admin.userId,
            note: "Submission 승인으로 자동 생성",
          },
        })
      )
    );

    // 5. 텔레그램 알림 발송 (사용자)
    if (submission.user.telegramEnabled && submission.user.telegramChatId) {
      try {
        await sendTelegramMessage(
          submission.user.telegramChatId,
          NotificationTemplates.submissionApproved(
            submission.user.name,
            submission.brandName || submission.user.clientName
          )
        );
      } catch (telegramError) {
        console.error("[Approve] 텔레그램 알림 발송 실패:", telegramError);
      }
    }

    return NextResponse.json({
      success: true,
      data: {
        submission: updatedSubmission,
        workflows,
        slackChannelId,
      },
      message: `승인 완료. ${workflows.length}개의 워크플로우가 생성되었습니다.`,
    });
  } catch (error) {
    if (error instanceof Error && error.message === "UNAUTHORIZED") {
      return NextResponse.json({ error: "인증이 필요합니다" }, { status: 401 });
    }
    console.error("[Admin API] POST /api/admin/submissions/[id]/approve error:", error);
    return NextResponse.json(
      { error: "Submission 승인 중 오류가 발생했습니다" },
      { status: 500 }
    );
  }
}
