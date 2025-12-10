/**
 * Admin 앱 - 계약 거절 API
 * POST: 계약 거절
 */

import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@polarad/database";
import { requireAdmin } from "@/lib/auth";
import { sendEmail } from "@polarad/lib/email";
import { sendTelegramMessage, formatContractRejectedMessage } from "@polarad/lib/telegram";

interface RouteParams {
  params: Promise<{ id: string }>;
}

export async function POST(request: NextRequest, { params }: RouteParams) {
  try {
    const admin = await requireAdmin();
    const { id } = await params;
    const body = await request.json();
    const { reason } = body;

    // 계약 조회 (사용자 정보 포함)
    const contract = await prisma.contract.findUnique({
      where: { id },
      include: {
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
        { error: "승인 대기 상태의 계약만 거절할 수 있습니다" },
        { status: 400 }
      );
    }

    // 계약 거절 처리
    await prisma.contract.update({
      where: { id },
      data: {
        status: "REJECTED",
        rejectedAt: new Date(),
        rejectedBy: admin.userId,
        rejectReason: reason || "사유 미기재",
      },
    });

    // 로그 생성
    await prisma.contractLog.create({
      data: {
        contractId: id,
        fromStatus: "SUBMITTED",
        toStatus: "REJECTED",
        changedBy: admin.userId,
        note: reason || "관리자 거절",
      },
    });

    // 거절 알림 이메일 발송
    try {
      await sendEmail({
        to: contract.contactEmail || "",
        subject: `[폴라애드] ${contract.companyName || ""} 계약 요청 결과 안내`,
        html: `
          <!DOCTYPE html>
          <html>
          <head>
            <meta charset="utf-8">
            <style>
              body { font-family: 'Apple SD Gothic Neo', 'Malgun Gothic', sans-serif; line-height: 1.6; color: #333; }
              .container { max-width: 600px; margin: 0 auto; padding: 20px; }
              .header { background: #ef4444; color: white; padding: 30px; text-align: center; border-radius: 8px 8px 0 0; }
              .content { background: #f9fafb; padding: 30px; border: 1px solid #e5e7eb; }
              .footer { background: #374151; color: #9ca3af; padding: 20px; text-align: center; font-size: 12px; border-radius: 0 0 8px 8px; }
              .reason { background: #fef2f2; border-left: 4px solid #ef4444; padding: 15px; margin: 20px 0; }
            </style>
          </head>
          <body>
            <div class="container">
              <div class="header">
                <h1>계약 요청 결과 안내</h1>
              </div>
              <div class="content">
                <p>안녕하세요, <strong>${contract.companyName || ""}</strong> 담당자님.</p>

                <p>죄송합니다. 요청하신 계약이 승인되지 않았습니다.</p>

                <div class="reason">
                  <strong>사유:</strong><br>
                  ${reason || "사유가 기재되지 않았습니다."}
                </div>

                <p>추가 문의사항이 있으시면 연락 주세요.</p>

                <p style="margin-top: 30px;">
                  감사합니다.<br>
                  <strong>폴라애드 팀</strong>
                </p>
              </div>
              <div class="footer">
                <p>주식회사 폴라애드</p>
                <p>대표전화: 02-1234-5678 | 이메일: contact@polarad.co.kr</p>
              </div>
            </div>
          </body>
          </html>
        `,
      });
    } catch (emailError) {
      console.error("[Admin API] 거절 알림 이메일 발송 오류:", emailError);
    }

    // 텔레그램 알림 발송
    if (contract.user.telegramEnabled && contract.user.telegramChatId) {
      try {
        const telegramMessage = formatContractRejectedMessage(
          contract.companyName || "",
          contract.contractNumber,
          reason
        );
        await sendTelegramMessage(contract.user.telegramChatId, telegramMessage);
      } catch (telegramError) {
        console.error("[Admin API] 텔레그램 알림 발송 오류:", telegramError);
        // 텔레그램 실패해도 거절 처리는 성공으로 처리
      }
    }

    return NextResponse.json({
      success: true,
      message: "계약이 거절되었습니다",
    });
  } catch (error) {
    if (error instanceof Error && error.message === "UNAUTHORIZED") {
      return NextResponse.json({ error: "인증이 필요합니다" }, { status: 401 });
    }
    console.error("[Admin API] POST /api/contracts/[id]/reject error:", error);
    return NextResponse.json(
      { error: "계약 거절 처리 중 오류가 발생했습니다" },
      { status: 500 }
    );
  }
}
