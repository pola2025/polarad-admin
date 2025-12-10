/**
 * Admin 앱 - 토큰 갱신 API
 * POST: 토큰 갱신 기록
 */

import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@polarad/database";
import { requireAdmin } from "@/lib/auth";

interface RouteParams {
  params: Promise<{ clientId: string }>;
}

// POST: 토큰 갱신 기록
export async function POST(request: NextRequest, { params }: RouteParams) {
  try {
    await requireAdmin();

    const { clientId } = await params;
    const body = await request.json();
    const { accessToken, refreshToken, expiresAt, success = true, errorMessage } = body;

    // 클라이언트 확인
    const client = await prisma.client.findUnique({ where: { id: clientId } });
    if (!client) {
      return NextResponse.json(
        { success: false, error: "클라이언트를 찾을 수 없습니다." },
        { status: 404 }
      );
    }

    // 토큰 갱신 로그 생성
    const log = await prisma.tokenRefreshLog.create({
      data: {
        clientId,
        expiresAt: expiresAt ? new Date(expiresAt) : null,
        success,
        errorMessage,
      },
    });

    // 성공 시 클라이언트 토큰 정보 업데이트
    if (success && accessToken) {
      await prisma.client.update({
        where: { id: clientId },
        data: {
          metaAccessToken: accessToken,
          metaRefreshToken: refreshToken || client.metaRefreshToken,
          tokenExpiresAt: expiresAt ? new Date(expiresAt) : null,
          authStatus: "ACTIVE",
        },
      });
    }

    return NextResponse.json({
      success: true,
      data: {
        logId: log.id,
        refreshed: success,
      },
    });
  } catch (error) {
    if (error instanceof Error && error.message === "UNAUTHORIZED") {
      return NextResponse.json({ error: "인증이 필요합니다" }, { status: 401 });
    }
    console.error("[Admin API] POST /api/tokens/[clientId]/refresh error:", error);
    return NextResponse.json(
      { success: false, error: "토큰 갱신 기록에 실패했습니다." },
      { status: 500 }
    );
  }
}
