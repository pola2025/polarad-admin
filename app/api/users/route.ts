/**
 * Admin 앱 - 사용자 API
 * GET: 사용자 목록 조회 (관리자용)
 */

import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@polarad/database";
import { requireAdmin } from "@/lib/auth";

// GET: 사용자 목록 조회 (관리자용)
export async function GET(request: NextRequest) {
  try {
    await requireAdmin();

    const { searchParams } = new URL(request.url);
    const page = parseInt(searchParams.get("page") || "1");
    const limit = parseInt(searchParams.get("limit") || "20");
    const search = searchParams.get("search") || "";
    const status = searchParams.get("status"); // active, inactive, all

    const skip = (page - 1) * limit;

    // 검색 조건
    const where: Record<string, unknown> = {};

    if (search) {
      where.OR = [
        { clientName: { contains: search, mode: "insensitive" } },
        { name: { contains: search, mode: "insensitive" } },
        { email: { contains: search, mode: "insensitive" } },
        { phone: { contains: search } },
      ];
    }

    if (status === "active") {
      where.isActive = true;
    } else if (status === "inactive") {
      where.isActive = false;
    }

    // 전체 개수 조회
    const total = await prisma.user.count({ where });

    // 사용자 목록 조회
    const users = await prisma.user.findMany({
      where,
      select: {
        id: true,
        clientName: true,
        name: true,
        email: true,
        phone: true,
        isActive: true,
        smsConsent: true,
        emailConsent: true,
        telegramEnabled: true,
        telegramChatId: true,
        lastLoginAt: true,
        createdAt: true,
        submission: {
          select: {
            status: true,
            isComplete: true,
          },
        },
        _count: {
          select: {
            workflows: true,
          },
        },
      },
      orderBy: { createdAt: "desc" },
      skip,
      take: limit,
    });

    // 통계
    const stats = {
      total: await prisma.user.count(),
      active: await prisma.user.count({ where: { isActive: true } }),
      inactive: await prisma.user.count({ where: { isActive: false } }),
      submissionComplete: await prisma.submission.count({ where: { isComplete: true } }),
    };

    return NextResponse.json({
      success: true,
      data: users,
      pagination: {
        page,
        limit,
        total,
        totalPages: Math.ceil(total / limit),
      },
      stats,
    });
  } catch (error) {
    if (error instanceof Error && error.message === "UNAUTHORIZED") {
      return NextResponse.json({ error: "인증이 필요합니다" }, { status: 401 });
    }
    console.error("[Admin API] GET /api/users error:", error);
    return NextResponse.json(
      { error: "사용자 목록 조회 중 오류가 발생했습니다" },
      { status: 500 }
    );
  }
}
