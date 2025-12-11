/**
 * Admin API - 시안(Design) 관리
 * GET: 전체 시안 목록 조회
 * POST: 새 시안 생성 (첫 번전 포함)
 */

import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@polarad/database";
import { requireAdmin } from "@/lib/auth";

export async function GET(request: NextRequest) {
  try {
    const admin = await requireAdmin();

    const { searchParams } = new URL(request.url);
    const page = parseInt(searchParams.get("page") || "1");
    const limit = parseInt(searchParams.get("limit") || "20");
    const search = searchParams.get("search") || "";
    const status = searchParams.get("status"); // DRAFT, PENDING_REVIEW, REVISION_REQUESTED, APPROVED
    const type = searchParams.get("type"); // WorkflowType

    const skip = (page - 1) * limit;

    // 검색 조건
    const where: Record<string, unknown> = {};

    if (search) {
      where.workflow = {
        user: {
          OR: [
            { name: { contains: search, mode: "insensitive" } },
            { clientName: { contains: search, mode: "insensitive" } },
            { email: { contains: search, mode: "insensitive" } },
          ],
        },
      };
    }

    if (status && status !== "all") {
      where.status = status;
    }

    if (type && type !== "all") {
      where.workflow = {
        ...(where.workflow as object || {}),
        type,
      };
    }

    // 전체 개수 조회
    const total = await prisma.design.count({ where });

    // 시안 목록 조회
    const designs = await prisma.design.findMany({
      where,
      include: {
        workflow: {
          select: {
            id: true,
            type: true,
            status: true,
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
        },
        versions: {
          orderBy: { version: "desc" },
          take: 1, // 최신 버전만
          include: {
            feedbacks: {
              orderBy: { createdAt: "desc" },
              take: 1, // 최신 피드백만
            },
          },
        },
      },
      orderBy: [
        { status: "asc" }, // PENDING_REVIEW, REVISION_REQUESTED 우선
        { updatedAt: "desc" },
      ],
      skip,
      take: limit,
    });

    // 상태별 통계
    const stats = {
      total: await prisma.design.count(),
      draft: await prisma.design.count({ where: { status: "DRAFT" } }),
      pendingReview: await prisma.design.count({ where: { status: "PENDING_REVIEW" } }),
      revisionRequested: await prisma.design.count({ where: { status: "REVISION_REQUESTED" } }),
      approved: await prisma.design.count({ where: { status: "APPROVED" } }),
    };

    return NextResponse.json({
      success: true,
      data: designs,
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
    console.error("[Admin API] GET /api/admin/designs error:", error);
    return NextResponse.json(
      { error: "시안 목록 조회 중 오류가 발생했습니다" },
      { status: 500 }
    );
  }
}

export async function POST(request: NextRequest) {
  try {
    const admin = await requireAdmin();

    const body = await request.json();
    const { workflowId, userId, workflowType, url, note, threadId, initialContent } = body;

    // Case 1: 워크플로우 ID로 직접 생성 (기존 로직)
    if (workflowId) {
      if (!url) {
        return NextResponse.json(
          { error: "시안 URL은 필수입니다" },
          { status: 400 }
        );
      }

      const workflow = await prisma.workflow.findUnique({
        where: { id: workflowId },
        include: { design: true },
      });

      if (!workflow) {
        return NextResponse.json(
          { error: "해당 워크플로우를 찾을 수 없습니다" },
          { status: 404 }
        );
      }

      if (workflow.design) {
        return NextResponse.json(
          { error: "이미 시안이 존재합니다. 새 버전을 추가하세요." },
          { status: 400 }
        );
      }

      const design = await prisma.design.create({
        data: {
          workflowId,
          status: "DRAFT",
          currentVersion: 1,
          versions: {
            create: {
              version: 1,
              url,
              note: note || "최초 시안",
              uploadedBy: admin.userId,
            },
          },
        },
        include: {
          versions: true,
          workflow: {
            select: {
              id: true,
              type: true,
              user: {
                select: {
                  id: true,
                  name: true,
                  clientName: true,
                },
              },
            },
          },
        },
      });

      return NextResponse.json({
        success: true,
        data: design,
      });
    }

    // Case 2: 문의 스레드에서 시안 생성 (userId + workflowType 필요)
    if (userId && workflowType) {
      // 해당 사용자의 워크플로우 찾기 또는 생성
      let workflow = await prisma.workflow.findFirst({
        where: {
          userId,
          type: workflowType,
        },
        include: { design: true },
      });

      // 워크플로우가 없으면 새로 생성
      if (!workflow) {
        workflow = await prisma.workflow.create({
          data: {
            userId,
            type: workflowType,
            status: "IN_PROGRESS",
          },
          include: { design: true },
        });
      }

      // 이미 시안이 있으면 해당 시안으로 이동
      if (workflow.design) {
        // 초기 내용이 있으면 피드백으로 추가
        if (initialContent) {
          const latestVersion = await prisma.designVersion.findFirst({
            where: { designId: workflow.design.id },
            orderBy: { version: "desc" },
          });

          if (latestVersion) {
            await prisma.designFeedback.create({
              data: {
                versionId: latestVersion.id,
                authorId: admin.userId,
                authorType: "admin",
                authorName: admin.name,
                content: `[문의에서 이동] ${initialContent}`,
              },
            });
          }
        }

        return NextResponse.json({
          success: true,
          data: workflow.design,
          message: "기존 시안으로 이동합니다.",
          existing: true,
        });
      }

      // 새 시안 생성 (URL 없이도 가능)
      const design = await prisma.design.create({
        data: {
          workflowId: workflow.id,
          status: "DRAFT",
          currentVersion: 1,
          versions: {
            create: {
              version: 1,
              url: url || "",
              note: note || (threadId ? `문의 #${threadId.slice(-6)}에서 생성됨` : "문의에서 생성됨"),
              uploadedBy: admin.userId,
            },
          },
        },
        include: {
          versions: true,
          workflow: {
            select: {
              id: true,
              type: true,
              user: {
                select: {
                  id: true,
                  name: true,
                  clientName: true,
                },
              },
            },
          },
        },
      });

      // 초기 내용이 있으면 피드백으로 추가
      if (initialContent && design.versions[0]) {
        await prisma.designFeedback.create({
          data: {
            versionId: design.versions[0].id,
            authorId: admin.userId,
            authorType: "admin",
            authorName: admin.name,
            content: `[문의 내용]\n${initialContent}`,
          },
        });
      }

      // 문의 스레드가 있으면 연결 메시지 추가
      if (threadId) {
        await prisma.communicationMessage.create({
          data: {
            threadId,
            authorId: admin.userId,
            authorType: "admin",
            authorName: admin.name,
            content: `📎 이 문의를 기반으로 시안이 생성되었습니다.\n\n시안 관리에서 진행 상황을 확인하실 수 있습니다.`,
            isReadByAdmin: true,
            isReadByUser: false,
          },
        });

        // 스레드 상태를 IN_PROGRESS로 변경
        await prisma.communicationThread.update({
          where: { id: threadId },
          data: {
            status: "IN_PROGRESS",
            lastReplyAt: new Date(),
          },
        });
      }

      return NextResponse.json({
        success: true,
        data: design,
        message: "시안이 생성되었습니다.",
      });
    }

    return NextResponse.json(
      { error: "workflowId 또는 (userId + workflowType)이 필요합니다" },
      { status: 400 }
    );
  } catch (error) {
    if (error instanceof Error && error.message === "UNAUTHORIZED") {
      return NextResponse.json({ error: "인증이 필요합니다" }, { status: 401 });
    }
    console.error("[Admin API] POST /api/admin/designs error:", error);
    return NextResponse.json(
      { error: "시안 생성 중 오류가 발생했습니다" },
      { status: 500 }
    );
  }
}
