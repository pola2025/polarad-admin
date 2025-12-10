import {
  S3Client,
  PutObjectCommand,
  DeleteObjectCommand,
} from "@aws-sdk/client-s3";
import { getSignedUrl } from "@aws-sdk/s3-request-presigner";

const R2_ACCOUNT_ID = process.env.CLOUDFLARE_ACCOUNT_ID!;
const R2_ACCESS_KEY_ID = process.env.CLOUDFLARE_R2_ACCESS_KEY_ID!;
const R2_SECRET_ACCESS_KEY = process.env.CLOUDFLARE_R2_SECRET_ACCESS_KEY!;
const R2_BUCKET = process.env.CLOUDFLARE_R2_BUCKET!;
const R2_PUBLIC_DOMAIN = process.env.CLOUDFLARE_R2_PUBLIC_DOMAIN!;

export const r2Client = new S3Client({
  region: "auto",
  endpoint: `https://${R2_ACCOUNT_ID}.r2.cloudflarestorage.com`,
  credentials: {
    accessKeyId: R2_ACCESS_KEY_ID,
    secretAccessKey: R2_SECRET_ACCESS_KEY,
  },
});

// 허용된 파일 타입
const ALLOWED_TYPES = {
  "image/jpeg": ".jpg",
  "image/png": ".png",
  "application/pdf": ".pdf",
};

const MAX_FILE_SIZE = 10 * 1024 * 1024; // 10MB

interface UploadUrlResponse {
  uploadUrl: string;
  publicUrl: string;
  key: string;
}

// Presigned URL 생성 (클라이언트에서 직접 업로드용)
export async function getPresignedUploadUrl(
  userId: string,
  fileName: string,
  contentType: string
): Promise<UploadUrlResponse> {
  // 파일 타입 검증
  if (!Object.keys(ALLOWED_TYPES).includes(contentType)) {
    throw new Error("허용되지 않는 파일 형식입니다. (jpg, png, pdf만 가능)");
  }

  // 파일명 정리 (특수문자 제거)
  const cleanFileName = fileName.replace(/[^a-zA-Z0-9가-힣.-]/g, "_");
  const timestamp = Date.now();
  const ext = ALLOWED_TYPES[contentType as keyof typeof ALLOWED_TYPES];
  const key = `polarad/submissions/${userId}/${timestamp}_${cleanFileName}${ext}`;

  const command = new PutObjectCommand({
    Bucket: R2_BUCKET,
    Key: key,
    ContentType: contentType,
  });

  const uploadUrl = await getSignedUrl(r2Client, command, { expiresIn: 3600 });
  const publicUrl = `${R2_PUBLIC_DOMAIN}/${key}`;

  return { uploadUrl, publicUrl, key };
}

// 파일 삭제
export async function deleteFile(key: string): Promise<void> {
  const command = new DeleteObjectCommand({
    Bucket: R2_BUCKET,
    Key: key,
  });

  await r2Client.send(command);
}

// 파일 키 추출 (public URL에서)
export function extractKeyFromUrl(publicUrl: string): string | null {
  if (!publicUrl.startsWith(R2_PUBLIC_DOMAIN)) {
    return null;
  }
  return publicUrl.replace(`${R2_PUBLIC_DOMAIN}/`, "");
}

export { MAX_FILE_SIZE, ALLOWED_TYPES };
