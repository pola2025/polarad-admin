/**
 * Admin 앱 - 설정 API
 * GET: 모든 설정 조회
 * POST: 설정 저장 (upsert)
 */

import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@polarad/database";
import { requireAdmin } from "@/lib/auth";

// 설정 키 목록 (허용된 설정만 저장/조회 가능)
const ALLOWED_SETTINGS = [
  "telegram_bot_token",
  "telegram_default_chat_id",
  "email_sender_address",
  "email_sender_name",
] as const;

type SettingKey = (typeof ALLOWED_SETTINGS)[number];

// GET - 모든 설정 조회
export async function GET() {
  try {
    await requireAdmin();

    const settings = await prisma.setting.findMany({
      where: {
        key: {
          in: [...ALLOWED_SETTINGS],
        },
      },
    });

    // key-value 객체로 변환
    const settingsMap: Record<string, string> = {};
    for (const setting of settings) {
      settingsMap[setting.key] = setting.value;
    }

    return NextResponse.json({
      success: true,
      data: settingsMap,
    });
  } catch (error) {
    if (error instanceof Error && error.message === "UNAUTHORIZED") {
      return NextResponse.json({ error: "인증이 필요합니다" }, { status: 401 });
    }
    console.error("[Admin API] GET /api/settings error:", error);
    return NextResponse.json(
      { success: false, error: "설정을 불러오는데 실패했습니다." },
      { status: 500 }
    );
  }
}

// POST - 설정 저장 (upsert)
export async function POST(request: NextRequest) {
  try {
    await requireAdmin();

    const body = await request.json();
    const { settings } = body as { settings: Record<string, string> };

    if (!settings || typeof settings !== "object") {
      return NextResponse.json(
        { success: false, error: "유효하지 않은 요청입니다." },
        { status: 400 }
      );
    }

    // 허용된 키만 필터링
    const validSettings: { key: SettingKey; value: string }[] = [];
    for (const [key, value] of Object.entries(settings)) {
      if (ALLOWED_SETTINGS.includes(key as SettingKey)) {
        validSettings.push({ key: key as SettingKey, value: value || "" });
      }
    }

    // 트랜잭션으로 모든 설정 저장
    await prisma.$transaction(
      validSettings.map(({ key, value }) =>
        prisma.setting.upsert({
          where: { key },
          update: { value },
          create: { key, value },
        })
      )
    );

    return NextResponse.json({
      success: true,
      message: "설정이 저장되었습니다.",
    });
  } catch (error) {
    if (error instanceof Error && error.message === "UNAUTHORIZED") {
      return NextResponse.json({ error: "인증이 필요합니다" }, { status: 401 });
    }
    console.error("[Admin API] POST /api/settings error:", error);
    return NextResponse.json(
      { success: false, error: "설정 저장에 실패했습니다." },
      { status: 500 }
    );
  }
}
