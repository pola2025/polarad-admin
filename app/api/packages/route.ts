import { NextResponse } from "next/server";
import { prisma } from "@polarad/database";
import { requireAdmin } from "@/lib/auth";

// GET: 패키지 목록 조회
export async function GET() {
  try {
    await requireAdmin();

    const packages = await prisma.package.findMany({
      where: { isActive: true },
      orderBy: { sortOrder: "asc" },
      select: {
        id: true,
        name: true,
        displayName: true,
        price: true,
        description: true,
        features: true,
      },
    });

    return NextResponse.json({ packages });
  } catch (error) {
    if (error instanceof Error && error.message === "UNAUTHORIZED") {
      return NextResponse.json({ error: "인증이 필요합니다" }, { status: 401 });
    }
    console.error("[Admin API] GET /api/packages error:", error);
    return NextResponse.json(
      { error: "패키지 목록을 불러올 수 없습니다" },
      { status: 500 }
    );
  }
}
