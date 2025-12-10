/**
 * 마이그레이션 스크립트: Workflow.designUrl → Design 테이블
 *
 * 실행 방법:
 * cd packages/database
 * npx tsx prisma/migrate-designs.ts
 */

import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient();

async function migrateDesigns() {
  console.log("🔄 시안 마이그레이션 시작...\n");

  // 1. designUrl이 있는 워크플로우 조회
  const workflowsWithDesign = await prisma.workflow.findMany({
    where: {
      designUrl: { not: null },
      design: null, // 아직 Design이 없는 경우만
    },
    include: {
      user: {
        select: {
          id: true,
          name: true,
          clientName: true,
        },
      },
    },
  });

  console.log(`📋 마이그레이션 대상: ${workflowsWithDesign.length}개 워크플로우\n`);

  if (workflowsWithDesign.length === 0) {
    console.log("✅ 마이그레이션할 데이터가 없습니다.");
    return;
  }

  let successCount = 0;
  let failCount = 0;

  for (const workflow of workflowsWithDesign) {
    try {
      console.log(`- [${workflow.user.clientName}] ${workflow.type}...`);

      // 시안 상태 결정
      let designStatus: "DRAFT" | "PENDING_REVIEW" | "APPROVED" = "PENDING_REVIEW";

      // 워크플로우 상태에 따른 시안 상태 매핑
      if (workflow.status === "DESIGN_UPLOADED") {
        designStatus = "PENDING_REVIEW";
      } else if (
        workflow.status === "ORDER_REQUESTED" ||
        workflow.status === "ORDER_APPROVED" ||
        workflow.status === "COMPLETED" ||
        workflow.status === "SHIPPED"
      ) {
        designStatus = "APPROVED";
      }

      // Design 생성
      await prisma.design.create({
        data: {
          workflowId: workflow.id,
          status: designStatus,
          currentVersion: workflow.revisionCount || 1,
          approvedAt: designStatus === "APPROVED" ? new Date() : null,
          approvedVersion: designStatus === "APPROVED" ? (workflow.revisionCount || 1) : null,
          versions: {
            create: {
              version: 1,
              url: workflow.designUrl!,
              note: workflow.revisionNote || "마이그레이션된 시안",
              uploadedBy: "SYSTEM_MIGRATION",
            },
          },
        },
      });

      successCount++;
      console.log(`  ✅ 완료 (상태: ${designStatus})`);
    } catch (error) {
      failCount++;
      console.error(`  ❌ 실패:`, error);
    }
  }

  console.log("\n" + "=".repeat(50));
  console.log(`✅ 마이그레이션 완료`);
  console.log(`  - 성공: ${successCount}건`);
  console.log(`  - 실패: ${failCount}건`);
  console.log("=".repeat(50));
}

migrateDesigns()
  .catch(console.error)
  .finally(() => prisma.$disconnect());
