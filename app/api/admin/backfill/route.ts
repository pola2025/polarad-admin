/**
 * Admin API - 백필 실행 (SSE 실시간 로그)
 *
 * GET: 백필 가능 여부 확인
 * POST: 백필 실행 (Server-Sent Events로 실시간 로그 스트리밍)
 */

import { NextRequest } from "next/server";
import { prisma } from "@polarad/database";
import { getCurrentAdmin } from "@/lib/auth";
import { decrypt, fetchMetaAdsData, getActionValue } from "@polarad/lib/meta";

// 날짜 포맷 (YYYY-MM-DD)
function formatDate(date: Date): string {
  return date.toISOString().split("T")[0];
}

// 현재 시간 포맷 (HH:MM:SS)
function formatTime(): string {
  return new Date().toLocaleTimeString("ko-KR", { hour12: false });
}

// 기간을 30일 단위로 분할
function splitDateRange(
  startDate: string,
  endDate: string
): Array<{ start: string; end: string }> {
  const ranges: Array<{ start: string; end: string }> = [];
  const start = new Date(startDate);
  const end = new Date(endDate);

  let current = new Date(start);

  while (current < end) {
    const rangeEnd = new Date(current);
    rangeEnd.setDate(rangeEnd.getDate() + 29);

    if (rangeEnd > end) {
      rangeEnd.setTime(end.getTime());
    }

    ranges.push({
      start: formatDate(current),
      end: formatDate(rangeEnd),
    });

    current = new Date(rangeEnd);
    current.setDate(current.getDate() + 1);
  }

  return ranges;
}

// 텔레그램 알림 발송
async function sendTelegramNotification(
  clientName: string,
  startDate: string,
  endDate: string,
  recordsFetched: number,
  recordsSaved: number,
  success: boolean,
  errorMessage?: string
): Promise<void> {
  const botToken = process.env.TELEGRAM_BOT_TOKEN;
  const chatId = "-1003394139746"; // 백필 알림 전용 채널

  if (!botToken) return;

  const emoji = success ? "✅" : "❌";
  const status = success ? "완료" : "실패";

  let message = `${emoji} **[POLARAD] 백필 ${status}**\n\n`;
  message += `📋 클라이언트: ${clientName}\n`;
  message += `📅 기간: ${startDate} ~ ${endDate}\n`;

  if (success) {
    message += `📊 수집: ${recordsFetched}건\n`;
    message += `💾 저장: ${recordsSaved}건\n`;
  } else if (errorMessage) {
    message += `\n⚠️ ${errorMessage}\n`;
  }

  message += `\n---\n🤖 POLARAD Meta Ads`;

  try {
    await fetch(`https://api.telegram.org/bot${botToken}/sendMessage`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        chat_id: chatId,
        text: message,
        parse_mode: "Markdown",
      }),
    });
  } catch (err) {
    console.error("Failed to send telegram notification:", err);
  }
}

// GET: 백필 가능 여부 확인
export async function GET(request: NextRequest) {
  const admin = await getCurrentAdmin();
  if (!admin) {
    return new Response(JSON.stringify({ error: "Unauthorized" }), {
      status: 401,
      headers: { "Content-Type": "application/json" },
    });
  }

  const { searchParams } = new URL(request.url);
  const clientId = searchParams.get("clientId");

  if (!clientId) {
    return new Response(JSON.stringify({ error: "clientId is required" }), {
      status: 400,
      headers: { "Content-Type": "application/json" },
    });
  }

  try {
    const client = await prisma.client.findUnique({
      where: { id: clientId },
      select: {
        id: true,
        clientName: true,
        metaAdAccountId: true,
        encryptedAccessToken: true,
      },
    });

    if (!client) {
      return new Response(
        JSON.stringify({
          canBackfill: false,
          error: "클라이언트를 찾을 수 없습니다.",
        }),
        {
          status: 404,
          headers: { "Content-Type": "application/json" },
        }
      );
    }

    const hasAccountId = !!client.metaAdAccountId;
    const hasToken = !!client.encryptedAccessToken;

    // 최신 데이터 날짜
    const latestData = await prisma.rawData.findFirst({
      where: { clientId },
      orderBy: { date: "desc" },
      select: { date: true },
    });

    return new Response(
      JSON.stringify({
        canBackfill: hasAccountId && hasToken,
        client: {
          id: client.id,
          name: client.clientName,
          hasAccountId,
          hasToken,
          latestDataDate: latestData?.date || null,
        },
        missingRequirements: [
          ...(!hasAccountId ? ["Meta 광고계정 ID"] : []),
          ...(!hasToken ? ["Access Token"] : []),
        ],
      }),
      {
        headers: { "Content-Type": "application/json" },
      }
    );
  } catch (error) {
    console.error("Backfill check error:", error);
    return new Response(
      JSON.stringify({ error: "Internal server error" }),
      {
        status: 500,
        headers: { "Content-Type": "application/json" },
      }
    );
  }
}

// POST: 백필 실행 (SSE)
export async function POST(request: NextRequest) {
  const admin = await getCurrentAdmin();
  if (!admin) {
    return new Response(JSON.stringify({ error: "Unauthorized" }), {
      status: 401,
      headers: { "Content-Type": "application/json" },
    });
  }

  try {
    const body = await request.json();
    const {
      clientId,
      days,
      startDate: customStart,
      endDate: customEnd,
    } = body;

    if (!clientId) {
      return new Response(JSON.stringify({ error: "clientId is required" }), {
        status: 400,
        headers: { "Content-Type": "application/json" },
      });
    }

    // 날짜 범위 결정
    let startDate: string;
    let endDate: string;

    if (customStart && customEnd) {
      startDate = customStart;
      endDate = customEnd;
    } else {
      const requestDays = days || 90;
      const end = new Date();
      end.setDate(end.getDate() - 1); // 어제까지
      const start = new Date(end);
      start.setDate(start.getDate() - (requestDays - 1));

      startDate = formatDate(start);
      endDate = formatDate(end);
    }

    // 클라이언트 정보 확인
    const client = await prisma.client.findUnique({
      where: { id: clientId },
      select: {
        id: true,
        clientName: true,
        metaAdAccountId: true,
        encryptedAccessToken: true,
      },
    });

    if (!client) {
      return new Response(
        JSON.stringify({ error: "클라이언트를 찾을 수 없습니다." }),
        {
          status: 404,
          headers: { "Content-Type": "application/json" },
        }
      );
    }

    if (!client.metaAdAccountId) {
      return new Response(
        JSON.stringify({ error: "Meta 광고계정 ID가 설정되지 않았습니다." }),
        {
          status: 400,
          headers: { "Content-Type": "application/json" },
        }
      );
    }

    // 토큰 복호화
    const accessToken = decrypt(client.encryptedAccessToken || "");
    if (!accessToken) {
      return new Response(
        JSON.stringify({
          error: "Access Token이 설정되지 않았거나 복호화에 실패했습니다.",
        }),
        {
          status: 400,
          headers: { "Content-Type": "application/json" },
        }
      );
    }

    // 기간 분할 (90일 초과 시 30일 단위)
    const totalDays = Math.ceil(
      (new Date(endDate).getTime() - new Date(startDate).getTime()) /
        (1000 * 60 * 60 * 24)
    );
    const dateRanges =
      totalDays > 90
        ? splitDateRange(startDate, endDate)
        : [{ start: startDate, end: endDate }];

    // SSE 스트림 생성
    const encoder = new TextEncoder();
    const stream = new ReadableStream({
      async start(controller) {
        const sendEvent = (event: string, data: unknown) => {
          const message = `event: ${event}\ndata: ${JSON.stringify(data)}\n\n`;
          controller.enqueue(encoder.encode(message));
        };

        const sendLog = (message: string, type: string = "info") => {
          sendEvent("log", { time: formatTime(), type, message });
        };

        try {
          sendLog(`🔍 ${client.clientName} 백필 시작`, "info");
          sendLog(`📅 기간: ${startDate} ~ ${endDate} (${totalDays}일)`, "info");

          if (dateRanges.length > 1) {
            sendLog(
              `⚠️ 90일 초과 - ${dateRanges.length}개 구간으로 분할 실행`,
              "warning"
            );
          }

          let totalFetched = 0;
          let totalSaved = 0;

          for (let i = 0; i < dateRanges.length; i++) {
            const range = dateRanges[i];
            const rangeNum = i + 1;

            sendLog(
              `\n📡 [${rangeNum}/${dateRanges.length}] ${range.start} ~ ${range.end} 수집 중...`,
              "info"
            );
            sendEvent("progress", {
              current: rangeNum,
              total: dateRanges.length,
              phase: "fetching",
              range,
            });

            // Meta API 호출
            let insights: Awaited<ReturnType<typeof fetchMetaAdsData>> = [];
            try {
              insights = await fetchMetaAdsData(
                client.metaAdAccountId!,
                accessToken,
                range.start,
                range.end
              );
            } catch (apiError) {
              sendLog(`❌ API 오류: ${apiError instanceof Error ? apiError.message : String(apiError)}`, "error");
              continue;
            }
            sendLog(`📊 ${insights.length}개 레코드 수신`, "success");
            totalFetched += insights.length;

            // 저장
            if (insights.length > 0) {
              sendLog(`💾 저장 시작...`, "info");
              sendEvent("progress", {
                current: rangeNum,
                total: dateRanges.length,
                phase: "saving",
                records: insights.length,
              });

              // raw_data에 저장 (MetaApiRawItem 스네이크 케이스 필드명 사용)
              const records = insights.map((item) => ({
                clientId,
                date: new Date(item.date_start),
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
              }));

              let savedCount = 0;
              const batchSize = 50;

              for (let j = 0; j < records.length; j += batchSize) {
                const batch = records.slice(j, j + batchSize);

                try {
                  for (const record of batch) {
                    await prisma.rawData.upsert({
                      where: {
                        clientId_date_adId_platform_device: {
                          clientId: record.clientId,
                          date: record.date,
                          adId: record.adId,
                          platform: record.platform,
                          device: record.device,
                        },
                      },
                      update: {
                        adName: record.adName,
                        campaignId: record.campaignId,
                        campaignName: record.campaignName,
                        currency: record.currency,
                        impressions: record.impressions,
                        reach: record.reach,
                        clicks: record.clicks,
                        leads: record.leads,
                        spend: record.spend,
                      },
                      create: record,
                    });
                    savedCount++;
                  }
                } catch (saveError) {
                  sendLog(
                    `⚠️ 저장 중 오류: ${(saveError as Error).message}`,
                    "warning"
                  );
                }
              }

              totalSaved += savedCount;
              sendLog(`✅ ${savedCount}건 저장 완료`, "success");
            } else {
              sendLog(`⚠️ 해당 기간 데이터 없음`, "warning");
            }

            // 구간 간 대기
            if (i < dateRanges.length - 1) {
              sendLog(`⏳ 다음 구간 대기 중...`, "info");
              await new Promise((resolve) => setTimeout(resolve, 1000));
            }
          }

          // 완료
          sendLog(`\n🎉 백필 완료!`, "success");
          sendLog(`📊 총 수집: ${totalFetched}건`, "info");
          sendLog(`💾 총 저장: ${totalSaved}건`, "info");

          sendEvent("complete", {
            success: true,
            totalRecords: totalFetched,
            savedRecords: totalSaved,
            duration: `${dateRanges.length}개 구간 처리`,
            startDate,
            endDate,
          });

          // 텔레그램 알림
          await sendTelegramNotification(
            client.clientName,
            startDate,
            endDate,
            totalFetched,
            totalSaved,
            true
          );
        } catch (error) {
          console.error("Backfill error:", error);
          const errorMessage =
            error instanceof Error ? error.message : "Unknown error";

          sendLog(`❌ 오류 발생: ${errorMessage}`, "error");
          sendEvent("error", { message: errorMessage });

          // 실패 알림
          await sendTelegramNotification(
            client.clientName,
            startDate,
            endDate,
            0,
            0,
            false,
            errorMessage
          );
        } finally {
          controller.close();
        }
      },
    });

    return new Response(stream, {
      headers: {
        "Content-Type": "text/event-stream",
        "Cache-Control": "no-cache",
        Connection: "keep-alive",
      },
    });
  } catch (error) {
    console.error("Backfill API error:", error);
    return new Response(
      JSON.stringify({
        error:
          error instanceof Error ? error.message : "Internal server error",
      }),
      {
        status: 500,
        headers: { "Content-Type": "application/json" },
      }
    );
  }
}
