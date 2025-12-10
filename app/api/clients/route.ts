/**
 * Admin 앱 - 클라이언트 API
 * GET: 클라이언트 목록 조회 (데이터 현황 포함)
 * POST: 새 클라이언트 등록 (토큰 검증 포함)
 */

import { NextRequest, NextResponse } from "next/server";
import { prisma, AuthStatus } from "@polarad/database";
import { requireAdmin } from "@/lib/auth";
import { encrypt, validateAdAccount } from "@polarad/lib/meta";
import crypto from "crypto";

// 비밀번호 해시 생성
function generatePasswordHash(): string {
  return crypto.randomBytes(32).toString("hex");
}

// 서비스 종료일 계산 (시작일 + 3개월 - 1일)
function calculateEndDate(startDate: Date): Date {
  const end = new Date(startDate);
  end.setMonth(end.getMonth() + 3);
  end.setDate(end.getDate() - 1);
  return end;
}

// GET: 클라이언트 목록 조회
export async function GET(request: NextRequest) {
  try {
    await requireAdmin();

    const { searchParams } = new URL(request.url);
    const search = searchParams.get("search") || "";
    const status = searchParams.get("status") as AuthStatus | null;
    const isActive = searchParams.get("isActive");
    const page = parseInt(searchParams.get("page") || "1");
    const limit = parseInt(searchParams.get("limit") || "20");
    const includeStats = searchParams.get("includeStats") === "true";

    // 필터 조건 구성
    const where: Record<string, unknown> = {};

    if (search) {
      where.OR = [
        { clientName: { contains: search, mode: "insensitive" } },
        { email: { contains: search, mode: "insensitive" } },
        { clientId: { contains: search, mode: "insensitive" } },
      ];
    }

    if (status) {
      where.authStatus = status;
    }

    if (isActive !== null) {
      where.isActive = isActive === "true";
    }

    // 전체 개수 조회
    const total = await prisma.client.count({ where });

    // 클라이언트 목록 조회
    const clients = await prisma.client.findMany({
      where,
      select: {
        id: true,
        clientId: true,
        clientName: true,
        email: true,
        phone: true,
        contactPhone: true,
        contactName: true,
        metaAdAccountId: true,
        tokenExpiresAt: true,
        authStatus: true,
        planType: true,
        isActive: true,
        telegramEnabled: true,
        telegramChatId: true,
        servicePeriodStart: true,
        servicePeriodEnd: true,
        createdAt: true,
      },
      orderBy: { createdAt: "desc" },
      skip: (page - 1) * limit,
      take: limit,
    });

    // 클라이언트별 데이터 현황 조회 (includeStats=true일 때만)
    let clientsWithStats = clients;
    if (includeStats) {
      clientsWithStats = await Promise.all(
        clients.map(async (client) => {
          // 최신 데이터 날짜
          const latestData = await prisma.rawData.findFirst({
            where: { clientId: client.id },
            orderBy: { date: "desc" },
            select: { date: true },
          });

          // 데이터 건수
          const dataCount = await prisma.rawData.count({
            where: { clientId: client.id },
          });

          // 목표값 조회
          const currentMonth = new Date();
          currentMonth.setDate(1);
          currentMonth.setHours(0, 0, 0, 0);

          const targets = await prisma.clientTarget.findUnique({
            where: {
              clientId_targetMonth: {
                clientId: client.id,
                targetMonth: currentMonth,
              },
            },
            select: {
              targetLeads: true,
              targetSpend: true,
              targetCpl: true,
            },
          });

          return {
            ...client,
            latestDataDate: latestData?.date || null,
            dataCount,
            targets: targets || null,
          };
        })
      );
    }

    // 통계 정보
    const now = new Date();
    const in7Days = new Date(now.getTime() + 7 * 24 * 60 * 60 * 1000);

    const stats = await prisma.client.groupBy({
      by: ["authStatus", "isActive", "telegramEnabled"],
      _count: true,
    });

    const tokenExpiringCount = await prisma.client.count({
      where: {
        isActive: true,
        tokenExpiresAt: {
          gte: now,
          lte: in7Days,
        },
      },
    });

    const summary = {
      total,
      active: stats
        .filter((s) => s.isActive)
        .reduce((acc, s) => acc + s._count, 0),
      tokenExpiring: tokenExpiringCount,
      authRequired: stats
        .filter((s) => s.authStatus === "AUTH_REQUIRED")
        .reduce((acc, s) => acc + s._count, 0),
      telegramEnabled: stats
        .filter((s) => s.telegramEnabled)
        .reduce((acc, s) => acc + s._count, 0),
    };

    return NextResponse.json({
      success: true,
      data: clientsWithStats,
      pagination: {
        total,
        page,
        limit,
        totalPages: Math.ceil(total / limit),
      },
      stats: summary,
    });
  } catch (error) {
    if (error instanceof Error && error.message === "UNAUTHORIZED") {
      return NextResponse.json({ error: "인증이 필요합니다" }, { status: 401 });
    }
    console.error("[Admin API] GET /api/clients error:", error);
    return NextResponse.json(
      { success: false, error: "클라이언트 목록 조회에 실패했습니다." },
      { status: 500 }
    );
  }
}

// POST: 새 클라이언트 등록 (토큰 검증 포함)
export async function POST(request: NextRequest) {
  try {
    await requireAdmin();

    const body = await request.json();
    const {
      clientName,
      email,
      phone,
      contactPhone,
      contactName,
      metaAdAccountId,
      metaAccessToken,
      telegramChatId,
      telegramEnabled = false,
      planType = "FREE",
      memo,
      servicePeriodStart,
      servicePeriodEnd,
      unlimitedService = false,
      targetLeads,
      targetSpend,
      targetCpl,
      skipValidation = false,
    } = body;

    // 필수 필드 검증
    if (!clientName) {
      return NextResponse.json(
        { success: false, error: "클라이언트명은 필수입니다." },
        { status: 400 }
      );
    }

    // client_id 생성
    const clientId = clientName
      .toLowerCase()
      .replace(/[^a-z0-9가-힣]/g, "_")
      .replace(/_+/g, "_")
      .slice(0, 50);

    // 이메일 기본값 생성
    const clientEmail =
      email || `${clientName.toLowerCase().replace(/[^a-z0-9]/g, "")}@polarad.local`;

    // 중복 확인 (이름)
    const existingByName = await prisma.client.findFirst({
      where: { clientName: { equals: clientName, mode: "insensitive" } },
    });

    if (existingByName) {
      return NextResponse.json(
        { success: false, error: `이미 등록된 클라이언트명입니다: ${clientName}` },
        { status: 409 }
      );
    }

    // 중복 확인 (광고계정 ID)
    if (metaAdAccountId) {
      const existingByAccount = await prisma.client.findFirst({
        where: { metaAdAccountId },
      });

      if (existingByAccount) {
        return NextResponse.json(
          { success: false, error: `이미 등록된 광고계정입니다: ${metaAdAccountId}` },
          { status: 409 }
        );
      }
    }

    // 토큰 검증 (metaAdAccountId와 metaAccessToken이 모두 있을 때)
    let validation = { tokenValid: false, accountName: "" };
    if (metaAdAccountId && metaAccessToken && !skipValidation) {
      const result = await validateAdAccount(metaAdAccountId, metaAccessToken);
      if (!result.valid) {
        return NextResponse.json(
          {
            success: false,
            error: "토큰 검증 실패",
            details: result.error,
          },
          { status: 400 }
        );
      }
      validation = { tokenValid: true, accountName: result.name || "" };
    }

    // 서비스 기간 계산
    const startDate = servicePeriodStart ? new Date(servicePeriodStart) : new Date();
    let endDate: Date | null = null;
    if (unlimitedService) {
      endDate = null;
    } else if (servicePeriodEnd) {
      endDate = new Date(servicePeriodEnd);
    } else {
      endDate = calculateEndDate(startDate);
    }

    // 토큰 암호화
    let encryptedToken: string | null = null;
    if (metaAccessToken) {
      try {
        encryptedToken = encrypt(metaAccessToken);
      } catch (encryptError) {
        console.error("Encryption error:", encryptError);
      }
    }

    // 클라이언트 생성
    const client = await prisma.client.create({
      data: {
        clientId,
        clientName,
        email: clientEmail,
        phone,
        contactPhone,
        contactName,
        passwordHash: generatePasswordHash(),
        metaAdAccountId: metaAdAccountId || null,
        encryptedAccessToken: encryptedToken,
        telegramChatId: telegramChatId || null,
        telegramEnabled,
        planType: planType as "FREE" | "BASIC" | "PREMIUM" | "ENTERPRISE",
        isActive: true,
        authStatus: metaAccessToken ? "ACTIVE" : "AUTH_REQUIRED",
        servicePeriodStart: startDate,
        servicePeriodEnd: endDate,
        memo,
      },
    });

    // 목표값 저장
    if (targetLeads || targetSpend || targetCpl) {
      const currentMonth = new Date();
      currentMonth.setDate(1);
      currentMonth.setHours(0, 0, 0, 0);

      await prisma.clientTarget.upsert({
        where: {
          clientId_targetMonth: {
            clientId: client.id,
            targetMonth: currentMonth,
          },
        },
        update: {
          targetLeads: targetLeads || null,
          targetSpend: targetSpend || null,
          targetCpl: targetCpl || null,
        },
        create: {
          clientId: client.id,
          targetMonth: currentMonth,
          targetLeads: targetLeads || null,
          targetSpend: targetSpend || null,
          targetCpl: targetCpl || null,
        },
      });
    }

    return NextResponse.json(
      {
        success: true,
        data: {
          id: client.id,
          clientId: client.clientId,
          clientName: client.clientName,
          metaAdAccountId: client.metaAdAccountId,
          isActive: client.isActive,
        },
        validation,
      },
      { status: 201 }
    );
  } catch (error) {
    if (error instanceof Error && error.message === "UNAUTHORIZED") {
      return NextResponse.json({ error: "인증이 필요합니다" }, { status: 401 });
    }
    console.error("[Admin API] POST /api/clients error:", error);
    return NextResponse.json(
      { success: false, error: "클라이언트 등록에 실패했습니다." },
      { status: 500 }
    );
  }
}
