/**
 * Admin API - 시안 버전 관리
 * POST: 새 버전 업로드
 */

import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@polarad/database";
import { requireAdmin } from "@/lib/auth";

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const admin = await requireAdmin();
    const { id } = await params;

    const body = await request.json();
    const { url, note } = body;

    if (!url) {
      return NextResponse.json(
        { error: "시안 URL은 필수입니다" },
        { status: 400 }
      );
    }

    // 시안 존재 확인
    const design = await prisma.design.findUnique({
      where: { id },
    });

    if (!design) {
      return NextResponse.json(
        { error: "시안을 찾을 수 없습니다" },
        { status: 404 }
      );
    }

    // 새 버전 생성 및 시안 업데이트
    const newVersion = design.currentVersion + 1;

    const [version, updatedDesign] = await prisma.$transaction([
      prisma.designVersion.create({
        data: {
          designId: id,
          version: newVersion,
          url,
          note: note || `v${newVersion} 업로드`,
          uploadedBy: admin.userId,
        },
        include: {
          feedbacks: true,
        },
      }),
      prisma.design.update({
        where: { id },
        data: {
          currentVersion: newVersion,
          status: "DRAFT", // 새 버전 업로드 시 상태 리셋
        },
      }),
    ]);

    return NextResponse.json({
      success: true,
      data: version,
    });
  } catch (error) {
    if (error instanceof Error && error.message === "UNAUTHORIZED") {
      return NextResponse.json({ error: "인증이 필요합니다" }, { status: 401 });
    }
    console.error("[Admin API] POST /api/admin/designs/[id]/versions error:", error);
    return NextResponse.json(
      { error: "버전 생성 중 오류가 발생했습니다" },
      { status: 500 }
    );
  }
}
