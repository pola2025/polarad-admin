/**
 * Admin API - 서비스 기간 연장
 *
 * POST: 서비스 기간 연장
 */

import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@polarad/database";
import { requireAdmin } from "@/lib/auth";

// POST: 서비스 기간 연장
export async function POST(request: NextRequest) {
  try {
    await requireAdmin();

    const body = await request.json();
    const { clientId, months = 3, memo } = body;

    if (!clientId) {
      return NextResponse.json(
        { success: false, error: "clientId가 필요합니다." },
        { status: 400 }
      );
    }

    // 클라이언트 확인
    const client = await prisma.client.findUnique({
      where: { id: clientId },
      select: {
        id: true,
        clientName: true,
        servicePeriodStart: true,
        servicePeriodEnd: true,
      },
    });

    if (!client) {
      return NextResponse.json(
        { success: false, error: "클라이언트를 찾을 수 없습니다." },
        { status: 404 }
      );
    }

    // 새 서비스 종료일 계산
    const currentEndDate = client.servicePeriodEnd
      ? new Date(client.servicePeriodEnd)
      : new Date();

    // 현재 종료일이 과거인 경우 오늘부터 계산
    const baseDate =
      currentEndDate < new Date() ? new Date() : currentEndDate;

    const newEndDate = new Date(baseDate);
    newEndDate.setMonth(newEndDate.getMonth() + months);

    // 트랜잭션으로 서비스 기간 연장 + 결제 이력 추가
    const result = await prisma.$transaction(async (tx) => {
      // 서비스 기간 업데이트
      const updatedClient = await tx.client.update({
        where: { id: clientId },
        data: {
          servicePeriodEnd: newEndDate,
          isActive: true,
        },
        select: {
          id: true,
          clientName: true,
          servicePeriodStart: true,
          servicePeriodEnd: true,
        },
      });

      // 결제 이력 추가 (무료 연장으로 기록)
      const payment = await tx.paymentHistory.create({
        data: {
          clientId,
          paymentDate: new Date(),
          amount: null,
          paymentType: "extension",
          paymentMethod: "무료 연장",
          serviceMonths: months,
          memo: memo || `서비스 기간 ${months}개월 연장`,
        },
      });

      return { client: updatedClient, payment };
    });

    return NextResponse.json({
      success: true,
      data: result.client,
      payment: result.payment,
      message: `서비스 기간이 ${months}개월 연장되었습니다. (새 종료일: ${newEndDate.toISOString().split("T")[0]})`,
      previousEndDate: client.servicePeriodEnd?.toISOString().split("T")[0] || null,
      newEndDate: newEndDate.toISOString().split("T")[0],
    });
  } catch (error) {
    if (error instanceof Error && error.message === "UNAUTHORIZED") {
      return NextResponse.json({ error: "인증이 필요합니다" }, { status: 401 });
    }
    console.error("[Admin API] POST /api/admin/renewal/extend error:", error);
    return NextResponse.json(
      { success: false, error: "서비스 기간 연장에 실패했습니다." },
      { status: 500 }
    );
  }
}
