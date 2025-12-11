import { NextRequest, NextResponse } from "next/server";
import { requireAdmin } from "@/lib/auth";
import { prisma } from "@polarad/database";

// GET: 계약 상세 조회
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
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
        },
      },
    });

    if (!contract) {
      return NextResponse.json(
        { error: "계약을 찾을 수 없습니다" },
        { status: 404 }
      );
    }

    return NextResponse.json({ contract });
  } catch (error) {
    if (error instanceof Error && error.message === "UNAUTHORIZED") {
      return NextResponse.json({ error: "인증이 필요합니다" }, { status: 401 });
    }
    console.error("[Admin API] GET /api/admin/contracts/[id] error:", error);
    return NextResponse.json(
      { error: "계약 정보를 불러올 수 없습니다" },
      { status: 500 }
    );
  }
}

// DELETE: 계약 삭제
export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    await requireAdmin();
    const { id } = await params;

    const contract = await prisma.contract.findUnique({
      where: { id },
      select: { id: true, status: true, contractNumber: true },
    });

    if (!contract) {
      return NextResponse.json(
        { error: "계약을 찾을 수 없습니다" },
        { status: 404 }
      );
    }

    // ACTIVE 상태의 계약은 삭제 불가
    if (contract.status === "ACTIVE") {
      return NextResponse.json(
        { error: "진행 중인 계약은 삭제할 수 없습니다" },
        { status: 400 }
      );
    }

    // 계약 로그 삭제 후 계약 삭제 (cascade로 자동 삭제되지만 명시적으로)
    await prisma.contract.delete({
      where: { id },
    });

    return NextResponse.json({
      success: true,
      message: `계약서 ${contract.contractNumber}가 삭제되었습니다`,
    });
  } catch (error) {
    if (error instanceof Error && error.message === "UNAUTHORIZED") {
      return NextResponse.json({ error: "인증이 필요합니다" }, { status: 401 });
    }
    console.error("[Admin API] DELETE /api/admin/contracts/[id] error:", error);
    return NextResponse.json(
      { error: "계약 삭제 중 오류가 발생했습니다" },
      { status: 500 }
    );
  }
}
