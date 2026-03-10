"use client";

import { useState, useEffect, useRef } from "react";

import { LogIn, Shield, Send, ArrowLeft } from "lucide-react";

type Step = "request" | "verify";

export default function AdminLoginPage() {
  const [step, setStep] = useState<Step>("request");
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [code, setCode] = useState("");
  const [cooldown, setCooldown] = useState(0);
  const codeInputRef = useRef<HTMLInputElement>(null);

  // 쿨다운 타이머
  useEffect(() => {
    if (cooldown <= 0) return;
    const timer = setInterval(() => {
      setCooldown((prev) => (prev <= 1 ? 0 : prev - 1));
    }, 1000);
    return () => clearInterval(timer);
  }, [cooldown]);

  // 코드 입력 단계로 전환 시 자동 포커스
  useEffect(() => {
    if (step === "verify") {
      codeInputRef.current?.focus();
    }
  }, [step]);

  const handleRequestCode = async () => {
    setIsLoading(true);
    setError(null);

    try {
      const response = await fetch("/api/auth", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action: "send-code" }),
      });

      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.error || "인증코드 요청에 실패했습니다");
      }

      setStep("verify");
      setCooldown(60);
    } catch (err) {
      setError(
        err instanceof Error ? err.message : "인증코드 요청에 실패했습니다",
      );
    } finally {
      setIsLoading(false);
    }
  };

  const handleVerifyCode = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!code.trim()) {
      setError("인증코드를 입력해주세요");
      return;
    }

    setIsLoading(true);
    setError(null);

    try {
      const response = await fetch("/api/auth", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action: "verify-code", code: code.trim() }),
        credentials: "include",
      });

      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.error || "인증에 실패했습니다");
      }

      window.location.href = "/";
    } catch (err) {
      setError(err instanceof Error ? err.message : "인증에 실패했습니다");
      setIsLoading(false);
    }
  };

  const handleBack = () => {
    setStep("request");
    setCode("");
    setError(null);
  };

  return (
    <div className="min-h-screen flex items-center justify-center p-4 bg-gray-900">
      <div className="w-full max-w-md">
        {/* 로고 */}
        <div className="text-center mb-8">
          <div className="inline-flex items-center gap-2">
            <div className="w-10 h-10 bg-indigo-600 rounded-xl flex items-center justify-center">
              <Shield className="w-5 h-5 text-white" />
            </div>
            <span className="text-2xl font-bold text-white">Polarad Admin</span>
          </div>
          <p className="mt-2 text-gray-400">텔레그램 인증 로그인</p>
        </div>

        {/* 로그인 카드 */}
        <div className="bg-gray-800 rounded-2xl shadow-xl p-6 border border-gray-700">
          {/* 에러 메시지 */}
          {error && (
            <div className="mb-4 p-3 bg-red-900/30 border border-red-800 rounded-lg text-red-400 text-sm">
              {error}
            </div>
          )}

          {step === "request" ? (
            /* Step 1: 인증코드 요청 */
            <div className="space-y-4">
              <div className="text-center py-4">
                <div className="w-16 h-16 bg-blue-500/10 rounded-full flex items-center justify-center mx-auto mb-4">
                  <Send className="w-8 h-8 text-blue-400" />
                </div>
                <p className="text-gray-300 text-sm">
                  버튼을 누르면 텔레그램으로
                  <br />
                  6자리 인증코드가 발송됩니다.
                </p>
              </div>

              <button
                type="button"
                onClick={handleRequestCode}
                disabled={isLoading}
                className="w-full px-4 py-3 rounded-xl bg-indigo-600 text-white font-medium hover:bg-indigo-700 transition-colors disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2"
              >
                {isLoading ? (
                  <>
                    <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" />
                    발송 중...
                  </>
                ) : (
                  <>
                    <Send className="w-4 h-4" />
                    인증코드 요청
                  </>
                )}
              </button>
            </div>
          ) : (
            /* Step 2: 인증코드 입력 */
            <form onSubmit={handleVerifyCode} className="space-y-4">
              <div>
                <div className="flex items-center justify-between mb-2">
                  <label
                    htmlFor="code"
                    className="block text-sm font-medium text-gray-300"
                  >
                    인증코드
                  </label>
                  <button
                    type="button"
                    onClick={handleBack}
                    className="text-xs text-gray-400 hover:text-gray-300 flex items-center gap-1"
                  >
                    <ArrowLeft className="w-3 h-3" />
                    뒤로
                  </button>
                </div>
                <input
                  ref={codeInputRef}
                  id="code"
                  type="text"
                  inputMode="numeric"
                  maxLength={6}
                  value={code}
                  onChange={(e) => {
                    const val = e.target.value.replace(/\D/g, "");
                    setCode(val);
                    setError(null);
                  }}
                  placeholder="6자리 숫자 입력"
                  autoComplete="one-time-code"
                  className="w-full px-4 py-3 rounded-xl border border-gray-600 bg-gray-700 text-white text-center text-2xl tracking-[0.5em] placeholder:text-base placeholder:tracking-normal placeholder-gray-400 focus:ring-2 focus:ring-indigo-500 focus:border-transparent"
                />
              </div>

              <button
                type="submit"
                disabled={isLoading || code.length < 6}
                className="w-full px-4 py-3 rounded-xl bg-indigo-600 text-white font-medium hover:bg-indigo-700 transition-colors disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2"
              >
                {isLoading ? (
                  <>
                    <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" />
                    확인 중...
                  </>
                ) : (
                  <>
                    <LogIn className="w-4 h-4" />
                    로그인
                  </>
                )}
              </button>

              {/* 재발송 */}
              <div className="text-center">
                <button
                  type="button"
                  onClick={handleRequestCode}
                  disabled={cooldown > 0 || isLoading}
                  className="text-sm text-gray-400 hover:text-indigo-400 disabled:hover:text-gray-400 disabled:opacity-50 transition-colors"
                >
                  {cooldown > 0 ? `재발송 (${cooldown}초)` : "인증코드 재발송"}
                </button>
              </div>
            </form>
          )}
        </div>
      </div>
    </div>
  );
}
