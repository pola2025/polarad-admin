/**
 * Admin API - 스레드 메시지 관리
 * POST: 관리자 답변 추가
 */

import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@polarad/database";
import { requireAdmin } from "@/lib/auth";

interface RouteParams {
  params: Promise<{ threadId: string }>;
}

// 텔레그램 사용자 알림 발송
async function sendUserNotification(
  telegramChatId: string | null,
  threadTitle: string
) {
  if (!telegramChatId) return;

  const TELEGRAM_BOT_TOKEN = process.env.TELEGRAM_BOT_TOKEN;
  if (!TELEGRAM_BOT_TOKEN) return;

  try {
    const message = `💬 <b>문의 답변</b>\n\n"${threadTitle}" 문의에 대한 답변이 등록되었습니다.\n\n마이페이지에서 확인해주세요.`;

    await fetch(`https://api.telegram.org/bot${TELEGRAM_BOT_TOKEN}/sendMessage`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        chat_id: telegramChatId,
        text: message,
        parse_mode: "HTML",
      }),
    });
  } catch (error) {
    console.error("[Telegram] 사용자 알림 발송 실패:", error);
  }
}

// POST: 관리자 답변 추가
export async function POST(request: NextRequest, { params }: RouteParams) {
  try {
    const admin = await requireAdmin();

    const { threadId } = await params;
    const body = await request.json();
    const { content, attachments, expectedCompletionDate, changeStatus } = body;

    if (!content) {
      return NextResponse.json(
        { error: "내용은 필수입니다" },
        { status: 400 }
      );
    }

    // 스레드 존재 확인
    const thread = await prisma.communicationThread.findUnique({
      where: { id: threadId },
      include: {
        user: {
          select: {
            telegramChatId: true,
            telegramEnabled: true,
          },
        },
      },
    });

    if (!thread) {
      return NextResponse.json(
        { error: "스레드를 찾을 수 없습니다" },
        { status: 404 }
      );
    }

    // 트랜잭션으로 메시지 생성 및 스레드 업데이트
    const threadUpdateData: Record<string, unknown> = {
      lastReplyAt: new Date(),
    };

    // 상태 변경
    if (changeStatus) {
      threadUpdateData.status = changeStatus;
    } else if (thread.status === "OPEN") {
      // 관리자가 답변하면 자동으로 진행중으로 변경
      threadUpdateData.status = "IN_PROGRESS";
    }

    // 예상 완료일
    if (expectedCompletionDate !== undefined) {
      threadUpdateData.expectedCompletionDate = expectedCompletionDate
        ? new Date(expectedCompletionDate)
        : null;
    }

    const [message] = await prisma.$transaction([
      prisma.communicationMessage.create({
        data: {
          threadId,
          authorId: admin.userId,
          authorType: "admin",
          authorName: admin.name,
          content,
          attachments: attachments || [],
          expectedCompletionDate: expectedCompletionDate
            ? new Date(expectedCompletionDate)
            : null,
          isReadByAdmin: true,
          isReadByUser: false,
        },
      }),
      prisma.communicationThread.update({
        where: { id: threadId },
        data: threadUpdateData,
      }),
    ]);

    // 사용자에게 텔레그램 알림 발송
    if (thread.user.telegramEnabled && thread.user.telegramChatId) {
      sendUserNotification(thread.user.telegramChatId, thread.title);
    }

    return NextResponse.json({
      success: true,
      data: message,
      message: "답변이 등록되었습니다",
    });
  } catch (error) {
    if (error instanceof Error && error.message === "UNAUTHORIZED") {
      return NextResponse.json({ error: "인증이 필요합니다" }, { status: 401 });
    }
    console.error("[Admin API] POST /api/admin/communications/[threadId]/messages error:", error);
    return NextResponse.json(
      { error: "답변 등록 중 오류가 발생했습니다" },
      { status: 500 }
    );
  }
}
