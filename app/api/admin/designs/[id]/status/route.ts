/**
 * Admin API - 시안 상태 변경
 * PATCH: 시안 상태 변경 (DRAFT → PENDING_REVIEW 등)
 */

import { NextRequest, NextResponse } from "next/server";
import { prisma, DesignStatus, WorkflowStatus } from "@polarad/database";
import { requireAdmin } from "@/lib/auth";
import { sendDesignNotification } from "@/lib/notification/design";

export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    await requireAdmin();
    const { id } = await params;

    const body = await request.json();
    const { status, sendNotification = false } = body;

    if (!status) {
      return NextResponse.json(
        { error: "상태값은 필수입니다" },
        { status: 400 }
      );
    }

    // 유효한 상태값 확인
    const validStatuses: DesignStatus[] = ["DRAFT", "PENDING_REVIEW", "REVISION_REQUESTED", "APPROVED"];
    if (!validStatuses.includes(status)) {
      return NextResponse.json(
        { error: "유효하지 않은 상태값입니다" },
        { status: 400 }
      );
    }

    // 시안 존재 확인
    const design = await prisma.design.findUnique({
      where: { id },
      include: {
        workflow: {
          include: {
            user: true,
          },
        },
        versions: {
          orderBy: { version: "desc" },
          take: 1,
        },
      },
    });

    if (!design) {
      return NextResponse.json(
        { error: "시안을 찾을 수 없습니다" },
        { status: 404 }
      );
    }

    // 상태 업데이트 데이터 준비
    const updateData: {
      status: DesignStatus;
      approvedAt?: Date;
      approvedVersion?: number;
    } = { status };

    // 확정 시 추가 데이터
    if (status === "APPROVED") {
      updateData.approvedAt = new Date();
      updateData.approvedVersion = design.currentVersion;
    }

    // 시안 상태 업데이트
    const updatedDesign = await prisma.design.update({
      where: { id },
      data: updateData,
    });

    // 워크플로우 상태 연동 (Phase 3)
    if (status === "PENDING_REVIEW" && design.workflow.status === "IN_PROGRESS") {
      await prisma.workflow.update({
        where: { id: design.workflowId },
        data: {
          status: "DESIGN_UPLOADED" as WorkflowStatus,
          designUploadedAt: new Date(),
        },
      });
    } else if (status === "APPROVED" && design.workflow.status === "DESIGN_UPLOADED") {
      await prisma.workflow.update({
        where: { id: design.workflowId },
        data: {
          status: "ORDER_REQUESTED" as WorkflowStatus,
          orderRequestedAt: new Date(),
        },
      });
    }

    // 알림 발송 (Phase 2)
    if (sendNotification && status === "PENDING_REVIEW") {
      try {
        await sendDesignNotification({
          type: "DESIGN_UPLOADED",
          design: updatedDesign,
          user: design.workflow.user,
          workflowType: design.workflow.type,
        });
      } catch (notifyError) {
        console.error("[Design] 알림 발송 실패:", notifyError);
        // 알림 실패해도 상태 변경은 성공으로 처리
      }
    }

    return NextResponse.json({
      success: true,
      data: updatedDesign,
    });
  } catch (error) {
    if (error instanceof Error && error.message === "UNAUTHORIZED") {
      return NextResponse.json({ error: "인증이 필요합니다" }, { status: 401 });
    }
    console.error("[Admin API] PATCH /api/admin/designs/[id]/status error:", error);
    return NextResponse.json(
      { error: "시안 상태 변경 중 오류가 발생했습니다" },
      { status: 500 }
    );
  }
}
