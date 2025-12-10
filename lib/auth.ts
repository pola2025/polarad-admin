import { cookies } from "next/headers";
import { jwtVerify } from "jose";

const JWT_SECRET = new TextEncoder().encode(
  process.env.NEXTAUTH_SECRET || "polarad-secret-key-change-in-production"
);

// 관리자 JWT 페이로드
export interface AdminJWTPayload {
  userId: string;
  email: string;
  name: string;
  role: "SUPER" | "MANAGER" | "OPERATOR";
  type: "admin";
}

// 현재 관리자 세션 가져오기
export async function getCurrentAdmin(): Promise<AdminJWTPayload | null> {
  try {
    const cookieStore = await cookies();
    const token = cookieStore.get("auth-token")?.value;

    if (!token) {
      return null;
    }

    const { payload } = await jwtVerify(token, JWT_SECRET);

    // admin 타입만 허용
    if ((payload as { type?: string }).type !== "admin") {
      return null;
    }

    return payload as unknown as AdminJWTPayload;
  } catch {
    return null;
  }
}

// 관리자 인증 필수
export async function requireAdmin(): Promise<AdminJWTPayload> {
  const admin = await getCurrentAdmin();
  if (!admin) {
    throw new Error("UNAUTHORIZED");
  }
  return admin;
}

// 특정 역할 필수
export async function requireAdminRole(
  requiredRoles: ("SUPER" | "MANAGER" | "OPERATOR")[]
): Promise<AdminJWTPayload> {
  const admin = await requireAdmin();
  if (!requiredRoles.includes(admin.role)) {
    throw new Error("FORBIDDEN");
  }
  return admin;
}
