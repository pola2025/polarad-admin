/**
 * Admin 앱 - 토큰 관리 API
 * GET: 토큰 상태 조회 (만료 임박 목록)
 */

import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@polarad/database";
import { requireAdmin } from "@/lib/auth";

// GET: 토큰 상태 조회
export async function GET(request: NextRequest) {
  try {
    await requireAdmin();

    const { searchParams } = new URL(request.url);
    const daysFilter = parseInt(searchParams.get("days") || "14");

    const now = new Date();
    const filterDate = new Date(now.getTime() + daysFilter * 24 * 60 * 60 * 1000);

    // 토큰 만료 임박 클라이언트 조회
    const expiringClients = await prisma.client.findMany({
      where: {
        isActive: true,
        tokenExpiresAt: {
          gte: now,
          lte: filterDate,
        },
      },
      select: {
        id: true,
        clientId: true,
        clientName: true,
        email: true,
        tokenExpiresAt: true,
        authStatus: true,
        telegramEnabled: true,
      },
      orderBy: { tokenExpiresAt: "asc" },
    });

    // 이미 만료된 클라이언트
    const expiredClients = await prisma.client.findMany({
      where: {
        isActive: true,
        tokenExpiresAt: {
          lt: now,
        },
      },
      select: {
        id: true,
        clientId: true,
        clientName: true,
        email: true,
        tokenExpiresAt: true,
        authStatus: true,
        telegramEnabled: true,
      },
      orderBy: { tokenExpiresAt: "desc" },
    });

    // 재인증 필요 클라이언트
    const authRequiredClients = await prisma.client.findMany({
      where: {
        isActive: true,
        authStatus: "AUTH_REQUIRED",
      },
      select: {
        id: true,
        clientId: true,
        clientName: true,
        email: true,
        tokenExpiresAt: true,
        authStatus: true,
        telegramEnabled: true,
      },
    });

    // 통계
    const stats = {
      expiring: expiringClients.length,
      expired: expiredClients.length,
      authRequired: authRequiredClients.length,
      critical: expiringClients.filter((c) => {
        if (!c.tokenExpiresAt) return false;
        const days = Math.ceil(
          (c.tokenExpiresAt.getTime() - now.getTime()) / (1000 * 60 * 60 * 24)
        );
        return days <= 3;
      }).length,
    };

    return NextResponse.json({
      success: true,
      data: {
        expiring: expiringClients,
        expired: expiredClients,
        authRequired: authRequiredClients,
      },
      stats,
    });
  } catch (error) {
    if (error instanceof Error && error.message === "UNAUTHORIZED") {
      return NextResponse.json({ error: "인증이 필요합니다" }, { status: 401 });
    }
    console.error("[Admin API] GET /api/tokens error:", error);
    return NextResponse.json(
      { success: false, error: "토큰 상태 조회에 실패했습니다." },
      { status: 500 }
    );
  }
}
