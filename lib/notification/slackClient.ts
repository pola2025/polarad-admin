/**
 * Slack 클라이언트
 * - 자료 승인 시 채널 생성 (polarad-homepage-클라이언트명)
 * - 진행 과정 기록
 */

import { WebClient } from "@slack/web-api";
import { toSlackChannelName } from "@/lib/utils/koreanToRoman";

let slackClient: WebClient | null = null;

/**
 * Slack 클라이언트 초기화
 */
function initSlackClient() {
  const SLACK_BOT_TOKEN = process.env.SLACK_BOT_TOKEN;

  if (!SLACK_BOT_TOKEN) {
    console.error("❌ [Slack] SLACK_BOT_TOKEN 환경 변수가 설정되지 않았습니다");
    return null;
  }

  if (!slackClient) {
    try {
      console.log("🔄 [Slack] 클라이언트 초기화 중...");
      slackClient = new WebClient(SLACK_BOT_TOKEN);
      console.log("✅ [Slack] 클라이언트 초기화 완료");
    } catch (error: unknown) {
      const errorMessage = error instanceof Error ? error.message : String(error);
      console.error("❌ [Slack] 클라이언트 초기화 실패:", errorMessage);
      return null;
    }
  }
  return slackClient;
}

/**
 * 채널 이름 생성
 * 규칙: polarad-homepage-{클라이언트명}
 * 예: polarad-homepage-카페블루 → polarad-homepage-kapebeullu
 */
function generateChannelName(clientName: string): string {
  const sanitized = toSlackChannelName(clientName);
  const channelName = `polarad-homepage-${sanitized}`;

  console.log(`🔄 [Slack] 채널명 생성:`);
  console.log(`  - 원본: polarad-homepage-${clientName}`);
  console.log(`  - 변환: ${channelName}`);

  return channelName.substring(0, 80);
}

/**
 * 이메일로 Slack 사용자 ID 찾기
 */
async function findUserByEmail(email: string): Promise<string | null> {
  try {
    const client = initSlackClient();
    if (!client || !email) return null;

    const result = await client.users.lookupByEmail({ email });
    return result.user?.id || null;
  } catch (error) {
    console.error("사용자 검색 실패:", error);
    return null;
  }
}

/**
 * 채널 이름으로 채널 ID 찾기
 */
async function findChannelByName(channelName: string): Promise<string | null> {
  try {
    const client = initSlackClient();
    if (!client) return null;

    const result = await client.conversations.list({
      types: "public_channel,private_channel",
      limit: 1000,
    });

    if (!result.ok || !result.channels) return null;

    const channel = result.channels.find((ch) => ch.name === channelName);
    return channel?.id || null;
  } catch (error) {
    console.error("채널 검색 실패:", error);
    return null;
  }
}

/**
 * Slack 채널 생성
 */
export async function createSlackChannel(params: {
  clientName: string;
  userName: string;
  userEmail: string;
  userPhone: string;
  brandName: string;
}): Promise<string | null> {
  try {
    console.log(`🔄 [Slack] 채널 생성 시작`, params);

    const client = initSlackClient();
    if (!client) {
      console.error("❌ [Slack] 클라이언트가 초기화되지 않았습니다");
      return null;
    }

    const channelName = generateChannelName(params.clientName);

    // 기존 채널 확인
    const existingChannel = await findChannelByName(channelName);
    if (existingChannel) {
      console.log(`✅ [Slack] 기존 채널 사용: ${channelName} (${existingChannel})`);
      return existingChannel;
    }

    // 새 채널 생성
    console.log(`🔄 [Slack] 새 채널 생성 중: ${channelName}`);
    const result = await client.conversations.create({
      name: channelName,
      is_private: false,
    });

    if (!result.ok || !result.channel?.id) {
      throw new Error(`채널 생성 실패: ${result.error || "Unknown error"}`);
    }

    const channelId = result.channel.id;

    // 관리자들을 채널에 초대
    const adminEmails = process.env.SLACK_ADMIN_EMAILS;
    const invitedUserIds: string[] = [];

    if (adminEmails) {
      const emails = adminEmails.split(",").map((e) => e.trim());

      for (const email of emails) {
        const userId = await findUserByEmail(email);
        if (userId) {
          try {
            await client.conversations.invite({
              channel: channelId,
              users: userId,
            });
            invitedUserIds.push(userId);
            console.log(`✅ 관리자(${email})를 채널에 초대했습니다`);
          } catch (error) {
            console.error(`관리자(${email}) 초대 실패:`, error);
          }
        }
      }
    }

    // 초기 메시지 전송
    const mentionText =
      invitedUserIds.length > 0
        ? `\n\n👋 ${invitedUserIds.map((id) => `<@${id}>`).join(" ")} 새로운 프로젝트가 시작되었습니다!`
        : "";

    await postMessage({
      channelId,
      text: `🎉 새로운 프로젝트 시작${mentionText}`,
      blocks: [
        {
          type: "header",
          text: {
            type: "plain_text",
            text: "🎉 새로운 홈페이지 제작 프로젝트",
          },
        },
        {
          type: "section",
          fields: [
            { type: "mrkdwn", text: `*고객명:*\n${params.userName}` },
            { type: "mrkdwn", text: `*브랜드:*\n${params.brandName}` },
            { type: "mrkdwn", text: `*연락처:*\n${params.userPhone}` },
            { type: "mrkdwn", text: `*이메일:*\n${params.userEmail}` },
          ],
        },
        ...(invitedUserIds.length > 0
          ? [
              {
                type: "section" as const,
                text: {
                  type: "mrkdwn" as const,
                  text: `👋 ${invitedUserIds.map((id) => `<@${id}>`).join(" ")} 새로운 프로젝트가 시작되었습니다!`,
                },
              },
            ]
          : []),
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

    console.log(`✅ [Slack] 채널 생성 성공: ${channelName} (${channelId})`);
    return channelId;
  } catch (error: unknown) {
    const errorMessage = error instanceof Error ? error.message : String(error);
    console.error("❌ [Slack] 채널 생성 실패:", errorMessage);
    return null;
  }
}

/**
 * 메시지 전송
 */
export async function postMessage(params: {
  channelId: string;
  text: string;
  blocks?: unknown[];
}): Promise<boolean> {
  try {
    const client = initSlackClient();
    if (!client) return false;

    const result = await client.chat.postMessage({
      channel: params.channelId,
      text: params.text,
      blocks: params.blocks as never[],
    });

    if (!result.ok) {
      throw new Error("메시지 전송 실패");
    }

    console.log(`✅ 슬랙 메시지 전송 성공: ${params.channelId}`);
    return true;
  } catch (error) {
    console.error("슬랙 메시지 전송 실패:", error);
    return false;
  }
}

/**
 * 진행 상황 로그
 */
export async function logProgress(params: {
  channelId: string;
  stage: string;
  status: string;
  details?: Record<string, string>;
  emoji?: string;
}): Promise<boolean> {
  const { channelId, stage, status, details, emoji = "📝" } = params;

  const fields: { type: string; text: string }[] = [
    { type: "mrkdwn", text: `*단계:*\n${stage}` },
    { type: "mrkdwn", text: `*상태:*\n${status}` },
  ];

  if (details) {
    Object.entries(details).forEach(([key, value]) => {
      fields.push({ type: "mrkdwn", text: `*${key}:*\n${value}` });
    });
  }

  return postMessage({
    channelId,
    text: `${emoji} ${stage} - ${status}`,
    blocks: [
      {
        type: "section",
        text: { type: "mrkdwn", text: `${emoji} *${stage}*` },
      },
      { type: "section", fields },
      {
        type: "context",
        elements: [
          {
            type: "mrkdwn",
            text: `📅 ${new Date().toLocaleString("ko-KR", { timeZone: "Asia/Seoul" })}`,
          },
        ],
      },
      { type: "divider" },
    ],
  });
}

/**
 * 상태 변경 로그
 */
export async function logStateChange(params: {
  channelId: string;
  fromState: string;
  toState: string;
  changedBy?: string;
}): Promise<boolean> {
  const emoji = getStateEmoji(params.toState);

  return logProgress({
    channelId: params.channelId,
    stage: "상태 변경",
    status: params.toState,
    details: {
      "이전 상태": params.fromState,
      "변경 후": params.toState,
      ...(params.changedBy && { 변경자: params.changedBy }),
    },
    emoji,
  });
}

/**
 * 제출 정보 푸시
 */
export async function pushSubmissionData(params: {
  channelId: string;
  submissionData: Record<string, unknown>;
}): Promise<boolean> {
  const { channelId, submissionData } = params;

  const fields: { type: string; text: string }[] = [];

  const textFields = [
    { key: "브랜드명", label: "브랜드명" },
    { key: "연락처", label: "연락처" },
    { key: "이메일", label: "이메일" },
    { key: "배송주소", label: "배송 주소" },
    { key: "홈페이지스타일", label: "홈페이지 스타일" },
    { key: "홈페이지컬러", label: "홈페이지 컬러" },
    { key: "블로그디자인노트", label: "블로그 디자인 노트" },
    { key: "추가요청사항", label: "추가 요청사항" },
  ];

  textFields.forEach(({ key, label }) => {
    const value = submissionData[key];
    if (value) {
      fields.push({
        type: "mrkdwn",
        text: `*${label}:*\n${value}`,
      });
    }
  });

  return postMessage({
    channelId,
    text: "📋 제작 정보",
    blocks: [
      {
        type: "header",
        text: { type: "plain_text", text: "📋 제작 정보" },
      },
      { type: "section", fields },
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
}

/**
 * 민감 파일 Slack 전송 (서버 저장 없음)
 */
export async function uploadSensitiveFileToSlack(params: {
  channelId: string;
  buffer: Buffer;
  fileName: string;
  title: string;
  userName?: string;
}): Promise<boolean> {
  try {
    const client = initSlackClient();
    if (!client) return false;

    console.log(`🔐 [Slack] 민감 파일 업로드 시작: ${params.title} (${params.buffer.length} bytes)`);

    const result = await client.files.uploadV2({
      channel_id: params.channelId,
      file: params.buffer,
      filename: params.fileName,
      title: params.title,
      initial_comment: `🔐 *${params.title}*${params.userName ? ` - ${params.userName}` : ""}\n_이 파일은 보안을 위해 서버에 저장되지 않습니다_`,
    });

    if (result.ok) {
      console.log(`✅ [Slack] 민감 파일 업로드 성공: ${params.title}`);
      return true;
    } else {
      console.error(`❌ [Slack] 민감 파일 업로드 실패:`, result);
      return false;
    }
  } catch (error) {
    console.error(`❌ [Slack] 민감 파일 업로드 오류:`, error);
    return false;
  }
}

/**
 * 파일 업로드
 */
export async function uploadFileToSlack(params: {
  channelId: string;
  filePath: string;
  fileName: string;
  title: string;
}): Promise<boolean> {
  try {
    const client = initSlackClient();
    if (!client) return false;

    let fileContent: Buffer;

    // URL인 경우 다운로드
    if (params.filePath.startsWith("http://") || params.filePath.startsWith("https://")) {
      const response = await fetch(params.filePath);
      if (!response.ok) {
        console.error(`파일 다운로드 실패: ${response.status}`);
        return false;
      }
      fileContent = Buffer.from(await response.arrayBuffer());
    } else {
      const fs = await import("fs");
      fileContent = fs.readFileSync(params.filePath);
    }

    const result = await client.files.uploadV2({
      channel_id: params.channelId,
      file: fileContent,
      filename: params.fileName,
      title: params.title,
      initial_comment: `📎 ${params.title}`,
    });

    return result.ok || false;
  } catch (error) {
    console.error(`파일 업로드 오류:`, error);
    return false;
  }
}

/**
 * 시안 업로드 로그
 */
export async function logDesignUpload(params: {
  channelId: string;
  itemName: string;
  designUrl: string;
  version?: number;
}): Promise<boolean> {
  const versionText = params.version ? `(버전 ${params.version})` : "";

  await postMessage({
    channelId: params.channelId,
    text: `🎨 시안 업로드: ${params.itemName} ${versionText}`,
    blocks: [
      {
        type: "section",
        text: {
          type: "mrkdwn",
          text: `🎨 *시안 업로드: ${params.itemName}* ${versionText}`,
        },
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

  return uploadFileToSlack({
    channelId: params.channelId,
    filePath: params.designUrl,
    fileName: `${params.itemName}_시안${versionText}.jpg`,
    title: `${params.itemName} 시안${versionText}`,
  });
}

function getStateEmoji(state: string): string {
  const map: Record<string, string> = {
    PENDING: "⏳",
    SUBMITTED: "📝",
    IN_PROGRESS: "🎨",
    DESIGN_UPLOADED: "👀",
    ORDER_REQUESTED: "🚀",
    ORDER_APPROVED: "✅",
    COMPLETED: "🎉",
    SHIPPED: "📦",
  };
  return map[state] || "📌";
}

export default {
  createSlackChannel,
  postMessage,
  logProgress,
  logStateChange,
  pushSubmissionData,
  uploadSensitiveFileToSlack,
  uploadFileToSlack,
  logDesignUpload,
};
