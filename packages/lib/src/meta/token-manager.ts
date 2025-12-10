/**
 * Token Manager - Access Token 자동 갱신
 *
 * 역할 구분:
 *
 * 1. ensureValidToken() - Worker 실행 전 동기 갱신
 *    - 데이터 수집 작업 시작 전 MUST 호출
 *    - 만료되었거나 1시간 이내 만료 예정이면 즉시 갱신
 *    - 갱신 실패 시 에러 throw (데이터 수집 중단)
 *
 * 2. refreshToken() - 토큰 갱신
 *    - Meta OAuth Token Exchange 수행
 *    - 새 토큰을 DB에 암호화하여 저장
 */

import { prisma, type AuthStatus } from "@polarad/database";
import { decrypt, encrypt } from "./encryption";

export interface TokenValidationResult {
  valid: boolean;
  accessToken?: string;
  error?: string;
}

export interface TokenRefreshResult {
  success: boolean;
  accessToken?: string;
  expiresAt?: Date;
  error?: string;
}

/**
 * TokenManager 클래스
 */
export class TokenManager {
  /**
   * [Worker 전용] 데이터 수집 전 토큰 유효성 확인 및 갱신
   */
  async ensureValidToken(clientId: string): Promise<string> {
    console.log(`🔐 Checking token validity for client ${clientId}...`);

    // 1. 클라이언트 정보 조회
    const client = await prisma.client.findUnique({
      where: { id: clientId },
      select: {
        id: true,
        clientName: true,
        tokenExpiresAt: true,
        metaAccessToken: true,
        metaRefreshToken: true,
      },
    });

    if (!client) {
      throw new Error(`Client not found: ${clientId}`);
    }

    // 2. 만료 여부 확인 (1시간 버퍼)
    const now = new Date();
    const expiresAt = client.tokenExpiresAt;
    const oneHourFromNow = new Date(now.getTime() + 3600000);

    const isExpired = expiresAt ? expiresAt < now : true;
    const isExpiringSoon = expiresAt ? expiresAt < oneHourFromNow : true;

    if (!isExpired && !isExpiringSoon && client.metaAccessToken) {
      console.log(`✅ Token is valid for client ${client.clientName}`);
      // 암호화된 토큰 복호화
      const accessToken = decrypt(client.metaAccessToken);
      if (accessToken) {
        return accessToken;
      }
    }

    // 3. 토큰 갱신 필요
    if (isExpired) {
      console.log(`⚠️ Token EXPIRED for ${client.clientName}, refreshing...`);
    } else {
      console.log(`⏰ Token expiring soon for ${client.clientName}, refreshing...`);
    }

    const refreshResult = await this.refreshToken(clientId);

    if (!refreshResult.success || !refreshResult.accessToken) {
      throw new Error(refreshResult.error || "Failed to refresh token");
    }

    console.log(`✅ Token refreshed successfully for ${client.clientName}`);
    return refreshResult.accessToken;
  }

  /**
   * OAuth Refresh Token을 사용하여 새 Access Token 발급
   */
  async refreshToken(clientId: string): Promise<TokenRefreshResult> {
    // 1. 클라이언트 및 Refresh Token 조회
    const client = await prisma.client.findUnique({
      where: { id: clientId },
      select: {
        clientName: true,
        metaRefreshToken: true,
      },
    });

    if (!client) {
      return { success: false, error: "Client not found" };
    }

    if (!client.metaRefreshToken) {
      await this.updateAuthStatus(clientId, "AUTH_REQUIRED");
      return { success: false, error: "No refresh token found" };
    }

    // Refresh Token 복호화
    const refreshToken = decrypt(client.metaRefreshToken);
    if (!refreshToken) {
      await this.updateAuthStatus(clientId, "AUTH_REQUIRED");
      return { success: false, error: "Failed to decrypt refresh token" };
    }

    // 2. Meta OAuth Token Exchange
    const metaAppId = process.env.META_APP_ID;
    const metaAppSecret = process.env.META_APP_SECRET;

    if (!metaAppId || !metaAppSecret) {
      return { success: false, error: "META_APP_ID or META_APP_SECRET not configured" };
    }

    try {
      const params = new URLSearchParams({
        grant_type: "fb_exchange_token",
        client_id: metaAppId,
        client_secret: metaAppSecret,
        fb_exchange_token: refreshToken,
      });

      const response = await fetch(
        `https://graph.facebook.com/v22.0/oauth/access_token?${params}`
      );

      if (!response.ok) {
        const errorData = await response.json();
        await this.updateAuthStatus(clientId, "TOKEN_EXPIRED");
        return {
          success: false,
          error: `Failed to refresh token: ${
            (errorData as { error?: { message?: string } }).error?.message || response.statusText
          }`,
        };
      }

      const data = await response.json() as { access_token: string; expires_in: number };

      if (!data.access_token) {
        return { success: false, error: "No access_token in Meta API response" };
      }

      // 3. 새 Access Token 암호화하여 저장
      const encryptedToken = encrypt(data.access_token);
      const expiresAt = new Date(Date.now() + data.expires_in * 1000);

      await prisma.client.update({
        where: { id: clientId },
        data: {
          metaAccessToken: encryptedToken,
          tokenExpiresAt: expiresAt,
          authStatus: "ACTIVE",
        },
      });

      // 4. 갱신 로그 저장
      await prisma.tokenRefreshLog.create({
        data: {
          clientId,
          expiresAt,
          success: true,
        },
      });

      console.log(
        `🔄 Token refreshed: expires in ${data.expires_in}s (${expiresAt.toLocaleString("ko-KR")})`
      );

      return {
        success: true,
        accessToken: data.access_token,
        expiresAt,
      };
    } catch (error) {
      await this.updateAuthStatus(clientId, "TOKEN_EXPIRED");

      // 실패 로그 저장
      await prisma.tokenRefreshLog.create({
        data: {
          clientId,
          success: false,
          errorMessage: (error as Error).message,
        },
      });

      return {
        success: false,
        error: (error as Error).message,
      };
    }
  }

  /**
   * DB에서 암호화된 Access Token 조회 후 복호화
   */
  async getAccessToken(clientId: string): Promise<string | null> {
    if (!clientId) return null;

    try {
      const client = await prisma.client.findUnique({
        where: { id: clientId },
        select: { metaAccessToken: true },
      });

      if (!client?.metaAccessToken) {
        console.warn(`⚠️ No access token found for client ${clientId}`);
        return null;
      }

      const decryptedToken = decrypt(client.metaAccessToken);
      if (decryptedToken) {
        console.log(`🔐 Token decrypted successfully for client ${clientId}`);
        return decryptedToken;
      }

      return null;
    } catch (error) {
      console.error("Token retrieval error:", error);
      return null;
    }
  }

  /**
   * Auth Status 업데이트
   */
  async updateAuthStatus(clientId: string, status: AuthStatus): Promise<void> {
    try {
      const client = await prisma.client.update({
        where: { id: clientId },
        data: { authStatus: status },
        select: { clientName: true },
      });

      console.log(`🔐 Auth status updated to '${status}' for ${client.clientName}`);

      // auth_required 또는 token_expired 상태로 변경 시 알림
      if (status === "AUTH_REQUIRED" || status === "TOKEN_EXPIRED") {
        await this.sendAuthStatusAlert(client.clientName, status);
      }
    } catch (error) {
      console.error("Failed to update auth status:", error);
    }
  }

  /**
   * Auth 상태 변경 시 텔레그램 알림 발송
   */
  private async sendAuthStatusAlert(clientName: string, status: AuthStatus): Promise<void> {
    const botToken = process.env.TELEGRAM_BOT_TOKEN;
    const adminChatId = process.env.TELEGRAM_ADMIN_CHAT_ID;

    if (!botToken || !adminChatId) {
      console.log("⚠️ Telegram credentials not set, skipping auth alert");
      return;
    }

    const emoji = status === "TOKEN_EXPIRED" ? "🚨" : "⚠️";
    const statusText = status === "TOKEN_EXPIRED" ? "토큰 만료" : "재인증 필요";
    const action =
      status === "TOKEN_EXPIRED"
        ? "토큰이 만료되어 데이터 수집이 중단되었습니다. Meta 재인증이 필요합니다."
        : "Meta 계정 재인증이 필요합니다. 토큰 갱신에 실패했습니다.";

    const message = `${emoji} <b>${clientName} - ${statusText}</b>

📋 <b>상태</b>: ${status}
⏰ <b>발생 시각</b>: ${new Date().toLocaleString("ko-KR", { timeZone: "Asia/Seoul" })} KST

📝 <b>필요 조치</b>:
${action}

━━━━━━━━━━━━━━━━━━━━
🔗 재인증 진행: 대시보드에서 Meta 연동 페이지로 이동`;

    try {
      const response = await fetch(
        `https://api.telegram.org/bot${botToken}/sendMessage`,
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            chat_id: adminChatId,
            text: message,
            parse_mode: "HTML",
          }),
        }
      );

      if (response.ok) {
        console.log("✅ Auth alert sent via Telegram");
      } else {
        const error = await response.json();
        console.error("Failed to send auth alert:", error);
      }
    } catch (error) {
      console.error("Telegram API error:", (error as Error).message);
    }
  }

  /**
   * 만료 예정 토큰 모니터링 (cron job용)
   */
  static async monitorExpiringTokens(): Promise<void> {
    console.log("🔍 Monitoring expiring tokens...");

    const sevenDaysFromNow = new Date();
    sevenDaysFromNow.setDate(sevenDaysFromNow.getDate() + 7);

    const expiringClients = await prisma.client.findMany({
      where: {
        isActive: true,
        tokenExpiresAt: {
          lte: sevenDaysFromNow,
          gte: new Date(),
        },
      },
      select: {
        id: true,
        clientName: true,
        tokenExpiresAt: true,
      },
    });

    if (expiringClients.length === 0) {
      console.log("✅ All tokens are valid (>7 days until expiry)");
      return;
    }

    // Admin 알림 메시지 생성
    let alertMessage = `⚠️ Token Expiry Alert\n\n${expiringClients.length} token(s) expiring within 7 days:\n\n`;

    expiringClients.forEach((client) => {
      const daysLeft = client.tokenExpiresAt
        ? Math.floor(
            (client.tokenExpiresAt.getTime() - Date.now()) / (1000 * 60 * 60 * 24)
          )
        : 0;
      alertMessage += `• ${client.clientName}: ${daysLeft} day(s) left\n`;
      alertMessage += `  Expires: ${client.tokenExpiresAt?.toLocaleString("ko-KR")}\n\n`;
    });

    alertMessage += `ℹ️ Note: Worker will automatically refresh tokens 1 hour before expiry.\n`;
    alertMessage += `This alert is a safety check for tokens that may need manual intervention.`;

    console.log(alertMessage);

    // Telegram Admin 알림
    await sendAdminAlert("🔐 Token Expiry Warning", alertMessage);
  }
}

/**
 * Telegram Admin 알림 함수
 */
export async function sendAdminAlert(title: string, message: string): Promise<void> {
  const telegramBotToken = process.env.TELEGRAM_BOT_TOKEN;
  const adminChatId = process.env.TELEGRAM_ADMIN_CHAT_ID;

  if (!telegramBotToken || !adminChatId) {
    console.log("⚠️ Telegram credentials not set, skipping admin alert");
    return;
  }

  try {
    const response = await fetch(
      `https://api.telegram.org/bot${telegramBotToken}/sendMessage`,
      {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          chat_id: adminChatId,
          text: `<b>${title}</b>\n\n${message}`,
          parse_mode: "HTML",
        }),
      }
    );

    if (response.ok) {
      console.log("✅ Admin alert sent via Telegram");
    } else {
      const error = await response.json();
      console.error("Failed to send Telegram alert:", error);
    }
  } catch (error) {
    console.error("Telegram API error:", (error as Error).message);
  }
}

// 싱글톤 인스턴스
export const tokenManager = new TokenManager();
