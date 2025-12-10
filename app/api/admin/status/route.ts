/**
 * Admin API - 시스템 상태 조회
 *
 * GET: 시스템 전체 상태 (클라이언트 현황, 데이터 현황, 최근 활동)
 */

import { NextResponse } from "next/server";
import { prisma } from "@polarad/database";
import { requireAdmin } from "@/lib/auth";

// GET: 시스템 전체 상태
export async function GET() {
  try {
    await requireAdmin();

    const now = new Date();
    const sevenDaysAgo = new Date(now);
    sevenDaysAgo.setDate(sevenDaysAgo.getDate() - 7);

    const sevenDaysLater = new Date(now);
    sevenDaysLater.setDate(sevenDaysLater.getDate() + 7);

    // 1. 클라이언트 현황
    const clients = await prisma.client.findMany({
      select: {
        id: true,
        clientName: true,
        isActive: true,
        telegramChatId: true,
        servicePeriodEnd: true,
        authStatus: true,
        tokenExpiresAt: true,
      },
    });

    const totalClients = clients.length;
    const activeClients = clients.filter((c) => c.isActive).length;
    const withTelegram = clients.filter((c) => c.telegramChatId).length;

    // 서비스 만료 예정 클라이언트 (7일 이내)
    const expiringClients = clients.filter((c) => {
      if (!c.servicePeriodEnd || !c.isActive) return false;
      const endDate = new Date(c.servicePeriodEnd);
      return endDate <= sevenDaysLater && endDate >= now;
    });

    // auth_required 또는 token_expired 상태 클라이언트
    const authRequiredClients = clients.filter(
      (c) =>
        c.isActive &&
        (c.authStatus === "AUTH_REQUIRED" || c.authStatus === "TOKEN_EXPIRED")
    );

    // 토큰 만료 예정 클라이언트 (7일 이내)
    const tokenExpiringClients = clients
      .filter((c) => {
        if (!c.tokenExpiresAt || !c.isActive) return false;
        if (
          c.authStatus === "AUTH_REQUIRED" ||
          c.authStatus === "TOKEN_EXPIRED"
        )
          return false;
        const expiresAt = new Date(c.tokenExpiresAt);
        return expiresAt <= sevenDaysLater && expiresAt >= now;
      })
      .map((c) => {
        const expiresAt = new Date(c.tokenExpiresAt!);
        const daysLeft = Math.ceil(
          (expiresAt.getTime() - now.getTime()) / (1000 * 60 * 60 * 24)
        );
        return { ...c, daysLeft };
      })
      .sort((a, b) => a.daysLeft - b.daysLeft);

    // 2. 오늘 수집 데이터
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const tomorrow = new Date(today);
    tomorrow.setDate(tomorrow.getDate() + 1);

    const todayDataCount = await prisma.rawData.count({
      where: {
        date: {
          gte: today,
          lt: tomorrow,
        },
      },
    });

    // 3. 어제 수집 데이터
    const yesterday = new Date(today);
    yesterday.setDate(yesterday.getDate() - 1);

    const yesterdayDataCount = await prisma.rawData.count({
      where: {
        date: {
          gte: yesterday,
          lt: today,
        },
      },
    });

    // 4. 최근 7일 전체 데이터
    const recentData = await prisma.rawData.findMany({
      where: {
        date: {
          gte: sevenDaysAgo,
        },
      },
      select: {
        impressions: true,
        clicks: true,
        leads: true,
        spend: true,
      },
    });

    const recent7DaysCount = recentData.length;
    const recent7DaysTotals = recentData.reduce(
      (acc, row) => ({
        impressions: acc.impressions + row.impressions,
        clicks: acc.clicks + row.clicks,
        leads: acc.leads + row.leads,
        spend: acc.spend + Number(row.spend),
      }),
      { impressions: 0, clicks: 0, leads: 0, spend: 0 }
    );

    // 5. 최근 알림 발송 현황
    const recentNotifications = await prisma.notificationLog.findMany({
      orderBy: { sentAt: "desc" },
      take: 10,
      select: {
        id: true,
        clientId: true,
        notificationType: true,
        sentAt: true,
      },
    });

    const latestNotification = recentNotifications[0] || null;

    // 6. 클라이언트별 최신 데이터 현황
    const clientDataStatus = await Promise.all(
      clients
        .filter((c) => c.isActive)
        .map(async (client) => {
          const latestData = await prisma.rawData.findFirst({
            where: { clientId: client.id },
            orderBy: { date: "desc" },
            select: { date: true },
          });

          return {
            id: client.id,
            name: client.clientName,
            latestDate: latestData?.date || null,
            hasTelegram: !!client.telegramChatId,
          };
        })
    );

    // 데이터 누락 클라이언트 (2일 이상 데이터 없음)
    const twoDaysAgo = new Date();
    twoDaysAgo.setDate(twoDaysAgo.getDate() - 2);
    twoDaysAgo.setHours(0, 0, 0, 0);

    const missingDataClients = clientDataStatus.filter((c) => {
      if (!c.latestDate) return true;
      return new Date(c.latestDate) < twoDaysAgo;
    });

    return NextResponse.json({
      success: true,
      timestamp: new Date().toISOString(),

      // 클라이언트 현황
      clients: {
        total: totalClients,
        active: activeClients,
        inactive: totalClients - activeClients,
        withTelegram,
        expiringSoon: expiringClients.length,
        expiringList: expiringClients.map((c) => ({
          id: c.id,
          name: c.clientName,
          endDate: c.servicePeriodEnd,
        })),
        authRequired: authRequiredClients.length,
        authRequiredList: authRequiredClients.map((c) => ({
          id: c.id,
          name: c.clientName,
          status: c.authStatus,
        })),
        tokenExpiring: tokenExpiringClients.length,
        tokenExpiringList: tokenExpiringClients.map((c) => ({
          id: c.id,
          name: c.clientName,
          expiresAt: c.tokenExpiresAt,
          daysLeft: c.daysLeft,
        })),
      },

      // 데이터 수집 현황
      dataCollection: {
        todayRecords: todayDataCount,
        yesterdayRecords: yesterdayDataCount,
        recent7DaysRecords: recent7DaysCount,
        recent7DaysImpressions: recent7DaysTotals.impressions,
        missingDataClients: missingDataClients.length,
        missingList: missingDataClients.map((c) => ({
          id: c.id,
          name: c.name,
          lastDate: c.latestDate,
        })),
      },

      // 최근 7일 전체 성과
      recent7Days: {
        impressions: recent7DaysTotals.impressions,
        clicks: recent7DaysTotals.clicks,
        leads: recent7DaysTotals.leads,
        spend: Math.round(recent7DaysTotals.spend * 100) / 100,
        ctr:
          recent7DaysTotals.impressions > 0
            ? parseFloat(
                (
                  (recent7DaysTotals.clicks / recent7DaysTotals.impressions) *
                  100
                ).toFixed(2)
              )
            : 0,
        cpl:
          recent7DaysTotals.leads > 0
            ? Math.round(
                (recent7DaysTotals.spend / recent7DaysTotals.leads) * 100
              ) / 100
            : 0,
      },

      // 알림 현황
      notifications: {
        latestSentAt: latestNotification?.sentAt || null,
        latestType: latestNotification?.notificationType || null,
        recentCount: recentNotifications.length,
      },

      // 클라이언트별 데이터 현황
      clientDataStatus,
    });
  } catch (error) {
    if (error instanceof Error && error.message === "UNAUTHORIZED") {
      return NextResponse.json({ error: "인증이 필요합니다" }, { status: 401 });
    }
    console.error("[Admin API] GET /api/admin/status error:", error);
    return NextResponse.json(
      { success: false, error: "시스템 상태 조회에 실패했습니다." },
      { status: 500 }
    );
  }
}
