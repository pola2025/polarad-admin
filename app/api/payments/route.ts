/**
 * Admin API - 결제 관리
 *
 * GET: 클라이언트별 결제 이력
 * POST: 결제 등록 + 서비스 기간 갱신
 */

import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@polarad/database";
import { requireAdmin } from "@/lib/auth";

// GET: 결제 이력 조회
export async function GET(request: NextRequest) {
  try {
    await requireAdmin();

    const { searchParams } = new URL(request.url);
    const clientId = searchParams.get("clientId");
    const limit = parseInt(searchParams.get("limit") || "50");

    const where: Record<string, unknown> = {};
    if (clientId) {
      where.clientId = clientId;
    }

    const payments = await prisma.paymentHistory.findMany({
      where,
      include: {
        client: {
          select: {
            id: true,
            clientName: true,
            servicePeriodStart: true,
            servicePeriodEnd: true,
          },
        },
      },
      orderBy: { paymentDate: "desc" },
      take: limit,
    });

    return NextResponse.json({
      success: true,
      data: payments,
      total: payments.length,
    });
  } catch (error) {
    if (error instanceof Error && error.message === "UNAUTHORIZED") {
      return NextResponse.json({ error: "인증이 필요합니다" }, { status: 401 });
    }
    console.error("[Admin API] GET /api/payments error:", error);
    return NextResponse.json(
      { success: false, error: "결제 이력 조회에 실패했습니다." },
      { status: 500 }
    );
  }
}

// POST: 결제 등록 + 서비스 기간 갱신
export async function POST(request: NextRequest) {
  try {
    await requireAdmin();

    const body = await request.json();
    const {
      clientId,
      paymentDate,
      amount,
      paymentType = "monthly",
      paymentMethod,
      serviceMonths = 3,
      memo,
      extendService = true,
    } = body;

    // 필수 필드 검증
    if (!clientId || !paymentDate) {
      return NextResponse.json(
        { success: false, error: "clientId와 paymentDate는 필수입니다." },
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

    // 트랜잭션으로 결제 등록 + 서비스 기간 갱신
    const result = await prisma.$transaction(async (tx) => {
      // 결제 이력 생성
      const payment = await tx.paymentHistory.create({
        data: {
          clientId,
          paymentDate: new Date(paymentDate),
          amount: amount ? parseFloat(amount) : null,
          paymentType,
          paymentMethod,
          serviceMonths,
          memo,
        },
      });

      // 서비스 기간 갱신
      let updatedClient = client;
      if (extendService && serviceMonths > 0) {
        const currentEndDate = client.servicePeriodEnd
          ? new Date(client.servicePeriodEnd)
          : new Date();

        // 현재 종료일이 과거인 경우 오늘부터 계산
        const baseDate =
          currentEndDate < new Date() ? new Date() : currentEndDate;

        const newEndDate = new Date(baseDate);
        newEndDate.setMonth(newEndDate.getMonth() + serviceMonths);

        updatedClient = await tx.client.update({
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
      }

      return { payment, client: updatedClient };
    });

    return NextResponse.json(
      {
        success: true,
        data: result.payment,
        client: result.client,
        message: `결제가 등록되었습니다. ${result.client.servicePeriodEnd ? `서비스 기간: ~${result.client.servicePeriodEnd.toISOString().split("T")[0]}` : ""}`,
      },
      { status: 201 }
    );
  } catch (error) {
    if (error instanceof Error && error.message === "UNAUTHORIZED") {
      return NextResponse.json({ error: "인증이 필요합니다" }, { status: 401 });
    }
    console.error("[Admin API] POST /api/payments error:", error);
    return NextResponse.json(
      { success: false, error: "결제 등록에 실패했습니다." },
      { status: 500 }
    );
  }
}

// DELETE: 결제 삭제
export async function DELETE(request: NextRequest) {
  try {
    await requireAdmin();

    const { searchParams } = new URL(request.url);
    const paymentId = searchParams.get("id");

    if (!paymentId) {
      return NextResponse.json(
        { success: false, error: "결제 ID가 필요합니다." },
        { status: 400 }
      );
    }

    // 결제 이력 확인
    const payment = await prisma.paymentHistory.findUnique({
      where: { id: paymentId },
    });

    if (!payment) {
      return NextResponse.json(
        { success: false, error: "결제 이력을 찾을 수 없습니다." },
        { status: 404 }
      );
    }

    // 결제 삭제
    await prisma.paymentHistory.delete({
      where: { id: paymentId },
    });

    return NextResponse.json({
      success: true,
      message: "결제 이력이 삭제되었습니다.",
    });
  } catch (error) {
    if (error instanceof Error && error.message === "UNAUTHORIZED") {
      return NextResponse.json({ error: "인증이 필요합니다" }, { status: 401 });
    }
    console.error("[Admin API] DELETE /api/payments error:", error);
    return NextResponse.json(
      { success: false, error: "결제 삭제에 실패했습니다." },
      { status: 500 }
    );
  }
}
