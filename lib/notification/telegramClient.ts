/**
 * Telegram 클라이언트
 * - 즉시 알림 발송
 * - 관리자 및 사용자 알림
 */

const TELEGRAM_BOT_TOKEN = process.env.TELEGRAM_BOT_TOKEN;
const TELEGRAM_API = `https://api.telegram.org/bot${TELEGRAM_BOT_TOKEN}`;
const TELEGRAM_ADMIN_CHAT_ID = process.env.TELEGRAM_ADMIN_CHAT_ID;

interface TelegramResponse {
  ok: boolean;
  result?: unknown;
  description?: string;
}

/**
 * 텔레그램 메시지 발송
 */
export async function sendTelegramMessage(
  chatId: string,
  message: string,
  options?: { parseMode?: "HTML" | "Markdown" }
): Promise<TelegramResponse> {
  if (!TELEGRAM_BOT_TOKEN) {
    console.error("❌ [Telegram] TELEGRAM_BOT_TOKEN이 설정되지 않았습니다");
    return { ok: false, description: "Bot token not configured" };
  }

  try {
    const response = await fetch(`${TELEGRAM_API}/sendMessage`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        chat_id: chatId,
        text: message,
        parse_mode: options?.parseMode || "HTML",
      }),
    });

    const result = await response.json();

    if (result.ok) {
      console.log(`✅ [Telegram] 메시지 발송 성공: ${chatId}`);
    } else {
      console.error(`❌ [Telegram] 메시지 발송 실패:`, result.description);
    }

    return result;
  } catch (error) {
    console.error("❌ [Telegram] 메시지 발송 오류:", error);
    return { ok: false, description: String(error) };
  }
}

/**
 * 관리자에게 알림 발송
 */
export async function sendAdminNotification(message: string): Promise<TelegramResponse> {
  if (!TELEGRAM_ADMIN_CHAT_ID) {
    console.error("❌ [Telegram] TELEGRAM_ADMIN_CHAT_ID가 설정되지 않았습니다");
    return { ok: false, description: "Admin chat ID not configured" };
  }

  return sendTelegramMessage(TELEGRAM_ADMIN_CHAT_ID, message);
}

/**
 * 이벤트별 알림 템플릿
 */
export const NotificationTemplates = {
  // Submission 관련
  submissionReceived: (userName: string, clientName: string) =>
    `📥 <b>새 자료 제출</b>\n\n${userName}님(${clientName})이 자료를 제출했습니다.\n관리자 페이지에서 확인해주세요.`,

  submissionApproved: (userName: string, brandName: string) =>
    `✅ <b>자료 승인 완료</b>\n\n${userName}님의 "${brandName}" 자료가 승인되었습니다.\n워크플로우가 생성되어 제작이 시작됩니다.`,

  // Workflow 관련
  workflowStatusChanged: (workflowType: string, newStatus: string) =>
    `🔄 <b>진행 상태 변경</b>\n\n${workflowType}: ${newStatus}`,

  designUploaded: (workflowType: string) =>
    `🎨 <b>시안 업로드</b>\n\n${workflowType} 시안이 업로드되었습니다.\n대시보드에서 확인해주세요.`,

  workflowCompleted: (workflowType: string) =>
    `🎉 <b>제작 완료</b>\n\n${workflowType} 제작이 완료되었습니다.`,

  shipped: (workflowType: string, trackingNumber: string, courier?: string) =>
    `📦 <b>배송 시작</b>\n\n${workflowType}이(가) 발송되었습니다.\n${courier ? `택배사: ${courier}\n` : ""}운송장: ${trackingNumber}`,

  // 일반
  welcome: (userName: string) =>
    `👋 <b>환영합니다!</b>\n\n${userName}님, Polarad에 오신 것을 환영합니다.\n자료를 제출하시면 홈페이지 제작이 시작됩니다.`,
};

/**
 * 상태별 한글 변환
 */
export function getStatusKorean(status: string): string {
  const statusMap: Record<string, string> = {
    PENDING: "대기 중",
    SUBMITTED: "제출됨",
    IN_PROGRESS: "진행 중",
    DESIGN_UPLOADED: "시안 업로드",
    ORDER_REQUESTED: "발주 요청",
    ORDER_APPROVED: "발주 승인",
    COMPLETED: "완료",
    SHIPPED: "배송 완료",
    DRAFT: "작성 중",
    IN_REVIEW: "검토 중",
    APPROVED: "승인됨",
    REJECTED: "반려됨",
  };

  return statusMap[status] || status;
}

export default {
  sendTelegramMessage,
  sendAdminNotification,
  NotificationTemplates,
  getStatusKorean,
};
