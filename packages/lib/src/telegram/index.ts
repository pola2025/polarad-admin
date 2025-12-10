/**
 * Polarad 마케팅 패키지 - 텔레그램 봇 클라이언트
 */

const TELEGRAM_BOT_TOKEN = process.env.TELEGRAM_BOT_TOKEN;
const TELEGRAM_API_BASE = `https://api.telegram.org/bot${TELEGRAM_BOT_TOKEN}`;

export interface TelegramSendResult {
  success: boolean;
  messageId?: number;
  error?: string;
}

/**
 * 텔레그램 메시지 발송
 */
export async function sendTelegramMessage(
  chatId: string,
  message: string,
  options?: {
    parseMode?: "HTML" | "Markdown" | "MarkdownV2";
    disableNotification?: boolean;
  }
): Promise<TelegramSendResult> {
  if (!TELEGRAM_BOT_TOKEN) {
    console.error("[Telegram] Bot token not configured");
    return { success: false, error: "Bot token not configured" };
  }

  try {
    const response = await fetch(`${TELEGRAM_API_BASE}/sendMessage`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        chat_id: chatId,
        text: message,
        parse_mode: options?.parseMode || "HTML",
        disable_notification: options?.disableNotification || false,
      }),
    });

    const data = await response.json();

    if (!data.ok) {
      console.error("[Telegram] Send failed:", data.description);
      return { success: false, error: data.description };
    }

    return {
      success: true,
      messageId: data.result.message_id,
    };
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : "Unknown error";
    console.error("[Telegram] Send error:", errorMessage);
    return { success: false, error: errorMessage };
  }
}

/**
 * 토큰 만료 알림 메시지 포맷
 */
export function formatTokenExpiryMessage(
  clientName: string,
  daysUntilExpiry: number,
  expiresAt: Date
): string {
  const expiryDate = expiresAt.toLocaleDateString("ko-KR", {
    year: "numeric",
    month: "long",
    day: "numeric",
  });

  let urgencyEmoji = "📢";
  let urgencyText = "알림";

  if (daysUntilExpiry <= 3) {
    urgencyEmoji = "🚨";
    urgencyText = "긴급";
  } else if (daysUntilExpiry <= 7) {
    urgencyEmoji = "⚠️";
    urgencyText = "경고";
  }

  return `${urgencyEmoji} <b>[Polarad] 토큰 만료 ${urgencyText}</b>

<b>클라이언트:</b> ${clientName}
<b>만료일:</b> ${expiryDate}
<b>남은 기간:</b> ${daysUntilExpiry}일

토큰이 만료되면 광고 데이터 수집이 중단됩니다.
Meta 비즈니스 관리자에서 토큰을 갱신해 주세요.`;
}

/**
 * 서비스 기간 만료 알림 메시지 포맷
 */
export function formatServiceExpiryMessage(
  clientName: string,
  daysUntilExpiry: number,
  expiresAt: Date
): string {
  const expiryDate = expiresAt.toLocaleDateString("ko-KR", {
    year: "numeric",
    month: "long",
    day: "numeric",
  });

  return `📅 <b>[Polarad] 서비스 기간 만료 안내</b>

<b>클라이언트:</b> ${clientName}
<b>만료일:</b> ${expiryDate}
<b>남은 기간:</b> ${daysUntilExpiry}일

서비스 기간 연장이 필요하시면 담당자에게 문의해 주세요.`;
}

/**
 * 일반 알림 메시지 포맷
 */
export function formatCustomMessage(
  title: string,
  content: string
): string {
  return `📬 <b>[Polarad] ${title}</b>

${content}`;
}

/**
 * 계약 승인 알림 메시지 포맷
 */
export function formatContractApprovedMessage(
  companyName: string,
  contractNumber: string,
  packageName: string,
  startDate: Date,
  endDate: Date
): string {
  const start = startDate.toLocaleDateString("ko-KR", {
    year: "numeric",
    month: "long",
    day: "numeric",
  });
  const end = endDate.toLocaleDateString("ko-KR", {
    year: "numeric",
    month: "long",
    day: "numeric",
  });

  return `✅ <b>[Polarad] 계약 승인 완료</b>

안녕하세요, ${companyName}님!

계약이 승인되었습니다.

<b>계약번호:</b> ${contractNumber}
<b>패키지:</b> ${packageName}
<b>계약기간:</b> ${start} ~ ${end}

계약서는 등록하신 이메일로 발송되었습니다.
감사합니다.`;
}

/**
 * 계약 거절 알림 메시지 포맷
 */
export function formatContractRejectedMessage(
  companyName: string,
  contractNumber: string,
  rejectReason?: string
): string {
  return `❌ <b>[Polarad] 계약 검토 결과 안내</b>

안녕하세요, ${companyName}님!

죄송합니다. 계약 요청이 승인되지 않았습니다.

<b>계약번호:</b> ${contractNumber}
<b>사유:</b> ${rejectReason || "별도 안내 예정"}

자세한 내용은 담당자에게 문의해 주세요.`;
}

/**
 * 계약 요청 접수 알림 메시지 포맷
 */
export function formatContractSubmittedMessage(
  companyName: string,
  contractNumber: string,
  packageName: string
): string {
  return `📝 <b>[Polarad] 계약 요청 접수 완료</b>

안녕하세요, ${companyName}님!

계약 요청이 정상적으로 접수되었습니다.

<b>계약번호:</b> ${contractNumber}
<b>요청 패키지:</b> ${packageName}

관리자 검토 후 승인 결과를 안내드리겠습니다.
감사합니다.`;
}
