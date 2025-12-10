/**
 * Admin API - 연장 관리
 *
 * GET: D-day 기준 정렬된 클라이언트 목록
 * PATCH: 연락처 정보 업데이트
 */

import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@polarad/database";
import { requireAdmin } from "@/lib/auth";

// GET: 연장 관리 대상 클라이언트 목록 (D-day 정렬)
export async function GET(request: NextRequest) {
  try {
    await requireAdmin();

    const { searchParams } = new URL(request.url);
    const daysFilter = parseInt(searchParams.get("days") || "30"); // 기본 30일 내 만료 예정

    const now = new Date();
    const futureDate = new Date(now);
    futureDate.setDate(futureDate.getDate() + daysFilter);

    // 활성 클라이언트 중 서비스 기간이 있는 클라이언트
    const clients = await prisma.client.findMany({
      where: {
        isActive: true,
        servicePeriodEnd: {
          not: null,
        },
      },
      select: {
        id: true,
        clientId: true,
        clientName: true,
        email: true,
        phone: true,
        contactPhone: true,
        contactName: true,
        servicePeriodStart: true,
        servicePeriodEnd: true,
        telegramChatId: true,
        telegramEnabled: true,
        metaAdAccountId: true,
        authStatus: true,
        smsLogs: {
          orderBy: { sentAt: "desc" },
          take: 5,
          select: {
            id: true,
            messageType: true,
            status: true,
            sentAt: true,
          },
        },
        paymentHistory: {
          orderBy: { paymentDate: "desc" },
          take: 3,
          select: {
            id: true,
            paymentDate: true,
            amount: true,
            paymentType: true,
            serviceMonths: true,
          },
        },
      },
      orderBy: { servicePeriodEnd: "asc" },
    });

    // D-day 계산 및 분류
    const clientsWithDday = clients.map((client) => {
      const endDate = new Date(client.servicePeriodEnd!);
      const diffTime = endDate.getTime() - now.getTime();
      const daysLeft = Math.ceil(diffTime / (1000 * 60 * 60 * 24));

      let status: "expired" | "urgent" | "warning" | "normal";
      if (daysLeft < 0) {
        status = "expired";
      } else if (daysLeft <= 3) {
        status = "urgent"; // D-3 이하
      } else if (daysLeft <= 7) {
        status = "warning"; // D-7 이하
      } else {
        status = "normal";
      }

      return {
        ...client,
        daysLeft,
        status,
      };
    });

    // 필터: 만료됨 + 지정 기간 내 만료 예정
    const filtered = clientsWithDday.filter(
      (c) => c.daysLeft <= daysFilter
    );

    // 통계
    const stats = {
      total: filtered.length,
      expired: filtered.filter((c) => c.status === "expired").length,
      urgent: filtered.filter((c) => c.status === "urgent").length,
      warning: filtered.filter((c) => c.status === "warning").length,
      normal: filtered.filter((c) => c.status === "normal").length,
    };

    return NextResponse.json({
      success: true,
      data: filtered,
      stats,
      daysFilter,
    });
  } catch (error) {
    if (error instanceof Error && error.message === "UNAUTHORIZED") {
      return NextResponse.json({ error: "인증이 필요합니다" }, { status: 401 });
    }
    console.error("[Admin API] GET /api/admin/renewal error:", error);
    return NextResponse.json(
      { success: false, error: "연장 관리 목록 조회에 실패했습니다." },
      { status: 500 }
    );
  }
}

// PATCH: 연락처 정보 업데이트
export async function PATCH(request: NextRequest) {
  try {
    await requireAdmin();

    const body = await request.json();
    const { clientId, contactPhone, contactName, phone, email } = body;

    if (!clientId) {
      return NextResponse.json(
        { success: false, error: "clientId가 필요합니다." },
        { status: 400 }
      );
    }

    // 업데이트할 필드 구성
    const updateData: Record<string, unknown> = {};
    if (contactPhone !== undefined) updateData.contactPhone = contactPhone;
    if (contactName !== undefined) updateData.contactName = contactName;
    if (phone !== undefined) updateData.phone = phone;
    if (email !== undefined) updateData.email = email;

    if (Object.keys(updateData).length === 0) {
      return NextResponse.json(
        { success: false, error: "업데이트할 필드가 없습니다." },
        { status: 400 }
      );
    }

    const client = await prisma.client.update({
      where: { id: clientId },
      data: updateData,
      select: {
        id: true,
        clientName: true,
        contactPhone: true,
        contactName: true,
        phone: true,
        email: true,
      },
    });

    return NextResponse.json({
      success: true,
      data: client,
      message: "연락처 정보가 업데이트되었습니다.",
    });
  } catch (error) {
    if (error instanceof Error && error.message === "UNAUTHORIZED") {
      return NextResponse.json({ error: "인증이 필요합니다" }, { status: 401 });
    }
    console.error("[Admin API] PATCH /api/admin/renewal error:", error);
    return NextResponse.json(
      { success: false, error: "연락처 정보 업데이트에 실패했습니다." },
      { status: 500 }
    );
  }
}
