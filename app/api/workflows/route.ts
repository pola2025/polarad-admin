/**
 * Admin 앱 - 워크플로우 API
 * GET: 워크플로우 목록 조회
 * POST: 워크플로우 생성 (사용자 등록 시 자동 생성용)
 */

import { NextRequest, NextResponse } from "next/server";
import { prisma, WorkflowType, WorkflowStatus } from "@polarad/database";
import { requireAdmin } from "@/lib/auth";

// GET: 워크플로우 목록 조회
export async function GET(request: NextRequest) {
  try {
    await requireAdmin();

    const { searchParams } = new URL(request.url);
    const page = parseInt(searchParams.get("page") || "1");
    const limit = parseInt(searchParams.get("limit") || "20");
    const userId = searchParams.get("userId");
    const type = searchParams.get("type") as WorkflowType | null;
    const status = searchParams.get("status") as WorkflowStatus | null;

    const skip = (page - 1) * limit;

    // 검색 조건
    const where: Record<string, unknown> = {};

    if (userId) {
      where.userId = userId;
    }
    if (type) {
      where.type = type;
    }
    if (status) {
      where.status = status;
    }

    // 전체 개수 조회
    const total = await prisma.workflow.count({ where });

    // 워크플로우 목록 조회
    const workflows = await prisma.workflow.findMany({
      where,
      include: {
        user: {
          select: {
            id: true,
            clientName: true,
            name: true,
            phone: true,
          },
        },
        logs: {
          orderBy: { createdAt: "desc" },
          take: 3,
        },
      },
      orderBy: { updatedAt: "desc" },
      skip,
      take: limit,
    });

    // 상태별 통계
    const stats = {
      total: await prisma.workflow.count(),
      pending: await prisma.workflow.count({ where: { status: "PENDING" } }),
      submitted: await prisma.workflow.count({ where: { status: "SUBMITTED" } }),
      inProgress: await prisma.workflow.count({ where: { status: "IN_PROGRESS" } }),
      designUploaded: await prisma.workflow.count({ where: { status: "DESIGN_UPLOADED" } }),
      orderRequested: await prisma.workflow.count({ where: { status: "ORDER_REQUESTED" } }),
      completed: await prisma.workflow.count({ where: { status: "COMPLETED" } }),
      shipped: await prisma.workflow.count({ where: { status: "SHIPPED" } }),
    };

    return NextResponse.json({
      success: true,
      data: workflows,
      pagination: {
        page,
        limit,
        total,
        totalPages: Math.ceil(total / limit),
      },
      stats,
    });
  } catch (error) {
    if (error instanceof Error && error.message === "UNAUTHORIZED") {
      return NextResponse.json({ error: "인증이 필요합니다" }, { status: 401 });
    }
    console.error("[Admin API] GET /api/workflows error:", error);
    return NextResponse.json(
      { error: "워크플로우 목록 조회 중 오류가 발생했습니다" },
      { status: 500 }
    );
  }
}

// POST: 워크플로우 생성 (사용자 등록 시 자동 생성용)
export async function POST(request: NextRequest) {
  try {
    await requireAdmin();

    const body = await request.json();
    const { userId, types } = body;

    if (!userId) {
      return NextResponse.json(
        { error: "사용자 ID가 필요합니다" },
        { status: 400 }
      );
    }

    // 사용자 존재 확인
    const user = await prisma.user.findUnique({
      where: { id: userId },
    });

    if (!user) {
      return NextResponse.json(
        { error: "사용자를 찾을 수 없습니다" },
        { status: 404 }
      );
    }

    // 기본 워크플로우 타입
    const defaultTypes: WorkflowType[] = types || [
      "NAMECARD",
      "NAMETAG",
      "CONTRACT",
      "ENVELOPE",
      "WEBSITE",
    ];

    // 기존 워크플로우 확인
    const existingWorkflows = await prisma.workflow.findMany({
      where: { userId },
      select: { type: true },
    });

    const existingTypes = existingWorkflows.map((w) => w.type);
    const newTypes = defaultTypes.filter((t) => !existingTypes.includes(t));

    if (newTypes.length === 0) {
      return NextResponse.json({
        success: true,
        message: "이미 모든 워크플로우가 생성되어 있습니다",
        created: 0,
      });
    }

    // 새 워크플로우 생성
    const workflows = await prisma.workflow.createMany({
      data: newTypes.map((type) => ({
        userId,
        type,
        status: "PENDING",
      })),
    });

    return NextResponse.json({
      success: true,
      message: `${workflows.count}개의 워크플로우가 생성되었습니다`,
      created: workflows.count,
    });
  } catch (error) {
    if (error instanceof Error && error.message === "UNAUTHORIZED") {
      return NextResponse.json({ error: "인증이 필요합니다" }, { status: 401 });
    }
    console.error("[Admin API] POST /api/workflows error:", error);
    return NextResponse.json(
      { error: "워크플로우 생성 중 오류가 발생했습니다" },
      { status: 500 }
    );
  }
}
