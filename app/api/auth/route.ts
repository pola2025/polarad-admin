import { NextRequest, NextResponse } from "next/server";
import { SignJWT } from "jose";
import { sendTelegramMessage } from "@/lib/notification/telegramClient";

const JWT_SECRET = new TextEncoder().encode(
  process.env.NEXTAUTH_SECRET || "polarad-secret-key-change-in-production",
);

const ADMIN_USER = process.env.ADMIN_USER || "admin";
const ADMIN_EMAIL = process.env.ADMIN_EMAIL || "admin@polarad.co.kr";
const TELEGRAM_ADMIN_CHAT_ID = process.env.TELEGRAM_ADMIN_CHAT_ID;

// 인메모리 인증코드 저장소
interface AuthCode {
  code: string;
  expiresAt: number;
  attempts: number;
}

const authCodes = new Map<string, AuthCode>();

// 코드 생성 쿨다운 (같은 chatId로 60초 내 재요청 방지)
const cooldowns = new Map<string, number>();

function generateCode(): string {
  return Math.floor(100000 + Math.random() * 900000).toString();
}

function cleanupExpired() {
  const now = Date.now();
  for (const [key, val] of authCodes) {
    if (val.expiresAt < now) authCodes.delete(key);
  }
  for (const [key, val] of cooldowns) {
    if (val < now) cooldowns.delete(key);
  }
}

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { action } = body;

    if (action === "send-code") {
      return handleSendCode();
    }

    if (action === "verify-code") {
      return handleVerifyCode(body.code);
    }

    return NextResponse.json({ error: "잘못된 요청입니다" }, { status: 400 });
  } catch (error) {
    console.error("Admin auth error:", error);
    return NextResponse.json(
      { error: "인증 처리 중 오류가 발생했습니다" },
      { status: 500 },
    );
  }
}

async function handleSendCode() {
  if (!TELEGRAM_ADMIN_CHAT_ID) {
    console.error("TELEGRAM_ADMIN_CHAT_ID 환경변수가 설정되지 않았습니다");
    return NextResponse.json({ error: "서버 설정 오류" }, { status: 500 });
  }

  cleanupExpired();

  // 쿨다운 체크 (60초)
  const lastSent = cooldowns.get(TELEGRAM_ADMIN_CHAT_ID);
  if (lastSent && lastSent > Date.now()) {
    const remaining = Math.ceil((lastSent - Date.now()) / 1000);
    return NextResponse.json(
      { error: `${remaining}초 후에 다시 요청해주세요` },
      { status: 429 },
    );
  }

  const code = generateCode();

  // 5분 만료
  authCodes.set(TELEGRAM_ADMIN_CHAT_ID, {
    code,
    expiresAt: Date.now() + 5 * 60 * 1000,
    attempts: 0,
  });

  // 60초 쿨다운
  cooldowns.set(TELEGRAM_ADMIN_CHAT_ID, Date.now() + 60 * 1000);

  // 텔레그램으로 코드 발송
  const message = `🔐 <b>관리자 로그인 인증코드</b>\n\n<code>${code}</code>\n\n⏰ 5분 내에 입력해주세요.`;
  const result = await sendTelegramMessage(TELEGRAM_ADMIN_CHAT_ID, message);

  if (!result.ok) {
    authCodes.delete(TELEGRAM_ADMIN_CHAT_ID);
    cooldowns.delete(TELEGRAM_ADMIN_CHAT_ID);
    console.error("텔레그램 메시지 발송 실패:", result.description);
    return NextResponse.json(
      { error: "인증코드 발송에 실패했습니다" },
      { status: 500 },
    );
  }

  return NextResponse.json({
    success: true,
    message: "인증코드가 발송되었습니다",
  });
}

async function handleVerifyCode(code: string) {
  if (!code) {
    return NextResponse.json(
      { error: "인증코드를 입력해주세요" },
      { status: 400 },
    );
  }

  if (!TELEGRAM_ADMIN_CHAT_ID) {
    return NextResponse.json({ error: "서버 설정 오류" }, { status: 500 });
  }

  cleanupExpired();

  const stored = authCodes.get(TELEGRAM_ADMIN_CHAT_ID);

  if (!stored) {
    return NextResponse.json(
      { error: "인증코드가 만료되었거나 요청되지 않았습니다" },
      { status: 401 },
    );
  }

  // 최대 5회 시도
  if (stored.attempts >= 5) {
    authCodes.delete(TELEGRAM_ADMIN_CHAT_ID);
    return NextResponse.json(
      { error: "입력 횟수를 초과했습니다. 새 인증코드를 요청해주세요" },
      { status: 401 },
    );
  }

  stored.attempts++;

  if (stored.code !== code) {
    return NextResponse.json(
      { error: `인증코드가 일치하지 않습니다 (${stored.attempts}/5)` },
      { status: 401 },
    );
  }

  // 인증 성공 - 코드 삭제
  authCodes.delete(TELEGRAM_ADMIN_CHAT_ID);

  // JWT 토큰 생성
  const token = await new SignJWT({
    userId: "admin-001",
    email: ADMIN_EMAIL,
    name: ADMIN_USER,
    role: "SUPER",
    type: "admin",
  })
    .setProtectedHeader({ alg: "HS256" })
    .setIssuedAt()
    .setExpirationTime("24h")
    .sign(JWT_SECRET);

  const response = NextResponse.json({
    success: true,
    admin: {
      id: "admin-001",
      name: ADMIN_USER,
      email: ADMIN_EMAIL,
      role: "SUPER",
    },
  });

  const isVercel = !!process.env.VERCEL;
  response.cookies.set("auth-token", token, {
    httpOnly: true,
    secure: isVercel,
    sameSite: "lax",
    maxAge: 60 * 60 * 24,
    path: "/",
  });

  return response;
}
