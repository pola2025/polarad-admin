/**
 * Polarad 마케팅 패키지 - 알림 서비스
 * 알림 발송 및 중복 방지 로직
 */

import { prisma, NotificationType, NotificationChannel, NotificationStatus } from "@polarad/database";
import {
  sendTelegramMessage,
  formatTokenExpiryMessage,
  formatServiceExpiryMessage,
} from "../telegram";

interface SendNotificationParams {
  clientId: string;
  notificationType: NotificationType;
  message: string;
  channel?: NotificationChannel;
}

interface NotificationResult {
  success: boolean;
  logId?: string;
  error?: string;
  skipped?: boolean;
  skipReason?: string;
}

/**
 * 오늘 해당 타입의 알림이 이미 발송되었는지 확인
 */
async function hasNotificationSentToday(
  clientId: string,
  notificationType: NotificationType
): Promise<boolean> {
  const today = new Date();
  today.setHours(0, 0, 0, 0);

  const existingLog = await prisma.notificationLog.findFirst({
    where: {
      clientId,
      notificationType,
      sentAt: {
        gte: today,
      },
      status: {
        in: [NotificationStatus.SENT, NotificationStatus.DELIVERED],
      },
    },
  });

  return existingLog !== null;
}

/**
 * 알림 발송 및 로그 기록
 */
export async function sendNotification(
  params: SendNotificationParams
): Promise<NotificationResult> {
  const { clientId, notificationType, message, channel = NotificationChannel.TELEGRAM } = params;

  // 중복 체크
  const alreadySent = await hasNotificationSentToday(clientId, notificationType);
  if (alreadySent) {
    return {
      success: false,
      skipped: true,
      skipReason: "오늘 이미 발송된 알림입니다.",
    };
  }

  // 클라이언트 정보 조회
  const client = await prisma.client.findUnique({
    where: { id: clientId },
    select: {
      telegramChatId: true,
      telegramEnabled: true,
      clientName: true,
    },
  });

  if (!client) {
    return { success: false, error: "클라이언트를 찾을 수 없습니다." };
  }

  // 텔레그램 알림 발송
  if (channel === NotificationChannel.TELEGRAM) {
    if (!client.telegramEnabled || !client.telegramChatId) {
      // 알림이 비활성화된 경우 로그만 기록
      const log = await prisma.notificationLog.create({
        data: {
          clientId,
          notificationType,
          channel,
          message,
          status: NotificationStatus.FAILED,
          errorMessage: "텔레그램 알림이 비활성화되었거나 채팅 ID가 없습니다.",
        },
      });
      return {
        success: false,
        logId: log.id,
        error: "텔레그램 알림이 비활성화되었습니다.",
      };
    }

    const result = await sendTelegramMessage(client.telegramChatId, message);

    // 로그 기록
    const log = await prisma.notificationLog.create({
      data: {
        clientId,
        notificationType,
        channel,
        message,
        status: result.success ? NotificationStatus.SENT : NotificationStatus.FAILED,
        errorMessage: result.error,
      },
    });

    return {
      success: result.success,
      logId: log.id,
      error: result.error,
    };
  }

  return { success: false, error: "지원하지 않는 알림 채널입니다." };
}

/**
 * 토큰 만료 임박 클라이언트에게 알림 발송
 */
export async function sendTokenExpiryNotifications(): Promise<{
  sent: number;
  skipped: number;
  failed: number;
}> {
  const result = { sent: 0, skipped: 0, failed: 0 };

  // 토큰 만료 임박 클라이언트 조회 (14일 이내)
  const now = new Date();
  const in14Days = new Date(now.getTime() + 14 * 24 * 60 * 60 * 1000);

  const clients = await prisma.client.findMany({
    where: {
      isActive: true,
      tokenExpiresAt: {
        gte: now,
        lte: in14Days,
      },
    },
    select: {
      id: true,
      clientName: true,
      tokenExpiresAt: true,
    },
  });

  for (const client of clients) {
    if (!client.tokenExpiresAt) continue;

    const daysUntilExpiry = Math.ceil(
      (client.tokenExpiresAt.getTime() - now.getTime()) / (1000 * 60 * 60 * 24)
    );

    // 알림 유형 결정
    let notificationType: NotificationType;
    if (daysUntilExpiry <= 3) {
      notificationType = NotificationType.TOKEN_EXPIRY_CRITICAL;
    } else if (daysUntilExpiry <= 7) {
      notificationType = NotificationType.TOKEN_EXPIRY_WARNING;
    } else {
      notificationType = NotificationType.TOKEN_EXPIRY_NOTICE;
    }

    const message = formatTokenExpiryMessage(
      client.clientName,
      daysUntilExpiry,
      client.tokenExpiresAt
    );

    const sendResult = await sendNotification({
      clientId: client.id,
      notificationType,
      message,
    });

    if (sendResult.skipped) {
      result.skipped++;
    } else if (sendResult.success) {
      result.sent++;
    } else {
      result.failed++;
    }
  }

  return result;
}

/**
 * 서비스 기간 만료 임박 클라이언트에게 알림 발송
 */
export async function sendServiceExpiryNotifications(): Promise<{
  sent: number;
  skipped: number;
  failed: number;
}> {
  const result = { sent: 0, skipped: 0, failed: 0 };

  const now = new Date();
  const in14Days = new Date(now.getTime() + 14 * 24 * 60 * 60 * 1000);

  const clients = await prisma.client.findMany({
    where: {
      isActive: true,
      servicePeriodEnd: {
        gte: now,
        lte: in14Days,
      },
    },
    select: {
      id: true,
      clientName: true,
      servicePeriodEnd: true,
    },
  });

  for (const client of clients) {
    if (!client.servicePeriodEnd) continue;

    const daysUntilExpiry = Math.ceil(
      (client.servicePeriodEnd.getTime() - now.getTime()) / (1000 * 60 * 60 * 24)
    );

    const message = formatServiceExpiryMessage(
      client.clientName,
      daysUntilExpiry,
      client.servicePeriodEnd
    );

    const sendResult = await sendNotification({
      clientId: client.id,
      notificationType: NotificationType.SERVICE_EXPIRING,
      message,
    });

    if (sendResult.skipped) {
      result.skipped++;
    } else if (sendResult.success) {
      result.sent++;
    } else {
      result.failed++;
    }
  }

  return result;
}

/**
 * 오래된 알림 로그 정리 (30일 이상)
 */
export async function cleanupOldNotificationLogs(): Promise<number> {
  const thirtyDaysAgo = new Date();
  thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);

  const result = await prisma.notificationLog.deleteMany({
    where: {
      sentAt: {
        lt: thirtyDaysAgo,
      },
    },
  });

  return result.count;
}
