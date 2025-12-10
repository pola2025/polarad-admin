/**
 * Meta Ads 데이터 서비스
 *
 * raw_data 저장, 집계, 정합성 검증 등을 담당합니다.
 *
 * NOTE: 일부 함수들(aggregateFromRaw, verifyIntegrity, syncAndVerify, generateWeeklySummary 등)은
 * 현재 스키마에 필요한 모델(metaDailyAggregate, metaWeeklySummary)이 없어 비활성화되었습니다.
 */

import { prisma } from "@polarad/database";

export interface DataSyncResult {
  success: boolean;
  recordsAggregated: number;
  rawRecords?: number;
  datesVerified?: number;
  error?: string;
  mismatches?: Array<{
    date: string;
    raw: { leads: number; spend: string };
    agg: { leads: number; spend: string };
    issue: string;
  }>;
}

export interface ServicePeriodResult {
  valid: boolean;
  endDate: Date | null;
}

/**
 * 서비스 기간 확인
 */
export async function checkServicePeriod(
  clientId: string
): Promise<ServicePeriodResult> {
  const client = await prisma.client.findUnique({
    where: { id: clientId },
    select: {
      servicePeriodEnd: true,
      isActive: true,
    },
  });

  if (!client) {
    return { valid: false, endDate: null };
  }

  if (!client.isActive) {
    return { valid: false, endDate: client.servicePeriodEnd };
  }

  if (!client.servicePeriodEnd) {
    return { valid: true, endDate: null }; // 종료일 미설정 = 무제한
  }

  const today = new Date();
  today.setHours(0, 0, 0, 0);

  const isValid = client.servicePeriodEnd >= today;

  return { valid: isValid, endDate: client.servicePeriodEnd };
}

/**
 * 데이터 수집 기간 계산 (환경변수 기반)
 */
export function getDataCollectionPeriod(): { start: string; end: string } {
  const now = new Date();
  const kstNow = new Date(
    now.toLocaleString("en-US", { timeZone: "Asia/Seoul" })
  );

  const dataDays = process.env.DATA_DAYS
    ? parseInt(process.env.DATA_DAYS)
    : null;
  const dataPeriod = process.env.DATA_PERIOD || null;

  // 1. DATA_DAYS가 지정된 경우: 오늘부터 N일 전까지
  if (dataDays) {
    const endDate = new Date(kstNow);
    endDate.setDate(endDate.getDate() - 1); // 어제까지

    const startDate = new Date(endDate);
    startDate.setDate(endDate.getDate() - (dataDays - 1));

    return {
      start: startDate.toISOString().split("T")[0],
      end: endDate.toISOString().split("T")[0],
    };
  }

  // 2. DATA_PERIOD=last_month: 지난달 1일~말일
  if (dataPeriod === "last_month") {
    const year = kstNow.getFullYear();
    const month = kstNow.getMonth();

    const lastMonthDate =
      month === 0 ? new Date(year - 1, 11, 1) : new Date(year, month - 1, 1);

    const firstDay = new Date(
      lastMonthDate.getFullYear(),
      lastMonthDate.getMonth(),
      1
    );
    const lastDay = new Date(
      lastMonthDate.getFullYear(),
      lastMonthDate.getMonth() + 1,
      0
    );

    return {
      start: firstDay.toISOString().split("T")[0],
      end: lastDay.toISOString().split("T")[0],
    };
  }

  // 3. 기본값: 지난주 월~일
  const dayOfWeek = kstNow.getDay();
  const daysFromMonday = dayOfWeek === 0 ? 6 : dayOfWeek - 1;
  const thisMonday = new Date(kstNow);
  thisMonday.setDate(kstNow.getDate() - daysFromMonday);

  const lastMonday = new Date(thisMonday);
  lastMonday.setDate(thisMonday.getDate() - 7);

  const lastSunday = new Date(lastMonday);
  lastSunday.setDate(lastMonday.getDate() + 6);

  return {
    start: lastMonday.toISOString().split("T")[0],
    end: lastSunday.toISOString().split("T")[0],
  };
}
