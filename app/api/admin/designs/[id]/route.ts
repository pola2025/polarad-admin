/**
 * Admin API - 시안 상세
 * GET: 시안 상세 조회
 * DELETE: 시안 삭제
 */

import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@polarad/database";
import { requireAdmin } from "@/lib/auth";

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    await requireAdmin();
    const { id } = await params;

    const design = await prisma.design.findUnique({
      where: { id },
      include: {
        workflow: {
          select: {
            id: true,
            type: true,
            status: true,
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
        },
        versions: {
          orderBy: { version: "desc" },
          include: {
            feedbacks: {
              orderBy: { createdAt: "asc" },
            },
          },
        },
      },
    });

    if (!design) {
      return NextResponse.json(
        { error: "시안을 찾을 수 없습니다" },
        { status: 404 }
      );
    }

    return NextResponse.json({
      success: true,
      data: design,
    });
  } catch (error) {
    if (error instanceof Error && error.message === "UNAUTHORIZED") {
      return NextResponse.json({ error: "인증이 필요합니다" }, { status: 401 });
    }
    console.error("[Admin API] GET /api/admin/designs/[id] error:", error);
    return NextResponse.json(
      { error: "시안 조회 중 오류가 발생했습니다" },
      { status: 500 }
    );
  }
}

export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    await requireAdmin();
    const { id } = await params;

    const design = await prisma.design.findUnique({
      where: { id },
    });

    if (!design) {
      return NextResponse.json(
        { error: "시안을 찾을 수 없습니다" },
        { status: 404 }
      );
    }

    await prisma.design.delete({
      where: { id },
    });

    return NextResponse.json({
      success: true,
      message: "시안이 삭제되었습니다",
    });
  } catch (error) {
    if (error instanceof Error && error.message === "UNAUTHORIZED") {
      return NextResponse.json({ error: "인증이 필요합니다" }, { status: 401 });
    }
    console.error("[Admin API] DELETE /api/admin/designs/[id] error:", error);
    return NextResponse.json(
      { error: "시안 삭제 중 오류가 발생했습니다" },
      { status: 500 }
    );
  }
}
