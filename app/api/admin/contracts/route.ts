import { NextRequest, NextResponse } from "next/server";
import { requireAdmin } from "@/lib/auth";
import { prisma } from "@polarad/database";

// 계약번호 생성 (YYYYMMDD-XXXX)
async function generateContractNumber(): Promise<string> {
  const today = new Date();
  const dateStr = today.toISOString().slice(0, 10).replace(/-/g, "");

  const startOfDay = new Date(today);
  startOfDay.setHours(0, 0, 0, 0);
  const endOfDay = new Date(today);
  endOfDay.setHours(23, 59, 59, 999);

  const todayCount = await prisma.contract.count({
    where: {
      createdAt: {
        gte: startOfDay,
        lte: endOfDay,
      },
    },
  });

  const sequence = String(todayCount + 1).padStart(4, "0");
  return `${dateStr}-${sequence}`;
}

// 텔레그램 사용자 알림 발송
async function sendUserNotification(
  telegramChatId: string | null,
  contractNumber: string,
  packageName: string
) {
  if (!telegramChatId) return;

  const TELEGRAM_BOT_TOKEN = process.env.TELEGRAM_BOT_TOKEN;
  if (!TELEGRAM_BOT_TOKEN) return;

  try {
    const message = "📋 <b>계약서 작성 요청</b>\n\n새로운 계약서 작성 요청이 도착했습니다.\n\n📄 <b>계약번호:</b> " + contractNumber + "\n📦 <b>패키지:</b> " + packageName + "\n\n마이페이지에서 계약서를 작성해주세요.";

    await fetch("https://api.telegram.org/bot" + TELEGRAM_BOT_TOKEN + "/sendMessage", {
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

export async function GET(request: NextRequest) {
  try {
    await requireAdmin();

    const searchParams = request.nextUrl.searchParams;
    const search = searchParams.get("search") || "";
    const status = searchParams.get("status") || "";

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

    const contracts = await prisma.contract.findMany({
      where,
      include: {
        package: {
          select: {
            name: true,
            displayName: true,
            price: true,
          },
        },
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
      orderBy: { createdAt: "desc" },
    });

    const stats = await prisma.contract.groupBy({
      by: ["status"],
      _count: true,
    });

    const statsMap: Record<string, number> = {};
    for (const item of stats) {
      statsMap[item.status.toLowerCase()] = item._count;
    }

    return NextResponse.json({
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
    console.error("[Admin API] GET /api/admin/contracts error:", error);
    return NextResponse.json(
      { error: "계약 목록을 불러올 수 없습니다" },
      { status: 500 }
    );
  }
}

// POST: 관리자가 계약서 생성 (사용자에게 작성 요청)
export async function POST(request: NextRequest) {
  try {
    const admin = await requireAdmin();

    const body = await request.json();
    const {
      userId,
      packageId,
      contractPeriod,
      monthlyFee,
      setupFee,
      additionalNotes,
      isPromotion,
    } = body;

    if (!userId || !packageId) {
      return NextResponse.json(
        { error: "사용자와 패키지를 선택해주세요" },
        { status: 400 }
      );
    }

    const user = await prisma.user.findUnique({
      where: { id: userId },
      select: {
        id: true,
        name: true,
        clientName: true,
        telegramChatId: true,
        telegramEnabled: true,
      },
    });

    if (!user) {
      return NextResponse.json(
        { error: "사용자를 찾을 수 없습니다" },
        { status: 400 }
      );
    }

    const pkg = await prisma.package.findUnique({
      where: { id: packageId },
    });

    if (!pkg) {
      return NextResponse.json(
        { error: "패키지를 찾을 수 없습니다" },
        { status: 400 }
      );
    }

    const existingContract = await prisma.contract.findFirst({
      where: {
        userId,
        status: "PENDING",
      },
    });

    if (existingContract) {
      return NextResponse.json(
        { error: "이미 작성 대기 중인 계약서가 있습니다" },
        { status: 400 }
      );
    }

    const contractNumber = await generateContractNumber();

    const finalMonthlyFee = monthlyFee || pkg.price;
    const period = contractPeriod || 12;
    const totalAmount = finalMonthlyFee * period + (setupFee || 0);

    const contract = await prisma.contract.create({
      data: {
        contractNumber,
        userId,
        packageId,
        contractPeriod: period,
        monthlyFee: finalMonthlyFee,
        setupFee: setupFee || 0,
        totalAmount,
        additionalNotes,
        isPromotion: isPromotion || false,
        status: "PENDING",
      },
    });

    await prisma.contractLog.create({
      data: {
        contractId: contract.id,
        fromStatus: null,
        toStatus: "PENDING",
        changedBy: admin.userId,
        note: "관리자가 계약서 생성 - 사용자 작성 대기",
      },
    });

    if (user.telegramEnabled && user.telegramChatId) {
      sendUserNotification(user.telegramChatId, contractNumber, pkg.displayName);
    }

    return NextResponse.json({
      success: true,
      contractNumber,
      contract,
      message: "계약서가 생성되었습니다. " + user.clientName + "에게 작성 요청을 발송했습니다.",
    });
  } catch (error) {
    if (error instanceof Error && error.message === "UNAUTHORIZED") {
      return NextResponse.json({ error: "인증이 필요합니다" }, { status: 401 });
    }
    console.error("[Admin API] POST /api/admin/contracts error:", error);
    return NextResponse.json(
      { error: "계약서 생성 중 오류가 발생했습니다" },
      { status: 500 }
    );
  }
}
