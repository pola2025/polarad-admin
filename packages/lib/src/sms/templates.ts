/**
 * Polarad 마케팅 패키지 - SMS 메시지 템플릿
 *
 * 서비스 연장 안내, 결제 확인 등 SMS 메시지 템플릿
 */

export const SERVICE_NAME = "Polarad 광고 리포트";

export const PAYMENT_INFO = {
  monthlyPrice: 220000, // 월 22만원 (VAT 포함)
  quarterlyPrice: 660000, // 3개월 66만원
  bank: "우리은행",
  accountNumber: "1005-302-954803",
  accountHolder: "폴라애드 이재호",
  cardPaymentUrl: "https://booking.naver.com/booking/5/bizes/1304508/items/6516411",
  contactPhone: "010-9897-9834",
} as const;

export type SMSTemplateType = "d7" | "d3" | "d0" | "expired" | "payment_confirm" | "welcome";

export interface SMSTemplateParams {
  clientName: string;
  endDate?: string;
  startDate?: string;
  amount?: number;
}

/**
 * 메시지 템플릿 - D-7 (만료 7일 전)
 */
export function getD7Message(clientName: string, endDate: string): string {
  return `[${SERVICE_NAME}] 서비스 연장 안내

안녕하세요, ${clientName} 대표님
광고 리포트 서비스가 곧 만료됩니다.

■ 만료일: ${endDate}
■ 남은기간: 7일

연장을 원하시면 아래 안내를 확인해주세요.

▶ 3개월 이용료: ${PAYMENT_INFO.quarterlyPrice.toLocaleString()}원(VAT포함)
  (월 ${PAYMENT_INFO.monthlyPrice.toLocaleString()}원 × 3개월)

▶ 이체결제
${PAYMENT_INFO.bank} ${PAYMENT_INFO.accountNumber}
${PAYMENT_INFO.accountHolder}

▶ 카드결제
${PAYMENT_INFO.cardPaymentUrl}
※ 금액 맞춰서 결제 (오늘 제외 아무날짜 선택)

감사합니다.`;
}

/**
 * 메시지 템플릿 - D-3 (만료 3일 전)
 */
export function getD3Message(clientName: string, endDate: string): string {
  return `[${SERVICE_NAME}] 서비스 만료 D-3 안내

${clientName} 대표님, 서비스가 3일 후 만료됩니다.

■ 만료일: ${endDate}

미연장 시 서비스가 자동 종료되며,
광고 데이터 리포트를 받아보실 수 없습니다.

▶ 3개월 연장: ${PAYMENT_INFO.quarterlyPrice.toLocaleString()}원(VAT포함)

▶ 이체: ${PAYMENT_INFO.bank} ${PAYMENT_INFO.accountNumber} (${PAYMENT_INFO.accountHolder})
▶ 카드: ${PAYMENT_INFO.cardPaymentUrl}`;
}

/**
 * 메시지 템플릿 - D-0 (만료 당일)
 */
export function getD0Message(clientName: string, endDate: string): string {
  return `[${SERVICE_NAME}] 서비스 만료 당일 안내

${clientName} 대표님, 오늘 서비스가 만료됩니다.

■ 만료일: ${endDate} (오늘)

결제 미확인 시 자동 종료됩니다.

▶ 3개월 연장: ${PAYMENT_INFO.quarterlyPrice.toLocaleString()}원
▶ 이체: ${PAYMENT_INFO.bank} ${PAYMENT_INFO.accountNumber}
▶ 카드: ${PAYMENT_INFO.cardPaymentUrl}`;
}

/**
 * 메시지 템플릿 - D+1 (만료 후 1일, 서비스 종료 안내)
 */
export function getExpiredMessage(clientName: string, endDate: string): string {
  return `[${SERVICE_NAME}] 서비스 종료 안내

${clientName} 대표님, 서비스가 종료되었습니다.

■ 종료일: ${endDate}

재이용을 원하시면 결제 후 연락주세요.

▶ 3개월: ${PAYMENT_INFO.quarterlyPrice.toLocaleString()}원(VAT포함)
▶ 이체: ${PAYMENT_INFO.bank} ${PAYMENT_INFO.accountNumber} (${PAYMENT_INFO.accountHolder})
▶ 카드: ${PAYMENT_INFO.cardPaymentUrl}

그동안 이용해주셔서 감사합니다.`;
}

/**
 * 메시지 템플릿 - 결제 확인
 */
export function getPaymentConfirmMessage(
  clientName: string,
  amount: number,
  startDate: string,
  endDate: string
): string {
  return `[${SERVICE_NAME}] 결제 확인 안내

${clientName} 대표님, 결제가 확인되었습니다.
감사합니다!

■ 결제금액: ${amount.toLocaleString()}원
■ 연장기간: ${startDate} ~ ${endDate}

앞으로도 효율적인 광고 운영을
도와드리겠습니다.`;
}

/**
 * 메시지 템플릿 - 서비스 시작 안내
 */
export function getWelcomeMessage(clientName: string, startDate: string, endDate: string): string {
  return `[${SERVICE_NAME}] 서비스 시작 안내

${clientName} 대표님, 안녕하세요!
Polarad 광고 리포트 서비스가 시작되었습니다.

■ 서비스 기간: ${startDate} ~ ${endDate}

매주 광고 성과 리포트를 받아보실 수 있습니다.
문의사항은 ${PAYMENT_INFO.contactPhone}로 연락주세요.

감사합니다.`;
}

/**
 * 메시지 타입별 템플릿 가져오기
 */
export function getMessage(type: SMSTemplateType, params: SMSTemplateParams): string {
  switch (type) {
    case "d7":
      return getD7Message(params.clientName, params.endDate || "");
    case "d3":
      return getD3Message(params.clientName, params.endDate || "");
    case "d0":
      return getD0Message(params.clientName, params.endDate || "");
    case "expired":
      return getExpiredMessage(params.clientName, params.endDate || "");
    case "payment_confirm":
      return getPaymentConfirmMessage(
        params.clientName,
        params.amount || 0,
        params.startDate || "",
        params.endDate || ""
      );
    case "welcome":
      return getWelcomeMessage(params.clientName, params.startDate || "", params.endDate || "");
    default:
      throw new Error(`Unknown message type: ${type}`);
  }
}

/**
 * 날짜 포맷 헬퍼 (YYYY-MM-DD)
 */
export function formatDate(date: Date): string {
  return date.toISOString().split("T")[0];
}

/**
 * 날짜 포맷 헬퍼 (YYYY년 M월 D일)
 */
export function formatDateKorean(date: Date): string {
  return date.toLocaleDateString("ko-KR", {
    year: "numeric",
    month: "long",
    day: "numeric",
  });
}
