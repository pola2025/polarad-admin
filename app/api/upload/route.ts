/**
 * 파일 업로드 API
 * POST: Presigned URL 생성 (관리자용)
 */

import { NextRequest, NextResponse } from "next/server";
import { requireAdmin } from "@/lib/auth";
import { S3Client, PutObjectCommand } from "@aws-sdk/client-s3";
import { getSignedUrl } from "@aws-sdk/s3-request-presigner";

// 허용된 파일 타입
const ALLOWED_TYPES: Record<string, string> = {
  "image/jpeg": ".jpg",
  "image/png": ".png",
  "application/pdf": ".pdf",
  "application/postscript": ".ai",
  "application/illustrator": ".ai",
};

const MAX_FILE_SIZE = 10 * 1024 * 1024; // 10MB

export async function POST(request: NextRequest) {
  try {
    const admin = await requireAdmin();

    const body = await request.json();
    const { fileName, contentType, category = "communications" } = body;

    if (!fileName || !contentType) {
      return NextResponse.json(
        { error: "파일명과 컨텐츠 타입은 필수입니다" },
        { status: 400 }
      );
    }

    // 파일 타입 검증
    if (!Object.keys(ALLOWED_TYPES).includes(contentType)) {
      return NextResponse.json(
        { error: "허용되지 않는 파일 형식입니다. (jpg, png, pdf, ai만 가능)" },
        { status: 400 }
      );
    }

    // 관리자용 업로드 경로 생성
    const timestamp = Date.now();
    const cleanFileName = fileName.replace(/[^a-zA-Z0-9가-힣.-]/g, "_");
    const ext = ALLOWED_TYPES[contentType];
    const key = `polarad/admin/${category}/${admin.userId}/${timestamp}_${cleanFileName}${ext}`;

    const { uploadUrl, publicUrl } = await getPresignedUploadUrl(key, contentType);

    return NextResponse.json({
      success: true,
      uploadUrl,
      publicUrl,
      key,
      maxSize: MAX_FILE_SIZE,
    });
  } catch (error) {
    if (error instanceof Error && error.message === "UNAUTHORIZED") {
      return NextResponse.json({ error: "인증이 필요합니다" }, { status: 401 });
    }
    console.error("[Upload API] Error:", error);
    return NextResponse.json(
      { error: "업로드 URL 생성 중 오류가 발생했습니다" },
      { status: 500 }
    );
  }
}

// Presigned URL 생성
async function getPresignedUploadUrl(
  key: string,
  contentType: string
): Promise<{ uploadUrl: string; publicUrl: string }> {
  const R2_ACCOUNT_ID = process.env.CLOUDFLARE_ACCOUNT_ID!;
  const R2_ACCESS_KEY_ID = process.env.CLOUDFLARE_R2_ACCESS_KEY_ID!;
  const R2_SECRET_ACCESS_KEY = process.env.CLOUDFLARE_R2_SECRET_ACCESS_KEY!;
  const R2_BUCKET = process.env.CLOUDFLARE_R2_BUCKET!;
  const R2_PUBLIC_DOMAIN = process.env.CLOUDFLARE_R2_PUBLIC_DOMAIN!;

  const client = new S3Client({
    region: "auto",
    endpoint: `https://${R2_ACCOUNT_ID}.r2.cloudflarestorage.com`,
    credentials: {
      accessKeyId: R2_ACCESS_KEY_ID,
      secretAccessKey: R2_SECRET_ACCESS_KEY,
    },
  });

  const command = new PutObjectCommand({
    Bucket: R2_BUCKET,
    Key: key,
    ContentType: contentType,
  });

  const uploadUrl = await getSignedUrl(client, command, { expiresIn: 3600 });
  const publicUrl = `${R2_PUBLIC_DOMAIN}/${key}`;

  return { uploadUrl, publicUrl };
}
