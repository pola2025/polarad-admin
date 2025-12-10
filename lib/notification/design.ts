/**
 * 시안(Design) 알림 모듈
 * - 고객: Email (Resend) + SMS (NCP SENS)
 * - 관리자: Telegram + Slack
 */

import { sendTelegramMessage, sendAdminNotification } from "./telegramClient";
import { postMessage, logProgress } from "./slackClient";
import { prisma, WorkflowType, Design } from "@polarad/database";
import { Resend } from "resend";

// SMS 클라이언트 (NCP SENS)
async function sendSMS(to: string, content: string): Promise<boolean> {
  const accessKey = process.env.NCP_ACCESS_KEY;
  const secretKey = process.env.NCP_SECRET_KEY;
  const serviceId = process.env.NCP_SERVICE_ID;
  const senderPhone = process.env.NCP_SENDER_PHONE;

  if (!accessKey || !secretKey || !serviceId || !senderPhone) {
    console.log("[SMS] NCP SENS 환경변수 미설정");
    return false;
  }

  try {
    const { createHmac } = await import("crypto");
    const timestamp = Date.now().toString();
    const uri = `/sms/v2/services/${serviceId}/messages`;
    const url = `https://sens.apigw.ntruss.com${uri}`;

    const message = ["POST", " ", uri, "\n", timestamp, "\n", accessKey].join("");
    const signature = createHmac("sha256", secretKey).update(message).digest("base64");

    const response = await fetch(url, {
      method: "POST",
      headers: {
        "Content-Type": "application/json; charset=utf-8",
        "x-ncp-apigw-timestamp": timestamp,
        "x-ncp-iam-access-key": accessKey,
        "x-ncp-apigw-signature-v2": signature,
      },
      body: JSON.stringify({
        type: "LMS",
        from: senderPhone.replace(/-/g, ""),
        content,
        messages: [{ to: to.replace(/-/g, "") }],
      }),
    });

    const result = await response.json();
    if (response.ok && result.statusCode === "202") {
      console.log(`✅ [SMS] 발송 성공: ${to}`);
      return true;
    } else {
      console.error(`❌ [SMS] 발송 실패:`, result);
      return false;
    }
  } catch (error) {
    console.error(`❌ [SMS] 발송 오류:`, error);
    return false;
  }
}

// Resend 이메일 클라이언트
// 동일 계정 사용: polaai.co.kr 도메인
async function sendEmail(to: string, subject: string, html: string): Promise<boolean> {
  const apiKey = process.env.RESEND_API_KEY;
  // polaai.co.kr 도메인 사용 (startpackage와 동일 계정)
  const fromEmail = process.env.RESEND_FROM_EMAIL || "noreply@polaai.co.kr";

  if (!apiKey) {
    console.log("[Email] RESEND_API_KEY 환경변수 미설정");
    return false;
  }

  try {
    const resend = new Resend(apiKey);
    const { error } = await resend.emails.send({
      from: `Polarad <${fromEmail}>`,
      to: [to],
      subject,
      html,
    });

    if (error) {
      console.error(`❌ [Email] 발송 실패:`, error);
      return false;
    }

    console.log(`✅ [Email] 발송 성공: ${to}`);
    return true;
  } catch (error) {
    console.error(`❌ [Email] 발송 오류:`, error);
    return false;
  }
}

const ADMIN_PANEL_URL = process.env.NEXT_PUBLIC_ADMIN_URL || "https://admin.polarad.kr";
const CLIENT_PANEL_URL = process.env.NEXT_PUBLIC_CLIENT_URL || "https://my.polarad.kr";

// 워크플로우 타입 한글 변환
const WORKFLOW_TYPE_KOREAN: Record<string, string> = {
  NAMECARD: "명함",
  NAMETAG: "명찰",
  CONTRACT: "계약서",
  ENVELOPE: "대봉투",
  WEBSITE: "홈페이지",
  BLOG: "블로그",
  META_ADS: "메타광고",
  NAVER_ADS: "네이버광고",
};

interface DesignNotificationParams {
  type: "DESIGN_UPLOADED" | "DESIGN_FEEDBACK" | "DESIGN_APPROVED" | "DESIGN_VERSION_ADDED" | "REVISION_REQUESTED";
  design: Design | { id: string; workflowId: string; currentVersion: number };
  user: {
    id: string;
    name: string;
    clientName: string;
    email?: string;
    phone?: string;
  };
  workflowType: WorkflowType | string;
  feedbackContent?: string;
}

/**
 * 시안 알림 발송
 * - 고객: Email + SMS
 * - 관리자: Telegram + Slack
 */
export async function sendDesignNotification(params: DesignNotificationParams): Promise<void> {
  const { type, design, user, workflowType, feedbackContent } = params;

  const typeKorean = WORKFLOW_TYPE_KOREAN[workflowType] || workflowType;
  const designUrl = `${CLIENT_PANEL_URL}/dashboard/designs/${design.id}`;

  // 1. 고객 알림 (Email + SMS)
  if (type === "DESIGN_UPLOADED" || type === "DESIGN_VERSION_ADDED" || type === "DESIGN_FEEDBACK") {
    // Email 발송
    if (user.email) {
      const emailContent = getEmailContent(type, {
        typeKorean,
        version: design.currentVersion,
        feedbackContent,
        designUrl,
        userName: user.name,
      });

      if (emailContent) {
        await sendEmail(user.email, emailContent.subject, emailContent.html);

        // 알림 기록 저장
        await prisma.userNotification.create({
          data: {
            userId: user.id,
            type: getNotificationType(type),
            channel: "EMAIL",
            title: emailContent.subject,
            message: emailContent.subject,
            status: "SENT",
          },
        });
      }
    }

    // SMS 발송
    if (user.phone) {
      const smsContent = getSMSContent(type, {
        typeKorean,
        version: design.currentVersion,
        feedbackContent,
      });

      if (smsContent) {
        await sendSMS(user.phone, smsContent);

        // 알림 기록 저장
        await prisma.userNotification.create({
          data: {
            userId: user.id,
            type: getNotificationType(type),
            channel: "SMS",
            title: `${typeKorean} 시안 알림`,
            message: smsContent,
            status: "SENT",
          },
        });
      }
    }
  }

  // 2. 관리자 Telegram 알림 (중요 이벤트만)
  if (type === "REVISION_REQUESTED" || type === "DESIGN_APPROVED") {
    const adminMessage = getAdminTelegramMessage(type, {
      userName: user.name,
      clientName: user.clientName,
      typeKorean,
      version: design.currentVersion,
      feedbackContent,
      designUrl: `${ADMIN_PANEL_URL}/designs/${design.id}`,
    });

    if (adminMessage) {
      await sendAdminNotification(adminMessage);
    }
  }

  // 3. 관리자 Slack 알림
  const submission = await prisma.submission.findFirst({
    where: { userId: user.id },
    select: { slackChannelId: true },
  });

  if (submission?.slackChannelId) {
    await sendSlackNotification(type, {
      channelId: submission.slackChannelId,
      userName: user.name,
      clientName: user.clientName,
      typeKorean,
      version: design.currentVersion,
      feedbackContent,
      designUrl: `${ADMIN_PANEL_URL}/designs/${design.id}`,
    });
  }
}

/**
 * 이메일 내용 생성
 */
function getEmailContent(
  type: DesignNotificationParams["type"],
  params: {
    typeKorean: string;
    version: number;
    feedbackContent?: string;
    designUrl: string;
    userName: string;
  }
): { subject: string; html: string } | null {
  const { typeKorean, version, feedbackContent, designUrl, userName } = params;

  switch (type) {
    case "DESIGN_UPLOADED":
    case "DESIGN_VERSION_ADDED":
      return {
        subject: `[Polarad] ${typeKorean} 시안이 업로드되었습니다`,
        html: `
          <div style="font-family: 'Pretendard', -apple-system, sans-serif; max-width: 600px; margin: 0 auto; padding: 20px;">
            <h2 style="color: #1a1a1a;">🎨 ${typeKorean} 시안 업로드</h2>
            <p style="color: #4b5563; line-height: 1.6;">
              안녕하세요, ${userName}님!<br><br>
              ${typeKorean} 시안(v${version})이 업로드되었습니다.<br>
              아래 버튼을 클릭하여 시안을 확인하고 피드백을 남겨주세요.
            </p>
            <div style="margin: 30px 0;">
              <a href="${designUrl}"
                 style="background: #2563eb; color: white; padding: 12px 24px; border-radius: 8px; text-decoration: none; display: inline-block;">
                시안 확인하기
              </a>
            </div>
            <p style="color: #9ca3af; font-size: 14px;">
              이 메일은 Polarad에서 자동 발송되었습니다.
            </p>
          </div>
        `,
      };

    case "DESIGN_FEEDBACK":
      return {
        subject: `[Polarad] ${typeKorean} 시안에 답변이 등록되었습니다`,
        html: `
          <div style="font-family: 'Pretendard', -apple-system, sans-serif; max-width: 600px; margin: 0 auto; padding: 20px;">
            <h2 style="color: #1a1a1a;">💬 관리자 답변</h2>
            <p style="color: #4b5563; line-height: 1.6;">
              안녕하세요, ${userName}님!<br><br>
              ${typeKorean} 시안에 관리자 답변이 등록되었습니다.
            </p>
            ${feedbackContent ? `
              <div style="background: #f3f4f6; padding: 16px; border-radius: 8px; margin: 20px 0;">
                <p style="color: #374151; margin: 0;">"${feedbackContent.substring(0, 200)}${feedbackContent.length > 200 ? "..." : ""}"</p>
              </div>
            ` : ""}
            <div style="margin: 30px 0;">
              <a href="${designUrl}"
                 style="background: #2563eb; color: white; padding: 12px 24px; border-radius: 8px; text-decoration: none; display: inline-block;">
                시안 확인하기
              </a>
            </div>
            <p style="color: #9ca3af; font-size: 14px;">
              이 메일은 Polarad에서 자동 발송되었습니다.
            </p>
          </div>
        `,
      };

    default:
      return null;
  }
}

/**
 * SMS 내용 생성
 */
function getSMSContent(
  type: DesignNotificationParams["type"],
  params: {
    typeKorean: string;
    version: number;
    feedbackContent?: string;
  }
): string | null {
  const { typeKorean, version } = params;

  switch (type) {
    case "DESIGN_UPLOADED":
    case "DESIGN_VERSION_ADDED":
      return `[Polarad] ${typeKorean} 시안(v${version})이 업로드되었습니다. 마이페이지에서 확인해주세요.`;

    case "DESIGN_FEEDBACK":
      return `[Polarad] ${typeKorean} 시안에 관리자 답변이 등록되었습니다. 마이페이지에서 확인해주세요.`;

    default:
      return null;
  }
}

/**
 * 관리자 Telegram 메시지 생성
 */
function getAdminTelegramMessage(
  type: DesignNotificationParams["type"],
  params: {
    userName: string;
    clientName: string;
    typeKorean: string;
    version: number;
    feedbackContent?: string;
    designUrl: string;
  }
): string | null {
  const { userName, clientName, typeKorean, version, feedbackContent, designUrl } = params;

  switch (type) {
    case "REVISION_REQUESTED":
      return `⚠️ <b>[수정 요청] ${clientName}</b>

📋 ${typeKorean} v${version}
👤 ${userName}

💬 고객 메시지:
"${feedbackContent?.substring(0, 150) || "(내용 없음)"}${(feedbackContent?.length || 0) > 150 ? "..." : ""}"

🔗 ${designUrl}`;

    case "DESIGN_APPROVED":
      return `✅ <b>[시안 확정] ${clientName}</b>

📋 ${typeKorean} v${version}
👤 ${userName}

시안이 최종 확정되었습니다.
제작을 진행해주세요.

🔗 ${designUrl}`;

    default:
      return null;
  }
}

/**
 * 알림 타입 매핑
 */
function getNotificationType(type: DesignNotificationParams["type"]): "DESIGN_UPLOADED" | "DESIGN_FEEDBACK" | "DESIGN_APPROVED" {
  switch (type) {
    case "DESIGN_UPLOADED":
    case "DESIGN_VERSION_ADDED":
      return "DESIGN_UPLOADED";
    case "DESIGN_FEEDBACK":
      return "DESIGN_FEEDBACK";
    case "DESIGN_APPROVED":
    case "REVISION_REQUESTED":
      return "DESIGN_APPROVED";
    default:
      return "DESIGN_UPLOADED";
  }
}

/**
 * Slack 알림 발송
 */
async function sendSlackNotification(
  type: DesignNotificationParams["type"],
  params: {
    channelId: string;
    userName: string;
    clientName: string;
    typeKorean: string;
    version: number;
    feedbackContent?: string;
    designUrl: string;
  }
): Promise<void> {
  const { channelId, userName, clientName, typeKorean, version, feedbackContent, designUrl } = params;

  switch (type) {
    case "DESIGN_UPLOADED":
    case "DESIGN_VERSION_ADDED":
      await logProgress({
        channelId,
        stage: `${typeKorean} 시안`,
        status: `v${version} 업로드 완료`,
        details: {
          "버전": `v${version}`,
          "관리자 페이지": designUrl,
        },
        emoji: "🎨",
      });
      break;

    case "REVISION_REQUESTED":
      await postMessage({
        channelId,
        text: `⚠️ [수정 요청] ${clientName} - ${typeKorean}`,
        blocks: [
          {
            type: "section",
            text: {
              type: "mrkdwn",
              text: `⚠️ *[수정 요청] ${clientName}*`,
            },
          },
          {
            type: "section",
            fields: [
              { type: "mrkdwn", text: `*고객명:*\n${userName}` },
              { type: "mrkdwn", text: `*시안 종류:*\n${typeKorean}` },
              { type: "mrkdwn", text: `*버전:*\nv${version}` },
            ],
          },
          {
            type: "section",
            text: {
              type: "mrkdwn",
              text: `*고객 메시지:*\n> ${feedbackContent || "(내용 없음)"}`,
            },
          },
          {
            type: "actions",
            elements: [
              {
                type: "button",
                text: { type: "plain_text", text: "🔗 시안 관리 바로가기" },
                url: designUrl,
              },
            ],
          },
          {
            type: "context",
            elements: [
              {
                type: "mrkdwn",
                text: `📅 ${new Date().toLocaleString("ko-KR", { timeZone: "Asia/Seoul" })}`,
              },
            ],
          },
        ],
      });
      break;

    case "DESIGN_APPROVED":
      await logProgress({
        channelId,
        stage: `${typeKorean} 시안`,
        status: "고객 확정",
        details: {
          "확정 버전": `v${version}`,
          "고객": userName,
        },
        emoji: "✅",
      });
      break;

    case "DESIGN_FEEDBACK":
      // 관리자 피드백은 Slack에 별도 로그 불필요
      break;
  }
}

/**
 * 고객 피드백/수정요청 시 관리자 알림
 */
export async function sendFeedbackToAdmin(params: {
  design: { id: string; currentVersion: number };
  user: {
    id: string;
    name: string;
    clientName: string;
  };
  workflowType: string;
  feedbackContent: string;
  isRevisionRequest: boolean;
}): Promise<void> {
  const { design, user, workflowType, feedbackContent, isRevisionRequest } = params;

  const typeKorean = WORKFLOW_TYPE_KOREAN[workflowType] || workflowType;

  // Slack 알림
  const submission = await prisma.submission.findFirst({
    where: { userId: user.id },
    select: { slackChannelId: true },
  });

  if (submission?.slackChannelId) {
    await sendSlackNotification(isRevisionRequest ? "REVISION_REQUESTED" : "DESIGN_FEEDBACK", {
      channelId: submission.slackChannelId,
      userName: user.name,
      clientName: user.clientName,
      typeKorean,
      version: design.currentVersion,
      feedbackContent,
      designUrl: `${ADMIN_PANEL_URL}/designs/${design.id}`,
    });
  }

  // Telegram 알림 (수정 요청만)
  if (isRevisionRequest) {
    const adminMessage = getAdminTelegramMessage("REVISION_REQUESTED", {
      userName: user.name,
      clientName: user.clientName,
      typeKorean,
      version: design.currentVersion,
      feedbackContent,
      designUrl: `${ADMIN_PANEL_URL}/designs/${design.id}`,
    });

    if (adminMessage) {
      await sendAdminNotification(adminMessage);
    }
  }
}

export default {
  sendDesignNotification,
  sendFeedbackToAdmin,
};
