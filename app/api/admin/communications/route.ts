/**
 * Admin API - 커뮤니케이션 관리
 * GET: 전체 스레드 목록 조회
 */

import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@polarad/database";
import { requireAdmin } from "@/lib/auth";

export async function GET(request: NextRequest) {
  try {
    await requireAdmin();

    const { searchParams } = new URL(request.url);
    const page = parseInt(searchParams.get("page") || "1");
    const limit = parseInt(searchParams.get("limit") || "20");
    const search = searchParams.get("search") || "";
    const status = searchParams.get("status"); // OPEN, IN_PROGRESS, RESOLVED
    const category = searchParams.get("category"); // 홈페이지, 로고, 인쇄물, 광고, 일반

    const skip = (page - 1) * limit;

    // 검색 조건
    const where: Record<string, unknown> = {};

    if (search) {
      where.OR = [
        { title: { contains: search, mode: "insensitive" } },
        { user: { name: { contains: search, mode: "insensitive" } } },
        { user: { clientName: { contains: search, mode: "insensitive" } } },
      ];
    }

    if (status && status !== "all") {
      where.status = status;
    }

    if (category && category !== "all") {
      where.category = category;
    }

    // 전체 개수 조회
    const total = await prisma.communicationThread.count({ where });

    // 스레드 목록 조회
    const threads = await prisma.communicationThread.findMany({
      where,
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
          orderBy: { createdAt: "desc" },
          take: 1, // 최신 메시지만
        },
      },
      orderBy: [
        { status: "asc" }, // OPEN 우선
        { lastReplyAt: "desc" },
      ],
      skip,
      take: limit,
    });

    // 읽지 않은 사용자 메시지 수 계산
    const threadsWithUnread = threads.map((thread: typeof threads[number]) => {
      const lastMessage = thread.messages[0];
      const hasUnreadUserMessage =
        lastMessage &&
        lastMessage.authorType === "user" &&
        !lastMessage.isReadByAdmin;

      return {
        ...thread,
        lastMessage: lastMessage || null,
        hasUnreadUserMessage,
      };
    });

    // 상태별 통계
    const stats = {
      total: await prisma.communicationThread.count(),
      open: await prisma.communicationThread.count({ where: { status: "OPEN" } }),
      inProgress: await prisma.communicationThread.count({ where: { status: "IN_PROGRESS" } }),
      resolved: await prisma.communicationThread.count({ where: { status: "RESOLVED" } }),
    };

    // 읽지 않은 메시지 수
    const unreadCount = await prisma.communicationMessage.count({
      where: {
        authorType: "user",
        isReadByAdmin: false,
      },
    });

    return NextResponse.json({
      success: true,
      data: threadsWithUnread,
      pagination: {
        page,
        limit,
        total,
        totalPages: Math.ceil(total / limit),
      },
      stats,
      unreadCount,
    });
  } catch (error) {
    if (error instanceof Error && error.message === "UNAUTHORIZED") {
      return NextResponse.json({ error: "인증이 필요합니다" }, { status: 401 });
    }
    console.error("[Admin API] GET /api/admin/communications error:", error);
    return NextResponse.json(
      { error: "스레드 목록 조회 중 오류가 발생했습니다" },
      { status: 500 }
    );
  }
}
