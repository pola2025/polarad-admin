/**
 * Meta Ads API 연동 모듈
 *
 * Meta Ads Insights API를 호출하여 광고 데이터를 조회합니다.
 */

export interface MetaInsight {
  date: string;
  adId: string;
  adName: string;
  campaignId: string;
  campaignName: string;
  platform: string;
  device: string;
  currency: string;
  impressions: number;
  reach: number;
  clicks: number;
  leads: number;
  spend: number;
  videoViews: number;
  avgWatchTime: number;
  costPerVideoView: number;
  costPerLead: number;
}

export interface MetaApiRawItem {
  date_start: string;
  ad_id: string;
  ad_name?: string;
  campaign_id?: string;
  campaign_name?: string;
  publisher_platform?: string;
  device_platform?: string;
  account_currency?: string;
  impressions?: string;
  reach?: string;
  inline_link_clicks?: string;
  spend?: string;
  actions?: Array<{ action_type: string; value: string }>;
  video_avg_time_watched_actions?: Array<{ action_type: string; value: string }>;
  cost_per_action_type?: Array<{ action_type: string; value: string }>;
}

export interface MetaApiResponse {
  data: MetaApiRawItem[];
  paging?: {
    next?: string;
    previous?: string;
  };
  error?: {
    message: string;
    type: string;
    code: number;
  };
}

/**
 * Actions 배열에서 특정 action_type의 값 추출
 */
export function getActionValue(
  actions: Array<{ action_type: string; value: string }> | undefined,
  actionType: string
): number {
  if (!actions || !Array.isArray(actions)) return 0;
  const action = actions.find((a) => a.action_type === actionType);
  return action ? parseInt(action.value) || 0 : 0;
}

/**
 * Video avg time watched actions에서 값 추출
 */
export function getVideoAvgTime(
  videoActions: Array<{ action_type: string; value: string }> | undefined
): number {
  if (!videoActions || !Array.isArray(videoActions)) return 0;
  const action = videoActions.find((a) => a.action_type === "video_view");
  return action ? parseFloat(action.value) || 0 : 0;
}

/**
 * Cost per action type에서 값 추출
 */
export function getCostPerAction(
  costActions: Array<{ action_type: string; value: string }> | undefined,
  actionType: string
): number {
  if (!costActions || !Array.isArray(costActions)) return 0;
  const action = costActions.find((a) => a.action_type === actionType);
  return action ? parseFloat(action.value) || 0 : 0;
}

/**
 * Meta API에서 광고 데이터 조회 (페이지네이션 지원)
 */
export async function fetchMetaAdsData(
  adAccountId: string,
  accessToken: string,
  startDate: string,
  endDate: string
): Promise<MetaApiRawItem[]> {
  const baseUrl = `https://graph.facebook.com/v22.0/${adAccountId}/insights`;

  const params = new URLSearchParams({
    access_token: accessToken,
    time_range: JSON.stringify({
      since: startDate,
      until: endDate,
    }),
    fields:
      "ad_id,ad_name,campaign_id,campaign_name,impressions,spend,inline_link_clicks,reach,actions,video_avg_time_watched_actions,cost_per_action_type,account_currency",
    breakdowns: "publisher_platform,device_platform",
    level: "ad",
    limit: "90",
    time_increment: "1",
  });

  let allData: MetaApiRawItem[] = [];
  let nextUrl: string | null = `${baseUrl}?${params}`;

  // 페이지네이션 루프
  while (nextUrl) {
    const response = await fetch(nextUrl);

    if (!response.ok) {
      const errorData = (await response.json()) as MetaApiResponse;
      throw new Error(
        `Meta API Error: ${errorData.error?.message || response.statusText}`
      );
    }

    const resJson = (await response.json()) as MetaApiResponse;

    // 데이터가 있으면 누적
    if (resJson.data && resJson.data.length > 0) {
      allData = allData.concat(resJson.data);
      console.log(
        `📦 Fetched ${resJson.data.length} records (Total: ${allData.length})`
      );
    }

    // 다음 페이지 URL 확인
    nextUrl = resJson.paging?.next || null;

    // Rate Limit 방지를 위한 짧은 대기
    if (nextUrl) {
      await new Promise((resolve) => setTimeout(resolve, 200));
    }
  }

  return allData;
}

/**
 * Meta API 원본 데이터를 MetaInsight 형식으로 변환
 */
export function transformToInsight(item: MetaApiRawItem): MetaInsight {
  return {
    date: item.date_start,
    adId: item.ad_id,
    adName: item.ad_name || "Unknown",
    campaignId: item.campaign_id || "",
    campaignName: item.campaign_name || "Unknown",
    platform: item.publisher_platform || "unknown",
    device: item.device_platform || "unknown",
    currency: item.account_currency || "KRW",
    impressions: parseInt(item.impressions || "0") || 0,
    reach: parseInt(item.reach || "0") || 0,
    clicks: parseInt(item.inline_link_clicks || "0") || 0,
    leads: getActionValue(item.actions, "lead"),
    spend: parseFloat(item.spend || "0") || 0,
    videoViews: getActionValue(item.actions, "video_view"),
    avgWatchTime: getVideoAvgTime(item.video_avg_time_watched_actions),
    costPerVideoView: getCostPerAction(item.cost_per_action_type, "video_view"),
    costPerLead: getCostPerAction(item.cost_per_action_type, "lead"),
  };
}

/**
 * Meta Access Token 검증
 */
export async function validateMetaToken(
  accessToken: string
): Promise<{ valid: boolean; userId?: string; error?: string }> {
  try {
    const response = await fetch(
      `https://graph.facebook.com/v22.0/me?access_token=${accessToken}`
    );

    if (!response.ok) {
      const data = (await response.json()) as MetaApiResponse;
      return {
        valid: false,
        error: data.error?.message || "Token validation failed",
      };
    }

    const data = (await response.json()) as { id: string; name?: string };
    return { valid: true, userId: data.id };
  } catch (error) {
    return {
      valid: false,
      error: (error as Error).message,
    };
  }
}

/**
 * Meta Ad Account 검증
 */
export async function validateAdAccount(
  adAccountId: string,
  accessToken: string
): Promise<{ valid: boolean; name?: string; error?: string }> {
  try {
    // adAccountId가 'act_'로 시작하지 않으면 추가
    const accountId = adAccountId.startsWith("act_")
      ? adAccountId
      : `act_${adAccountId}`;

    const response = await fetch(
      `https://graph.facebook.com/v22.0/${accountId}?fields=name,account_status&access_token=${accessToken}`
    );

    if (!response.ok) {
      const data = (await response.json()) as MetaApiResponse;
      return {
        valid: false,
        error: data.error?.message || "Account validation failed",
      };
    }

    const data = (await response.json()) as {
      id: string;
      name?: string;
      account_status?: number;
    };

    // account_status: 1 = ACTIVE
    if (data.account_status !== 1) {
      return {
        valid: false,
        error: `Account status is not active (status: ${data.account_status})`,
      };
    }

    return { valid: true, name: data.name };
  } catch (error) {
    return {
      valid: false,
      error: (error as Error).message,
    };
  }
}
