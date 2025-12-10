/**
 * Polarad 마케팅 패키지 - 관리자 텔레그램 알림
 *
 * 시스템 오류, 경고, 일반 알림 등 관리자 전용 알림 발송
 *
 * 환경변수:
 *   TELEGRAM_BOT_TOKEN - 텔레그램 봇 토큰
 *   TELEGRAM_ADMIN_CHAT_ID - 관리자 채팅 ID (기본)
 *   TELEGRAM_ERROR_CHAT_ID - 에러 알림용 채팅 ID (선택)
 */

const TELEGRAM_BOT_TOKEN = process.env.TELEGRAM_BOT_TOKEN;
const ADMIN_CHAT_ID = process.env.TELEGRAM_ERROR_CHAT_ID || process.env.TELEGRAM_ADMIN_CHAT_ID;
const TELEGRAM_API_BASE = `https://api.telegram.org/bot${TELEGRAM_BOT_TOKEN}`;

export interface AdminNotificationResult {
  success: boolean;
  error?: string;
}

/**
 * 관리자 채팅 ID 가져오기
 */
export function getAdminChatId(): string | undefined {
  return ADMIN_CHAT_ID;
}

/**
 * 관리자에게 메시지 전송
 */
async function sendToAdmin(message: string): Promise<AdminNotificationResult> {
  if (!TELEGRAM_BOT_TOKEN) {
    console.warn("[Telegram Admin] Bot token not configured");
    return { success: false, error: "Bot token not configured" };
  }

  if (!ADMIN_CHAT_ID) {
    console.warn("[Telegram Admin] Admin chat ID not configured");
    return { success: false, error: "Admin chat ID not configured" };
  }

  try {
    const response = await fetch(`${TELEGRAM_API_BASE}/sendMessage`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        chat_id: ADMIN_CHAT_ID,
        text: message,
        parse_mode: "HTML",
        disable_web_page_preview: true,
      }),
    });

    const data = await response.json();

    if (!data.ok) {
      console.error("[Telegram Admin] Send failed:", data.description);
      return { success: false, error: data.description };
    }

    return { success: true };
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : "Unknown error";
    console.error("[Telegram Admin] Send error:", errorMessage);
    return { success: false, error: errorMessage };
  }
}

/**
 * 현재 시간 포맷 (한국 시간)
 */
function getTimestamp(): string {
  return new Date().toLocaleString("ko-KR", { timeZone: "Asia/Seoul" });
}

/**
 * 관리자에게 일반 알림 전송
 */
export async function sendAdminAlert(
  title: string,
  message: string
): Promise<AdminNotificationResult> {
  const text = `📢 <b>${title}</b>
━━━━━━━━━━━━━━━━━━━━━━━━━━━━
⏰ ${getTimestamp()}

${message}`;

  const result = await sendToAdmin(text);
  if (result.success) {
    console.log(`[Telegram Admin] 알림 전송 완료: ${title}`);
  }
  return result;
}

/**
 * 관리자에게 오류 알림 전송
 */
export async function sendAdminError(
  title: string,
  error: Error | string,
  context?: Record<string, unknown>
): Promise<AdminNotificationResult> {
  const errorMessage = error instanceof Error ? error.message : error;
  const errorStack = error instanceof Error ? error.stack : undefined;

  let text = `🚨 <b>오류 발생: ${title}</b>
━━━━━━━━━━━━━━━━━━━━━━━━━━━━
⏰ ${getTimestamp()}

❌ <b>오류 메시지:</b>
<code>${errorMessage}</code>`;

  if (errorStack) {
    const shortStack = errorStack.split("\n").slice(0, 5).join("\n");
    text += `

📋 <b>Stack Trace:</b>
<code>${shortStack}</code>`;
  }

  if (context && Object.keys(context).length > 0) {
    text += `

📊 <b>컨텍스트:</b>`;
    for (const [key, value] of Object.entries(context)) {
      text += `
  • ${key}: ${JSON.stringify(value)}`;
    }
  }

  const result = await sendToAdmin(text);
  if (result.success) {
    console.log(`[Telegram Admin] 오류 알림 전송 완료: ${title}`);
  }
  return result;
}

/**
 * 관리자에게 경고 알림 전송
 */
export async function sendAdminWarning(
  title: string,
  message: string,
  details?: Record<string, unknown>
): Promise<AdminNotificationResult> {
  let text = `⚠️ <b>경고: ${title}</b>
━━━━━━━━━━━━━━━━━━━━━━━━━━━━
⏰ ${getTimestamp()}

${message}`;

  if (details && Object.keys(details).length > 0) {
    text += `

📋 <b>상세 정보:</b>`;
    for (const [key, value] of Object.entries(details)) {
      text += `
  • ${key}: ${value}`;
    }
  }

  const result = await sendToAdmin(text);
  if (result.success) {
    console.log(`[Telegram Admin] 경고 알림 전송 완료: ${title}`);
  }
  return result;
}

/**
 * 데이터 수집 실패 알림
 */
export async function notifyDataCollectionFailure(
  clientName: string,
  period: string,
  error: Error | string
): Promise<AdminNotificationResult> {
  return sendAdminError("데이터 수집 실패", error, {
    클라이언트: clientName,
    기간: period,
  });
}

/**
 * 데이터 0건 감지 알림
 */
export async function notifyZeroData(
  period: { start: string; end: string },
  stats: { leads: number; spend: number }
): Promise<AdminNotificationResult> {
  const message = `데이터 0건이 감지되었습니다.

📅 분석 기간: ${period.start} ~ ${period.end}
📊 리드: ${stats.leads}건
💵 지출: $${stats.spend.toFixed(2)}

가능한 원인:
  1. Meta API 데이터 수집 실패
  2. daily_aggregates 저장 실패
  3. 데이터 수집 스케줄러 중단

확인이 필요합니다.`;

  return sendAdminWarning("데이터 0건 감지", message);
}

/**
 * 시스템 시작 알림
 */
export async function notifySystemStart(
  mode: string,
  details?: Record<string, unknown>
): Promise<AdminNotificationResult> {
  let message = `시스템이 시작되었습니다.

모드: ${mode}`;

  if (details) {
    for (const [key, value] of Object.entries(details)) {
      message += `
${key}: ${value}`;
    }
  }

  return sendAdminAlert("시스템 시작", message);
}

/**
 * 성공 알림 (데이터 수집 완료 등)
 */
export async function sendSuccessNotification(stats: {
  totalRecords: number;
  savedRecords: number;
  failedRecords: number;
  dateRange: string;
  accountId: string;
}): Promise<AdminNotificationResult> {
  const message = `📊 <b>수집 통계:</b>
  • 총 데이터: ${stats.totalRecords}개
  • 저장 완료: ${stats.savedRecords}개
  • 실패: ${stats.failedRecords}개

📅 <b>수집 기간:</b>
  • ${stats.dateRange}

🔗 <b>광고 계정:</b>
  • ${stats.accountId}`;

  return sendAdminAlert("데이터 수집 완료", message);
}

/**
 * 백필 완료 알림 (하드코딩된 백필 채널로 전송)
 */
export async function notifyBackfillComplete(
  clientName: string,
  period: string,
  recordCount: number
): Promise<AdminNotificationResult> {
  const BACKFILL_CHAT_ID = "-1003394139746";

  if (!TELEGRAM_BOT_TOKEN) {
    console.warn("[Telegram Admin] Bot token not configured");
    return { success: false, error: "Bot token not configured" };
  }

  const text = `✅ <b>백필 완료</b>
━━━━━━━━━━━━━━━━━━━━━━━━━━━━
⏰ ${getTimestamp()}

📊 클라이언트: ${clientName}
📅 기간: ${period}
📈 레코드: ${recordCount}건`;

  try {
    const response = await fetch(`${TELEGRAM_API_BASE}/sendMessage`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        chat_id: BACKFILL_CHAT_ID,
        text,
        parse_mode: "HTML",
        disable_web_page_preview: true,
      }),
    });

    const data = await response.json();

    if (!data.ok) {
      console.error("[Telegram Admin] Backfill notification failed:", data.description);
      return { success: false, error: data.description };
    }

    console.log(`[Telegram Admin] 백필 알림 전송 완료: ${clientName}`);
    return { success: true };
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : "Unknown error";
    console.error("[Telegram Admin] Backfill notification error:", errorMessage);
    return { success: false, error: errorMessage };
  }
}
