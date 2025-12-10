/**
 * Polarad 마케팅 패키지 - 네이버 클라우드 SENS SMS 클라이언트
 *
 * 환경변수 필요:
 *   NCP_ACCESS_KEY
 *   NCP_SECRET_KEY
 *   NCP_SERVICE_ID
 *   NCP_SENDER_PHONE
 */

import { createHmac } from "crypto";

export interface SMSSendResult {
  success: boolean;
  requestId?: string;
  statusCode?: string;
  count?: number;
  error?: string;
}

export interface SMSClientOptions {
  accessKey?: string;
  secretKey?: string;
  serviceId?: string;
  senderPhone?: string;
}

export type SMSType = "SMS" | "LMS";

export class SMSClient {
  private accessKey: string;
  private secretKey: string;
  private serviceId: string;
  private senderPhone: string;

  constructor(options: SMSClientOptions = {}) {
    this.accessKey = options.accessKey || process.env.NCP_ACCESS_KEY || "";
    this.secretKey = options.secretKey || process.env.NCP_SECRET_KEY || "";
    this.serviceId = options.serviceId || process.env.NCP_SERVICE_ID || "";
    this.senderPhone = options.senderPhone || process.env.NCP_SENDER_PHONE || "";
  }

  /**
   * 환경변수 설정 확인
   */
  isConfigured(): boolean {
    return !!(this.accessKey && this.secretKey && this.serviceId && this.senderPhone);
  }

  /**
   * HMAC-SHA256 서명 생성
   */
  private makeSignature(timestamp: string, method: string, url: string): string {
    const space = " ";
    const newLine = "\n";

    const message = [method, space, url, newLine, timestamp, newLine, this.accessKey].join("");

    const hmac = createHmac("sha256", this.secretKey);
    hmac.update(message);
    return hmac.digest("base64");
  }

  /**
   * 전화번호 정규화 (하이픈 제거)
   */
  private normalizePhone(phone: string): string {
    return phone.replace(/-/g, "");
  }

  /**
   * SMS/LMS 발송
   * @param to - 수신자 전화번호 (01012345678 또는 010-1234-5678)
   * @param content - 메시지 내용
   * @param type - SMS(90byte) 또는 LMS(2000byte)
   */
  async send(to: string, content: string, type: SMSType = "LMS"): Promise<SMSSendResult> {
    if (!this.isConfigured()) {
      console.error("[SMS] NCP SENS 환경변수가 설정되지 않았습니다.");
      return { success: false, error: "NCP SENS 환경변수가 설정되지 않았습니다." };
    }

    const timestamp = Date.now().toString();
    const uri = `/sms/v2/services/${this.serviceId}/messages`;
    const url = `https://sens.apigw.ntruss.com${uri}`;

    const body = {
      type,
      from: this.normalizePhone(this.senderPhone),
      content,
      messages: [{ to: this.normalizePhone(to) }],
    };

    const signature = this.makeSignature(timestamp, "POST", uri);

    try {
      const response = await fetch(url, {
        method: "POST",
        headers: {
          "Content-Type": "application/json; charset=utf-8",
          "x-ncp-apigw-timestamp": timestamp,
          "x-ncp-iam-access-key": this.accessKey,
          "x-ncp-apigw-signature-v2": signature,
        },
        body: JSON.stringify(body),
      });

      const result = await response.json();

      if (response.ok && result.statusCode === "202") {
        console.log(`[SMS] 발송 성공: ${to}`);
        return {
          success: true,
          requestId: result.requestId,
          statusCode: result.statusCode,
        };
      } else {
        console.error(`[SMS] 발송 실패: ${result.statusMessage || result.error}`);
        return {
          success: false,
          error: result.statusMessage || result.error || "Unknown error",
          statusCode: result.statusCode,
        };
      }
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : "Unknown error";
      console.error(`[SMS] 발송 에러: ${errorMessage}`);
      return { success: false, error: errorMessage };
    }
  }

  /**
   * 여러 번호로 동시 발송
   * @param phones - 수신자 전화번호 배열
   * @param content - 메시지 내용
   * @param type - SMS(90byte) 또는 LMS(2000byte)
   */
  async sendBulk(phones: string[], content: string, type: SMSType = "LMS"): Promise<SMSSendResult> {
    if (!this.isConfigured()) {
      console.error("[SMS] NCP SENS 환경변수가 설정되지 않았습니다.");
      return { success: false, error: "NCP SENS 환경변수가 설정되지 않았습니다." };
    }

    const timestamp = Date.now().toString();
    const uri = `/sms/v2/services/${this.serviceId}/messages`;
    const url = `https://sens.apigw.ntruss.com${uri}`;

    const messages = phones.map((phone) => ({
      to: this.normalizePhone(phone),
    }));

    const body = {
      type,
      from: this.normalizePhone(this.senderPhone),
      content,
      messages,
    };

    const signature = this.makeSignature(timestamp, "POST", uri);

    try {
      const response = await fetch(url, {
        method: "POST",
        headers: {
          "Content-Type": "application/json; charset=utf-8",
          "x-ncp-apigw-timestamp": timestamp,
          "x-ncp-iam-access-key": this.accessKey,
          "x-ncp-apigw-signature-v2": signature,
        },
        body: JSON.stringify(body),
      });

      const result = await response.json();

      if (response.ok && result.statusCode === "202") {
        console.log(`[SMS] 대량 발송 성공: ${phones.length}건`);
        return {
          success: true,
          requestId: result.requestId,
          statusCode: result.statusCode,
          count: phones.length,
        };
      } else {
        console.error(`[SMS] 대량 발송 실패: ${result.statusMessage || result.error}`);
        return {
          success: false,
          error: result.statusMessage || result.error || "Unknown error",
          statusCode: result.statusCode,
        };
      }
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : "Unknown error";
      console.error(`[SMS] 대량 발송 에러: ${errorMessage}`);
      return { success: false, error: errorMessage };
    }
  }
}

// 싱글톤 인스턴스
let smsClientInstance: SMSClient | null = null;

/**
 * SMS 클라이언트 싱글톤 인스턴스 가져오기
 */
export function getSMSClient(): SMSClient {
  if (!smsClientInstance) {
    smsClientInstance = new SMSClient();
  }
  return smsClientInstance;
}

/**
 * 간편 SMS 발송 함수
 */
export async function sendSMS(
  to: string,
  content: string,
  type: SMSType = "LMS"
): Promise<SMSSendResult> {
  return getSMSClient().send(to, content, type);
}

/**
 * 간편 대량 SMS 발송 함수
 */
export async function sendBulkSMS(
  phones: string[],
  content: string,
  type: SMSType = "LMS"
): Promise<SMSSendResult> {
  return getSMSClient().sendBulk(phones, content, type);
}
