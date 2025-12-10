/**
 * Admin API - SMS 발송 (연장 알림)
 *
 * GET: SMS 발송 이력
 * POST: NCP SENS로 SMS 발송
 */

import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@polarad/database";
import { requireAdmin } from "@/lib/auth";
import crypto from "crypto";

// NCP SENS SMS 발송
async function sendNcpSms(
  phone: string,
  content: string
): Promise<{ success: boolean; requestId?: string; error?: string }> {
  const accessKey = process.env.NCP_ACCESS_KEY;
  const secretKey = process.env.NCP_SECRET_KEY;
  const serviceId = process.env.NCP_SERVICE_ID;
  const senderPhone = process.env.NCP_SENDER_PHONE;

  if (!accessKey || !secretKey || !serviceId || !senderPhone) {
    return { success: false, error: "NCP SENS 설정이 완료되지 않았습니다." };
  }

  const timestamp = Date.now().toString();
  const method = "POST";
  const url = `/sms/v2/services/${serviceId}/messages`;

  // HMAC-SHA256 서명 생성
  const message = `${method} ${url}\n${timestamp}\n${accessKey}`;
  const signature = crypto
    .createHmac("sha256", secretKey)
    .update(message)
    .digest("base64");

  const body = {
    type: "LMS", // 장문 메시지
    from: senderPhone,
    content,
    messages: [{ to: phone.replace(/-/g, "") }],
  };

  try {
    const response = await fetch(
      `https://sens.apigw.ntruss.com/sms/v2/services/${serviceId}/messages`,
      {
        method: "POST",
        headers: {
          "Content-Type": "application/json; charset=utf-8",
          "x-ncp-apigw-timestamp": timestamp,
          "x-ncp-iam-access-key": accessKey,
          "x-ncp-apigw-signature-v2": signature,
        },
        body: JSON.stringify(body),
      }
    );

    const data = await response.json();

    if (response.ok && data.requestId) {
      return { success: true, requestId: data.requestId };
    } else {
      return {
        success: false,
        error: data.error?.message || "SMS 발송 실패",
      };
    }
  } catch (error) {
    return {
      success: false,
      error: error instanceof Error ? error.message : "SMS 발송 중 오류 발생",
    };
  }
}

// SMS 템플릿 생성
function getSmsTemplate(
  type: "d7" | "d3" | "d0" | "expired",
  clientName: string,
  endDate: string,
  daysLeft: number
): string {
  const templates = {
    d7: `[POLARAD 서비스 만료 안내]

안녕하세요, ${clientName} 담당자님.

POLARAD Meta 광고 관리 서비스가 7일 후(${endDate}) 만료 예정입니다.

서비스 연장을 원하시면 담당자에게 연락 부탁드립니다.

감사합니다.
- POLARAD 팀`,

    d3: `[POLARAD 서비스 만료 임박]

안녕하세요, ${clientName} 담당자님.

POLARAD 서비스가 3일 후(${endDate}) 만료됩니다.

연장 없이 만료 시 데이터 수집이 중단됩니다.
연장 문의: 담당자 연락처

감사합니다.
- POLARAD 팀`,

    d0: `[POLARAD 서비스 만료 당일]

안녕하세요, ${clientName} 담당자님.

POLARAD 서비스가 오늘(${endDate}) 만료됩니다.

즉시 연장하시면 서비스가 중단 없이 계속됩니다.

감사합니다.
- POLARAD 팀`,

    expired: `[POLARAD 서비스 만료 안내]

안녕하세요, ${clientName} 담당자님.

POLARAD 서비스가 만료되어 데이터 수집이 중단되었습니다.

서비스 재개를 원하시면 담당자에게 연락 부탁드립니다.

감사합니다.
- POLARAD 팀`,
  };

  return templates[type];
}

// GET: SMS 발송 이력
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

    const smsLogs = await prisma.smsLog.findMany({
      where,
      include: {
        client: {
          select: {
            id: true,
            clientName: true,
          },
        },
      },
      orderBy: { sentAt: "desc" },
      take: limit,
    });

    return NextResponse.json({
      success: true,
      data: smsLogs,
      total: smsLogs.length,
    });
  } catch (error) {
    if (error instanceof Error && error.message === "UNAUTHORIZED") {
      return NextResponse.json({ error: "인증이 필요합니다" }, { status: 401 });
    }
    console.error("[Admin API] GET /api/admin/renewal/sms error:", error);
    return NextResponse.json(
      { success: false, error: "SMS 이력 조회에 실패했습니다." },
      { status: 500 }
    );
  }
}

// POST: SMS 발송
export async function POST(request: NextRequest) {
  try {
    await requireAdmin();

    const body = await request.json();
    const { clientId, messageType, customMessage } = body;

    if (!clientId || !messageType) {
      return NextResponse.json(
        { success: false, error: "clientId와 messageType은 필수입니다." },
        { status: 400 }
      );
    }

    // 유효한 메시지 타입 확인
    const validTypes = ["d7", "d3", "d0", "expired", "custom"];
    if (!validTypes.includes(messageType)) {
      return NextResponse.json(
        { success: false, error: "유효하지 않은 메시지 타입입니다." },
        { status: 400 }
      );
    }

    // 클라이언트 정보 조회
    const client = await prisma.client.findUnique({
      where: { id: clientId },
      select: {
        id: true,
        clientName: true,
        contactPhone: true,
        phone: true,
        servicePeriodEnd: true,
      },
    });

    if (!client) {
      return NextResponse.json(
        { success: false, error: "클라이언트를 찾을 수 없습니다." },
        { status: 404 }
      );
    }

    // 전화번호 확인
    const phone = client.contactPhone || client.phone;
    if (!phone) {
      return NextResponse.json(
        { success: false, error: "연락처가 등록되어 있지 않습니다." },
        { status: 400 }
      );
    }

    // 메시지 내용 생성
    let content: string;
    if (messageType === "custom" && customMessage) {
      content = customMessage;
    } else {
      const endDate = client.servicePeriodEnd
        ? client.servicePeriodEnd.toISOString().split("T")[0]
        : "미정";
      const now = new Date();
      const daysLeft = client.servicePeriodEnd
        ? Math.ceil(
            (client.servicePeriodEnd.getTime() - now.getTime()) /
              (1000 * 60 * 60 * 24)
          )
        : 0;

      content = getSmsTemplate(
        messageType as "d7" | "d3" | "d0" | "expired",
        client.clientName,
        endDate,
        daysLeft
      );
    }

    // SMS 발송
    const result = await sendNcpSms(phone, content);

    // 발송 로그 저장
    const smsLog = await prisma.smsLog.create({
      data: {
        clientId,
        messageType,
        phone,
        status: result.success ? "success" : "failed",
        requestId: result.requestId || null,
        error: result.error || null,
      },
    });

    if (result.success) {
      return NextResponse.json({
        success: true,
        data: smsLog,
        message: `${client.clientName}에게 SMS가 발송되었습니다.`,
      });
    } else {
      return NextResponse.json({
        success: false,
        data: smsLog,
        error: result.error,
      });
    }
  } catch (error) {
    if (error instanceof Error && error.message === "UNAUTHORIZED") {
      return NextResponse.json({ error: "인증이 필요합니다" }, { status: 401 });
    }
    console.error("[Admin API] POST /api/admin/renewal/sms error:", error);
    return NextResponse.json(
      { success: false, error: "SMS 발송에 실패했습니다." },
      { status: 500 }
    );
  }
}
