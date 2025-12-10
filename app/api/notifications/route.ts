/**
 * Admin 앱 - 알림 API
 * GET: 알림 로그 조회
 * POST: 알림 발송
 */

import { NextRequest, NextResponse } from "next/server";
import { prisma, NotificationType, NotificationChannel } from "@polarad/database";
import { requireAdmin } from "@/lib/auth";
import { sendNotification } from "@polarad/lib/notification";

// GET: 알림 로그 조회
export async function GET(request: NextRequest) {
  try {
    await requireAdmin();

    const { searchParams } = new URL(request.url);
    const clientId = searchParams.get("clientId");
    const type = searchParams.get("type") as NotificationType | null;
    const page = parseInt(searchParams.get("page") || "1");
    const limit = parseInt(searchParams.get("limit") || "50");

    // 필터 조건 구성
    const where: Record<string, unknown> = {};

    if (clientId) {
      where.clientId = clientId;
    }

    if (type) {
      where.notificationType = type;
    }

    // 전체 개수
    const total = await prisma.notificationLog.count({ where });

    // 알림 로그 조회
    const logs = await prisma.notificationLog.findMany({
      where,
      include: {
        client: {
          select: {
            clientId: true,
            clientName: true,
          },
        },
      },
      orderBy: { sentAt: "desc" },
      skip: (page - 1) * limit,
      take: limit,
    });

    // 오늘 통계
    const today = new Date();
    today.setHours(0, 0, 0, 0);

    const todayStats = await prisma.notificationLog.groupBy({
      by: ["status"],
      where: {
        sentAt: { gte: today },
      },
      _count: true,
    });

    return NextResponse.json({
      success: true,
      data: logs,
      pagination: {
        total,
        page,
        limit,
        totalPages: Math.ceil(total / limit),
      },
      todayStats: {
        sent: todayStats.find((s) => s.status === "SENT")?._count || 0,
        failed: todayStats.find((s) => s.status === "FAILED")?._count || 0,
        total: todayStats.reduce((acc, s) => acc + s._count, 0),
      },
    });
  } catch (error) {
    if (error instanceof Error && error.message === "UNAUTHORIZED") {
      return NextResponse.json({ error: "인증이 필요합니다" }, { status: 401 });
    }
    console.error("[Admin API] GET /api/notifications error:", error);
    return NextResponse.json(
      { success: false, error: "알림 로그 조회에 실패했습니다." },
      { status: 500 }
    );
  }
}

// POST: 알림 발송
export async function POST(request: NextRequest) {
  try {
    await requireAdmin();

    const body = await request.json();
    const { clientId, notificationType, message, channel } = body;

    // 필수 필드 검증
    if (!clientId || !notificationType || !message) {
      return NextResponse.json(
        {
          success: false,
          error: "clientId, notificationType, message는 필수입니다.",
        },
        { status: 400 }
      );
    }

    // 알림 유형 검증
    if (!Object.values(NotificationType).includes(notificationType)) {
      return NextResponse.json(
        { success: false, error: "유효하지 않은 알림 유형입니다." },
        { status: 400 }
      );
    }

    // 알림 발송
    const result = await sendNotification({
      clientId,
      notificationType,
      message,
      channel: channel || NotificationChannel.TELEGRAM,
    });

    if (result.skipped) {
      return NextResponse.json({
        success: false,
        skipped: true,
        message: result.skipReason,
      });
    }

    if (!result.success) {
      return NextResponse.json(
        { success: false, error: result.error },
        { status: 500 }
      );
    }

    return NextResponse.json({
      success: true,
      data: { logId: result.logId },
    });
  } catch (error) {
    if (error instanceof Error && error.message === "UNAUTHORIZED") {
      return NextResponse.json({ error: "인증이 필요합니다" }, { status: 401 });
    }
    console.error("[Admin API] POST /api/notifications error:", error);
    return NextResponse.json(
      { success: false, error: "알림 발송에 실패했습니다." },
      { status: 500 }
    );
  }
}
