/**
 * Admin API - 특정 스레드 관리
 * GET: 스레드 상세 조회 (모든 메시지 포함)
 * PATCH: 스레드 상태/정보 수정
 */

import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@polarad/database";
import { requireAdmin } from "@/lib/auth";

interface RouteParams {
  params: Promise<{ threadId: string }>;
}

// GET: 특정 스레드와 모든 메시지 조회
export async function GET(request: NextRequest, { params }: RouteParams) {
  try {
    await requireAdmin();

    const { threadId } = await params;

    const thread = await prisma.communicationThread.findUnique({
      where: { id: threadId },
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
        messages: {
          orderBy: { createdAt: "asc" },
        },
      },
    });

    if (!thread) {
      return NextResponse.json(
        { error: "스레드를 찾을 수 없습니다" },
        { status: 404 }
      );
    }

    // 읽지 않은 사용자 메시지를 읽음 처리
    await prisma.communicationMessage.updateMany({
      where: {
        threadId,
        authorType: "user",
        isReadByAdmin: false,
      },
      data: {
        isReadByAdmin: true,
        readByAdminAt: new Date(),
      },
    });

    return NextResponse.json({
      success: true,
      data: thread,
    });
  } catch (error) {
    if (error instanceof Error && error.message === "UNAUTHORIZED") {
      return NextResponse.json({ error: "인증이 필요합니다" }, { status: 401 });
    }
    console.error("[Admin API] GET /api/admin/communications/[threadId] error:", error);
    return NextResponse.json(
      { error: "스레드 조회 중 오류가 발생했습니다" },
      { status: 500 }
    );
  }
}

// PATCH: 스레드 상태/정보 수정
export async function PATCH(request: NextRequest, { params }: RouteParams) {
  try {
    await requireAdmin();

    const { threadId } = await params;
    const body = await request.json();
    const { status, expectedCompletionDate } = body;

    const thread = await prisma.communicationThread.findUnique({
      where: { id: threadId },
    });

    if (!thread) {
      return NextResponse.json(
        { error: "스레드를 찾을 수 없습니다" },
        { status: 404 }
      );
    }

    const updateData: Record<string, unknown> = {};

    if (status) {
      updateData.status = status;
    }

    if (expectedCompletionDate !== undefined) {
      updateData.expectedCompletionDate = expectedCompletionDate
        ? new Date(expectedCompletionDate)
        : null;
    }

    const updatedThread = await prisma.communicationThread.update({
      where: { id: threadId },
      data: updateData,
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

    return NextResponse.json({
      success: true,
      data: updatedThread,
      message: "스레드가 업데이트되었습니다",
    });
  } catch (error) {
    if (error instanceof Error && error.message === "UNAUTHORIZED") {
      return NextResponse.json({ error: "인증이 필요합니다" }, { status: 401 });
    }
    console.error("[Admin API] PATCH /api/admin/communications/[threadId] error:", error);
    return NextResponse.json(
      { error: "스레드 수정 중 오류가 발생했습니다" },
      { status: 500 }
    );
  }
}
