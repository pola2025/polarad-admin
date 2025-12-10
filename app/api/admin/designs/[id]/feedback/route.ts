/**
 * Admin API - 시안 피드백 작성
 * POST: 관리자 피드백 작성
 */

import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@polarad/database";
import { requireAdmin } from "@/lib/auth";
import { sendDesignNotification } from "@/lib/notification/design";

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const admin = await requireAdmin();
    const { id } = await params;

    const body = await request.json();
    const { content, versionId } = body;

    if (!content) {
      return NextResponse.json(
        { error: "피드백 내용은 필수입니다" },
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

    // 타겟 버전 결정 (versionId가 없으면 최신 버전)
    const targetVersionId = versionId || design.versions[0]?.id;

    if (!targetVersionId) {
      return NextResponse.json(
        { error: "시안 버전을 찾을 수 없습니다" },
        { status: 404 }
      );
    }

    // 피드백 생성
    const feedback = await prisma.designFeedback.create({
      data: {
        versionId: targetVersionId,
        authorId: admin.userId,
        authorType: "admin",
        authorName: admin.name,
        content,
      },
    });

    // 고객에게 알림 발송 (Telegram)
    try {
      await sendDesignNotification({
        type: "DESIGN_FEEDBACK",
        design,
        user: design.workflow.user,
        workflowType: design.workflow.type,
        feedbackContent: content,
      });
    } catch (notifyError) {
      console.error("[Design] 피드백 알림 발송 실패:", notifyError);
    }

    return NextResponse.json({
      success: true,
      data: feedback,
    });
  } catch (error) {
    if (error instanceof Error && error.message === "UNAUTHORIZED") {
      return NextResponse.json({ error: "인증이 필요합니다" }, { status: 401 });
    }
    console.error("[Admin API] POST /api/admin/designs/[id]/feedback error:", error);
    return NextResponse.json(
      { error: "피드백 작성 중 오류가 발생했습니다" },
      { status: 500 }
    );
  }
}
