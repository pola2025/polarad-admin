/**
 * Admin 앱 - 계약 상세 API
 * GET: 계약 상세 조회
 */

import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@polarad/database";
import { requireAdmin } from "@/lib/auth";

interface RouteParams {
  params: Promise<{ id: string }>;
}

// 계약 상세 조회
export async function GET(request: NextRequest, { params }: RouteParams) {
  try {
    await requireAdmin();
    const { id } = await params;

    const contract = await prisma.contract.findUnique({
      where: { id },
      include: {
        package: true,
        user: {
          select: {
            id: true,
            name: true,
            email: true,
            phone: true,
            clientName: true,
            telegramChatId: true,
            telegramEnabled: true,
          },
        },
        logs: {
          orderBy: { createdAt: "desc" },
          take: 20,
        },
      },
    });

    if (!contract) {
      return NextResponse.json({ error: "계약을 찾을 수 없습니다" }, { status: 404 });
    }

    return NextResponse.json({ success: true, contract });
  } catch (error) {
    if (error instanceof Error && error.message === "UNAUTHORIZED") {
      return NextResponse.json({ error: "인증이 필요합니다" }, { status: 401 });
    }
    console.error("[Admin API] GET /api/contracts/[id] error:", error);
    return NextResponse.json(
      { error: "계약 조회 중 오류가 발생했습니다" },
      { status: 500 }
    );
  }
}
