/**
 * Admin API - Submission 상세/수정
 * GET: Submission 상세 조회
 * PATCH: Submission 상태 변경 (검토 시작)
 */

import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@polarad/database";
import { requireAdmin } from "@/lib/auth";

// GET: Submission 상세 조회
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    await requireAdmin();
    const { id } = await params;

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
            createdAt: true,
            workflows: {
              select: {
                id: true,
                type: true,
                status: true,
                createdAt: true,
              },
            },
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

    return NextResponse.json({
      success: true,
      data: submission,
    });
  } catch (error) {
    if (error instanceof Error && error.message === "UNAUTHORIZED") {
      return NextResponse.json({ error: "인증이 필요합니다" }, { status: 401 });
    }
    console.error("[Admin API] GET /api/admin/submissions/[id] error:", error);
    return NextResponse.json(
      { error: "Submission 조회 중 오류가 발생했습니다" },
      { status: 500 }
    );
  }
}

// PATCH: Submission 상태 변경
export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const admin = await requireAdmin();
    const { id } = await params;
    const body = await request.json();
    const { status } = body;

    // 현재 Submission 조회
    const submission = await prisma.submission.findUnique({
      where: { id },
      include: { user: true },
    });

    if (!submission) {
      return NextResponse.json(
        { error: "Submission을 찾을 수 없습니다" },
        { status: 404 }
      );
    }

    // 상태 변경 데이터 준비
    const updateData: Record<string, unknown> = {
      status,
      reviewedBy: admin.userId,
      reviewedAt: new Date(),
    };

    // Submission 업데이트
    const updated = await prisma.submission.update({
      where: { id },
      data: updateData,
      include: {
        user: {
          select: {
            id: true,
            name: true,
            clientName: true,
            email: true,
            telegramChatId: true,
          },
        },
      },
    });

    return NextResponse.json({
      success: true,
      data: updated,
      message: `상태가 ${status}(으)로 변경되었습니다`,
    });
  } catch (error) {
    if (error instanceof Error && error.message === "UNAUTHORIZED") {
      return NextResponse.json({ error: "인증이 필요합니다" }, { status: 401 });
    }
    console.error("[Admin API] PATCH /api/admin/submissions/[id] error:", error);
    return NextResponse.json(
      { error: "Submission 상태 변경 중 오류가 발생했습니다" },
      { status: 500 }
    );
  }
}
