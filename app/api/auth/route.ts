import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@polarad/database";
import bcrypt from "bcryptjs";
import { SignJWT } from "jose";

const JWT_SECRET = new TextEncoder().encode(
  process.env.NEXTAUTH_SECRET || "polarad-secret-key-change-in-production"
);

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { password } = body;

    // 필수 필드 검증
    if (!password) {
      return NextResponse.json(
        { error: "비밀번호를 입력해주세요" },
        { status: 400 }
      );
    }

    // 활성화된 관리자 목록 가져오기
    const admins = await prisma.admin.findMany({
      where: { isActive: true },
    });

    if (admins.length === 0) {
      return NextResponse.json(
        { error: "등록된 관리자가 없습니다" },
        { status: 401 }
      );
    }

    // 비밀번호가 일치하는 관리자 찾기
    let matchedAdmin = null;
    for (const admin of admins) {
      const isValidPassword = await bcrypt.compare(password, admin.password);
      if (isValidPassword) {
        matchedAdmin = admin;
        break;
      }
    }

    if (!matchedAdmin) {
      return NextResponse.json(
        { error: "비밀번호가 일치하지 않습니다" },
        { status: 401 }
      );
    }

    // JWT 토큰 생성 (관리자용)
    const token = await new SignJWT({
      userId: matchedAdmin.id,
      email: matchedAdmin.email,
      name: matchedAdmin.name,
      role: matchedAdmin.role,
      type: "admin",
    })
      .setProtectedHeader({ alg: "HS256" })
      .setIssuedAt()
      .setExpirationTime("24h")
      .sign(JWT_SECRET);

    // 응답 생성
    const response = NextResponse.json({
      success: true,
      admin: {
        id: matchedAdmin.id,
        name: matchedAdmin.name,
        email: matchedAdmin.email,
        role: matchedAdmin.role,
      },
    });

    // 쿠키에 토큰 저장
    // Vercel 프로덕션에서는 HTTPS이므로 secure: true 필수
    // VERCEL 환경변수가 있으면 Vercel 환경으로 판단
    const isVercel = !!process.env.VERCEL;
    response.cookies.set("auth-token", token, {
      httpOnly: true,
      secure: isVercel, // Vercel 환경에서만 secure
      sameSite: "lax",
      maxAge: 60 * 60 * 24, // 24시간
      path: "/",
    });

    return response;
  } catch (error) {
    console.error("Admin login error:", error);
    const errorMessage = error instanceof Error ? error.message : "Unknown error";
    return NextResponse.json(
      { error: "로그인 처리 중 오류가 발생했습니다", detail: errorMessage },
      { status: 500 }
    );
  }
}
