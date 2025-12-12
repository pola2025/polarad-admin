/**
 * Admin 앱 - 계약 승인 API
 * POST: 계약 승인
 */

import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@polarad/database";
import { requireAdmin } from "@/lib/auth";
import { generateContractPDF } from "@polarad/lib/pdf";
import { sendContractEmail } from "@polarad/lib/email";
import { sendTelegramMessage, formatContractApprovedMessage } from "@polarad/lib/telegram";

interface RouteParams {
  params: Promise<{ id: string }>;
}

export async function POST(request: NextRequest, { params }: RouteParams) {
  try {
    const admin = await requireAdmin();
    const { id } = await params;

    // 계약 조회 (사용자 정보 포함)
    const contract = await prisma.contract.findUnique({
      where: { id },
      include: {
        package: true,
        user: {
          select: {
            telegramChatId: true,
            telegramEnabled: true,
          },
        },
      },
    });

    if (!contract) {
      return NextResponse.json({ error: "계약을 찾을 수 없습니다" }, { status: 404 });
    }

    if (contract.status !== "SUBMITTED") {
      return NextResponse.json(
        { error: "승인 대기 상태의 계약만 승인할 수 있습니다" },
        { status: 400 }
      );
    }

    // 계약 시작일/종료일 설정
    const startDate = new Date();
    const endDate = new Date();
    endDate.setMonth(endDate.getMonth() + contract.contractPeriod);

    // 계약 승인 처리
    await prisma.contract.update({
      where: { id },
      data: {
        status: "APPROVED",
        approvedAt: new Date(),
        approvedBy: admin.userId,
        startDate,
        endDate,
      },
    });

    // 로그 생성
    await prisma.contractLog.create({
      data: {
        contractId: id,
        fromStatus: "SUBMITTED",
        toStatus: "APPROVED",
        changedBy: admin.userId,
        note: "관리자 승인",
      },
    });

    // PDF 생성 및 이메일 발송
    try {
      const pdfBuffer = await generateContractPDF({
        contractNumber: contract.contractNumber,
        companyName: contract.companyName || "",
        ceoName: contract.ceoName || "",
        businessNumber: contract.businessNumber || "",
        address: contract.address || "",
        contactName: contract.contactName || "",
        contactPhone: contract.contactPhone || "",
        contactEmail: contract.contactEmail || "",
        packageName: contract.package.name,
        packageDisplayName: contract.package.displayName,
        monthlyFee: contract.monthlyFee,
        contractPeriod: contract.contractPeriod,
        totalAmount: contract.totalAmount,
        startDate,
        endDate,
        signedAt: contract.signedAt || new Date(),
        clientSignature: contract.clientSignature || undefined,
        isPromotion: contract.isPromotion || false,
      });

      await sendContractEmail(
        contract.contactEmail || "",
        contract.contractNumber,
        contract.companyName || "",
        pdfBuffer
      );

      // 이메일 발송 기록
      await prisma.contract.update({
        where: { id },
        data: { emailSentAt: new Date() },
      });
    } catch (emailError) {
      console.error("[Admin API] 이메일 발송 오류:", emailError);
      // 이메일 실패해도 승인은 성공으로 처리
    }

    // 텔레그램 알림 발송
    if (contract.user.telegramEnabled && contract.user.telegramChatId) {
      try {
        const telegramMessage = formatContractApprovedMessage(
          contract.companyName || "",
          contract.contractNumber,
          contract.package.displayName,
          startDate,
          endDate
        );
        await sendTelegramMessage(contract.user.telegramChatId, telegramMessage);
      } catch (telegramError) {
        console.error("[Admin API] 텔레그램 알림 발송 오류:", telegramError);
        // 텔레그램 실패해도 승인은 성공으로 처리
      }
    }

    return NextResponse.json({
      success: true,
      message: "계약이 승인되었습니다",
    });
  } catch (error) {
    if (error instanceof Error && error.message === "UNAUTHORIZED") {
      return NextResponse.json({ error: "인증이 필요합니다" }, { status: 401 });
    }
    console.error("[Admin API] POST /api/contracts/[id]/approve error:", error);
    return NextResponse.json(
      { error: "계약 승인 처리 중 오류가 발생했습니다" },
      { status: 500 }
    );
  }
}
