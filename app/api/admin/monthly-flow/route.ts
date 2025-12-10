/**
 * Admin API - 월간 광고 효율 흐름 데이터
 *
 * GET: 월별 일일 집계 데이터 (도달, 리드, CPL, 지출)
 */

import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@polarad/database";
import { requireAdmin } from "@/lib/auth";

// GET: 월간 일일 데이터
export async function GET(request: NextRequest) {
  try {
    await requireAdmin();

    const { searchParams } = new URL(request.url);
    const year = parseInt(
      searchParams.get("year") || new Date().getFullYear().toString()
    );
    const month = parseInt(
      searchParams.get("month") || (new Date().getMonth() + 1).toString()
    );
    const clientId = searchParams.get("clientId"); // 특정 클라이언트 필터

    // 해당 월의 시작일과 종료일
    const startDate = new Date(year, month - 1, 1);
    const lastDay = new Date(year, month, 0).getDate();
    const endDate = new Date(year, month - 1, lastDay, 23, 59, 59);

    // raw_data에서 일별 집계
    const whereCondition: Record<string, unknown> = {
      date: {
        gte: startDate,
        lte: endDate,
      },
    };

    if (clientId) {
      whereCondition.clientId = clientId;
    }

    const rawData = await prisma.rawData.findMany({
      where: whereCondition,
      select: {
        date: true,
        impressions: true,
        clicks: true,
        leads: true,
        spend: true,
      },
    });

    // 일별 집계 맵 초기화
    const dailyMap: Record<
      string,
      {
        date: string;
        impressions: number;
        clicks: number;
        leads: number;
        spend: number;
      }
    > = {};

    // 해당 월의 모든 날짜 초기화
    for (let day = 1; day <= lastDay; day++) {
      const dateStr = `${year}-${String(month).padStart(2, "0")}-${String(day).padStart(2, "0")}`;
      dailyMap[dateStr] = {
        date: dateStr,
        impressions: 0,
        clicks: 0,
        leads: 0,
        spend: 0,
      };
    }

    // 데이터 집계
    rawData.forEach((row) => {
      const dateStr = row.date.toISOString().split("T")[0];
      if (dailyMap[dateStr]) {
        dailyMap[dateStr].impressions += row.impressions || 0;
        dailyMap[dateStr].clicks += row.clicks || 0;
        dailyMap[dateStr].leads += row.leads || 0;
        dailyMap[dateStr].spend += Number(row.spend) || 0;
      }
    });

    // 배열로 변환 및 CPL 계산
    const dailyData = Object.keys(dailyMap)
      .sort()
      .map((dateStr) => {
        const d = dailyMap[dateStr];
        const hasData = d.spend > 0 || d.leads > 0 || d.impressions > 0;
        const cpl = d.leads > 0 ? d.spend / d.leads : 0;
        const ctr = d.impressions > 0 ? (d.clicks / d.impressions) * 100 : 0;

        return {
          date: dateStr,
          day: parseInt(dateStr.split("-")[2]),
          impressions: d.impressions,
          clicks: d.clicks,
          leads: d.leads,
          spend: Math.round(d.spend * 100) / 100,
          cpl: Math.round(cpl * 100) / 100,
          ctr: Math.round(ctr * 100) / 100,
          hasData,
        };
      });

    // 월 평균 CPL 계산
    const totalSpend = dailyData.reduce((sum, d) => sum + d.spend, 0);
    const totalLeads = dailyData.reduce((sum, d) => sum + d.leads, 0);
    const avgCpl = totalLeads > 0 ? totalSpend / totalLeads : 0;

    // 효율 저하 구간 탐지 (평균 CPL 대비 30% 이상 높은 구간)
    const threshold = avgCpl * 1.3;
    const inefficientDays = dailyData
      .filter((d) => d.hasData && d.leads > 0 && d.cpl > threshold)
      .map((d) => d.day);

    // 월 합계
    const monthlyTotals = {
      impressions: dailyData.reduce((sum, d) => sum + d.impressions, 0),
      clicks: dailyData.reduce((sum, d) => sum + d.clicks, 0),
      leads: totalLeads,
      spend: Math.round(totalSpend * 100) / 100,
      avgCpl: Math.round(avgCpl * 100) / 100,
    };

    // 광고 운영일/OFF일 통계
    const activeDays = dailyData.filter((d) => d.hasData).length;
    const inactiveDays = dailyData.length - activeDays;

    return NextResponse.json({
      success: true,
      year,
      month,
      clientId: clientId || null,
      startDate: startDate.toISOString().split("T")[0],
      endDate: endDate.toISOString().split("T")[0],
      dailyData,
      monthlyTotals,
      analysis: {
        avgCpl: Math.round(avgCpl * 100) / 100,
        threshold: Math.round(threshold * 100) / 100,
        inefficientDays,
        inefficientCount: inefficientDays.length,
        activeDays,
        inactiveDays,
      },
    });
  } catch (error) {
    if (error instanceof Error && error.message === "UNAUTHORIZED") {
      return NextResponse.json({ error: "인증이 필요합니다" }, { status: 401 });
    }
    console.error("[Admin API] GET /api/admin/monthly-flow error:", error);
    return NextResponse.json(
      { success: false, error: "월간 흐름 데이터 조회에 실패했습니다." },
      { status: 500 }
    );
  }
}
