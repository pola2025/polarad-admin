/**
 * Admin 앱 - 계약 API
 * GET: 계약 목록 조회
 */

import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@polarad/database";
import { requireAdmin } from "@/lib/auth";

export async function GET(request: NextRequest) {
  try {
    await requireAdmin();

    const searchParams = request.nextUrl.searchParams;
    const search = searchParams.get("search") || "";
    const status = searchParams.get("status") || "";

    // 검색 조건 설정
    const where: Record<string, unknown> = {};

    if (search) {
      where.OR = [
        { companyName: { contains: search, mode: "insensitive" } },
        { contractNumber: { contains: search, mode: "insensitive" } },
        { ceoName: { contains: search, mode: "insensitive" } },
      ];
    }

    if (status) {
      where.status = status;
    }

    // 계약 목록 조회
    const contracts = await prisma.contract.findMany({
      where,
      include: {
        package: {
          select: {
            name: true,
            displayName: true,
          },
        },
        user: {
          select: {
            clientName: true,
          },
        },
      },
      orderBy: { createdAt: "desc" },
    });

    // 통계 조회
    const stats = await prisma.contract.groupBy({
      by: ["status"],
      _count: true,
    });

    const statsMap = stats.reduce((acc, item) => {
      acc[item.status.toLowerCase()] = item._count;
      return acc;
    }, {} as Record<string, number>);

    return NextResponse.json({
      success: true,
      contracts,
      stats: {
        total: contracts.length,
        pending: statsMap.pending || 0,
        submitted: statsMap.submitted || 0,
        approved: statsMap.approved || 0,
        active: statsMap.active || 0,
        rejected: statsMap.rejected || 0,
        expired: statsMap.expired || 0,
        cancelled: statsMap.cancelled || 0,
      },
    });
  } catch (error) {
    if (error instanceof Error && error.message === "UNAUTHORIZED") {
      return NextResponse.json({ error: "인증이 필요합니다" }, { status: 401 });
    }
    console.error("[Admin API] GET /api/contracts error:", error);
    return NextResponse.json(
      { error: "계약 목록을 불러올 수 없습니다" },
      { status: 500 }
    );
  }
}
