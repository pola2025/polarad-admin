/**
 * Admin API - Submission 관리
 * GET: 전체 Submission 목록 조회
 */

import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@polarad/database";
import { requireAdmin } from "@/lib/auth";

export async function GET(request: NextRequest) {
  try {
    await requireAdmin();

    const { searchParams } = new URL(request.url);
    const page = parseInt(searchParams.get("page") || "1");
    const limit = parseInt(searchParams.get("limit") || "20");
    const search = searchParams.get("search") || "";
    const status = searchParams.get("status"); // DRAFT, SUBMITTED, IN_REVIEW, APPROVED, REJECTED

    const skip = (page - 1) * limit;

    // 검색 조건
    const where: Record<string, unknown> = {};

    if (search) {
      where.OR = [
        { brandName: { contains: search, mode: "insensitive" } },
        { user: { name: { contains: search, mode: "insensitive" } } },
        { user: { clientName: { contains: search, mode: "insensitive" } } },
        { user: { email: { contains: search, mode: "insensitive" } } },
      ];
    }

    if (status && status !== "all") {
      where.status = status;
    }

    // 전체 개수 조회
    const total = await prisma.submission.count({ where });

    // Submission 목록 조회
    const submissions = await prisma.submission.findMany({
      where,
      include: {
        user: {
          select: {
            id: true,
            name: true,
            clientName: true,
            email: true,
            phone: true,
            telegramChatId: true,
            telegramEnabled: true,
          },
        },
      },
      orderBy: [
        { status: "asc" }, // SUBMITTED 우선
        { updatedAt: "desc" },
      ],
      skip,
      take: limit,
    });

    // 상태별 통계
    const stats = {
      total: await prisma.submission.count(),
      draft: await prisma.submission.count({ where: { status: "DRAFT" } }),
      submitted: await prisma.submission.count({ where: { status: "SUBMITTED" } }),
      inReview: await prisma.submission.count({ where: { status: "IN_REVIEW" } }),
      approved: await prisma.submission.count({ where: { status: "APPROVED" } }),
      rejected: await prisma.submission.count({ where: { status: "REJECTED" } }),
    };

    return NextResponse.json({
      success: true,
      data: submissions,
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
    console.error("[Admin API] GET /api/admin/submissions error:", error);
    return NextResponse.json(
      { error: "Submission 목록 조회 중 오류가 발생했습니다" },
      { status: 500 }
    );
  }
}
