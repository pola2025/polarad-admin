/**
 * Admin 앱 - 클라이언트 상세 API
 * GET: 클라이언트 상세 조회
 * PATCH: 클라이언트 정보 수정
 * DELETE: 클라이언트 삭제
 */

import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@polarad/database";
import { requireAdmin } from "@/lib/auth";

interface RouteParams {
  params: Promise<{ id: string }>;
}

// GET: 클라이언트 상세 조회
export async function GET(request: NextRequest, { params }: RouteParams) {
  try {
    await requireAdmin();
    const { id } = await params;

    const client = await prisma.client.findUnique({
      where: { id },
      include: {
        notificationLogs: {
          orderBy: { sentAt: "desc" },
          take: 10,
        },
        tokenRefreshLogs: {
          orderBy: { refreshedAt: "desc" },
          take: 5,
        },
      },
    });

    if (!client) {
      return NextResponse.json(
        { success: false, error: "클라이언트를 찾을 수 없습니다." },
        { status: 404 }
      );
    }

    return NextResponse.json({ success: true, data: client });
  } catch (error) {
    if (error instanceof Error && error.message === "UNAUTHORIZED") {
      return NextResponse.json({ error: "인증이 필요합니다" }, { status: 401 });
    }
    console.error("[Admin API] GET /api/clients/[id] error:", error);
    return NextResponse.json(
      { success: false, error: "클라이언트 조회에 실패했습니다." },
      { status: 500 }
    );
  }
}

// PATCH: 클라이언트 정보 수정
export async function PATCH(request: NextRequest, { params }: RouteParams) {
  try {
    await requireAdmin();
    const { id } = await params;
    const body = await request.json();

    // 기존 클라이언트 확인
    const existing = await prisma.client.findUnique({ where: { id } });
    if (!existing) {
      return NextResponse.json(
        { success: false, error: "클라이언트를 찾을 수 없습니다." },
        { status: 404 }
      );
    }

    // 업데이트 데이터 구성
    const updateData: Record<string, unknown> = {};

    const allowedFields = [
      "clientName",
      "email",
      "phone",
      "metaAdAccountId",
      "metaAccessToken",
      "metaRefreshToken",
      "authStatus",
      "telegramChatId",
      "telegramEnabled",
      "planType",
      "isActive",
      "memo",
    ];

    for (const field of allowedFields) {
      if (body[field] !== undefined) {
        updateData[field] = body[field];
      }
    }

    // 날짜 필드 처리
    if (body.tokenExpiresAt !== undefined) {
      updateData.tokenExpiresAt = body.tokenExpiresAt
        ? new Date(body.tokenExpiresAt)
        : null;
    }
    if (body.servicePeriodStart !== undefined) {
      updateData.servicePeriodStart = body.servicePeriodStart
        ? new Date(body.servicePeriodStart)
        : null;
    }
    if (body.servicePeriodEnd !== undefined) {
      updateData.servicePeriodEnd = body.servicePeriodEnd
        ? new Date(body.servicePeriodEnd)
        : null;
    }

    // 클라이언트 업데이트
    const client = await prisma.client.update({
      where: { id },
      data: updateData,
    });

    return NextResponse.json({ success: true, data: client });
  } catch (error) {
    if (error instanceof Error && error.message === "UNAUTHORIZED") {
      return NextResponse.json({ error: "인증이 필요합니다" }, { status: 401 });
    }
    console.error("[Admin API] PATCH /api/clients/[id] error:", error);
    return NextResponse.json(
      { success: false, error: "클라이언트 수정에 실패했습니다." },
      { status: 500 }
    );
  }
}

// DELETE: 클라이언트 삭제
export async function DELETE(request: NextRequest, { params }: RouteParams) {
  try {
    await requireAdmin();
    const { id } = await params;

    // 기존 클라이언트 확인
    const existing = await prisma.client.findUnique({ where: { id } });
    if (!existing) {
      return NextResponse.json(
        { success: false, error: "클라이언트를 찾을 수 없습니다." },
        { status: 404 }
      );
    }

    // 클라이언트 삭제 (관련 로그도 CASCADE로 삭제됨)
    await prisma.client.delete({ where: { id } });

    return NextResponse.json({
      success: true,
      message: "클라이언트가 삭제되었습니다.",
    });
  } catch (error) {
    if (error instanceof Error && error.message === "UNAUTHORIZED") {
      return NextResponse.json({ error: "인증이 필요합니다" }, { status: 401 });
    }
    console.error("[Admin API] DELETE /api/clients/[id] error:", error);
    return NextResponse.json(
      { success: false, error: "클라이언트 삭제에 실패했습니다." },
      { status: 500 }
    );
  }
}
