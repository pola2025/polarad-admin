import { cookies } from "next/headers";
import { jwtVerify } from "jose";

const JWT_SECRET = new TextEncoder().encode(
  process.env.NEXTAUTH_SECRET || "polarad-secret-key-change-in-production"
);

// 사용자 JWT 페이로드
export interface UserJWTPayload {
  userId: string;
  email: string;
  name: string;
  clientName: string;
  type: "user";
}

// 관리자 JWT 페이로드
export interface AdminJWTPayload {
  userId: string;
  email: string;
  name: string;
  role: "SUPER" | "MANAGER" | "OPERATOR";
  type: "admin";
}

// 통합 JWT 페이로드
export type JWTPayload = UserJWTPayload | AdminJWTPayload;

// 현재 세션 가져오기
export async function getCurrentSession(): Promise<JWTPayload | null> {
  try {
    const cookieStore = await cookies();
    const token = cookieStore.get("auth-token")?.value;

    if (!token) {
      return null;
    }

    const { payload } = await jwtVerify(token, JWT_SECRET);
    return payload as unknown as JWTPayload;
  } catch {
    return null;
  }
}

// 사용자 세션 가져오기 (타입 안전)
export async function getCurrentUser(): Promise<UserJWTPayload | null> {
  const session = await getCurrentSession();
  if (session?.type === "user") {
    return session as UserJWTPayload;
  }
  return null;
}

// 관리자 세션 가져오기 (타입 안전)
export async function getCurrentAdmin(): Promise<AdminJWTPayload | null> {
  const session = await getCurrentSession();
  if (session?.type === "admin") {
    return session as AdminJWTPayload;
  }
  return null;
}

// 사용자 인증 필수
export async function requireUser(): Promise<UserJWTPayload> {
  const user = await getCurrentUser();
  if (!user) {
    throw new Error("UNAUTHORIZED");
  }
  return user;
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

// 레거시 호환 (기존 코드용)
export async function requireAuth(): Promise<JWTPayload> {
  const session = await getCurrentSession();
  if (!session) {
    throw new Error("UNAUTHORIZED");
  }
  return session;
}
