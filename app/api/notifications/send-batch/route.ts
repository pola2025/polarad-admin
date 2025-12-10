/**
 * Admin 앱 - 일괄 알림 발송 API
 * POST: 토큰 만료 알림 일괄 발송
 */

import { NextResponse } from "next/server";
import { requireAdmin } from "@/lib/auth";
import {
  sendTokenExpiryNotifications,
  sendServiceExpiryNotifications,
  cleanupOldNotificationLogs,
} from "@polarad/lib/notification";

// POST: 일괄 알림 발송
export async function POST() {
  try {
    await requireAdmin();

    // 토큰 만료 알림 발송
    const tokenResult = await sendTokenExpiryNotifications();

    // 서비스 기간 만료 알림 발송
    const serviceResult = await sendServiceExpiryNotifications();

    // 오래된 로그 정리
    const cleanedCount = await cleanupOldNotificationLogs();

    return NextResponse.json({
      success: true,
      data: {
        tokenExpiry: tokenResult,
        serviceExpiry: serviceResult,
        cleanedLogs: cleanedCount,
      },
      message: `토큰 알림 ${tokenResult.sent}건, 서비스 알림 ${serviceResult.sent}건 발송 완료`,
    });
  } catch (error) {
    if (error instanceof Error && error.message === "UNAUTHORIZED") {
      return NextResponse.json({ error: "인증이 필요합니다" }, { status: 401 });
    }
    console.error("[Admin API] POST /api/notifications/send-batch error:", error);
    return NextResponse.json(
      { success: false, error: "일괄 알림 발송에 실패했습니다." },
      { status: 500 }
    );
  }
}
