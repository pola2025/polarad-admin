"use client";

import { useState, useEffect } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import {
  Users,
  Key,
  Bell,
  LayoutDashboard,
  Settings,
  UserCircle,
  Package,
  FileSignature,
  Megaphone,
  Menu,
  X,
  FileText,
  MessageSquare,
  Palette,
} from "lucide-react";

interface NavItem {
  href: string;
  label: string;
  icon: React.ComponentType<{ className?: string }>;
  badgeKey?: string;
}

const navItems: NavItem[] = [
  { href: "/", label: "대시보드", icon: LayoutDashboard },
  { href: "/users", label: "사용자 관리", icon: UserCircle },
  { href: "/submissions", label: "자료 제출 관리", icon: FileText },
  { href: "/designs", label: "시안 관리", icon: Palette },
  { href: "/communications", label: "문의 관리", icon: MessageSquare, badgeKey: "communications" },
  { href: "/contracts", label: "계약 관리", icon: FileSignature },
  { href: "/workflows", label: "워크플로우 관리", icon: Package },
  { href: "/clients", label: "클라이언트 관리", icon: Users },
  { href: "/meta-ads", label: "Meta 광고 관리", icon: Megaphone },
  { href: "/tokens", label: "토큰/인증 관리", icon: Key },
  { href: "/notifications", label: "알림 관리", icon: Bell },
];

export default function DashboardLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [badgeCounts, setBadgeCounts] = useState<Record<string, number>>({});
  const pathname = usePathname();

  // 문의 관리 배지 카운트 조회
  useEffect(() => {
    const fetchBadgeCounts = async () => {
      try {
        const res = await fetch("/api/admin/communications?limit=1");
        if (res.ok) {
          const data = await res.json();
          // OPEN 상태의 문의 개수 표시
          setBadgeCounts((prev) => ({
            ...prev,
            communications: data.stats?.open || 0,
          }));
        }
      } catch (error) {
        console.error("배지 카운트 조회 오류:", error);
      }
    };

    fetchBadgeCounts();
    // 30초마다 갱신
    const interval = setInterval(fetchBadgeCounts, 30000);
    return () => clearInterval(interval);
  }, []);

  const isActive = (href: string) => {
    if (href === "/") return pathname === "/";
    return pathname.startsWith(href);
  };

  return (
    <div className="min-h-screen bg-gray-50 dark:bg-gray-900">
      {/* 모바일 오버레이 */}
      {sidebarOpen && (
        <div
          className="fixed inset-0 bg-black/50 z-40 lg:hidden"
          onClick={() => setSidebarOpen(false)}
        />
      )}

      {/* 사이드바 */}
      <aside
        className={`
          fixed inset-y-0 left-0 w-64 bg-white dark:bg-gray-800 border-r border-gray-200 dark:border-gray-700 z-50
          transform transition-transform duration-300 ease-in-out
          ${sidebarOpen ? "translate-x-0" : "-translate-x-full"}
          lg:translate-x-0
        `}
      >
        {/* 로고 */}
        <div className="h-16 flex items-center justify-between px-6 border-b border-gray-200 dark:border-gray-700">
          <Link href="/" className="flex items-center gap-2" onClick={() => setSidebarOpen(false)}>
            <div className="w-8 h-8 bg-blue-600 rounded-lg flex items-center justify-center">
              <span className="text-white font-bold text-sm">P</span>
            </div>
            <span className="font-semibold text-gray-900 dark:text-white">
              Polarad Admin
            </span>
          </Link>
          {/* 모바일 닫기 버튼 */}
          <button
            onClick={() => setSidebarOpen(false)}
            className="lg:hidden p-2 rounded-lg hover:bg-gray-100 dark:hover:bg-gray-700"
            aria-label="메뉴 닫기"
          >
            <X className="w-5 h-5 text-gray-600 dark:text-gray-400" />
          </button>
        </div>

        {/* 네비게이션 */}
        <nav className="p-4 space-y-1 overflow-y-auto h-[calc(100vh-4rem)]">
          {navItems.map((item) => {
            const Icon = item.icon;
            const active = isActive(item.href);
            const badgeCount = item.badgeKey ? badgeCounts[item.badgeKey] : 0;
            return (
              <Link
                key={item.href}
                href={item.href}
                onClick={() => setSidebarOpen(false)}
                className={`
                  flex items-center gap-3 px-3 py-2.5 text-sm font-medium rounded-lg transition-colors
                  ${
                    active
                      ? "bg-blue-50 text-blue-700 dark:bg-blue-900/50 dark:text-blue-300"
                      : "text-gray-700 dark:text-gray-200 hover:bg-gray-100 dark:hover:bg-gray-700"
                  }
                `}
              >
                <Icon className="w-5 h-5 flex-shrink-0" />
                <span className="truncate flex-1">{item.label}</span>
                {badgeCount > 0 && (
                  <span className="ml-auto bg-red-500 text-white text-xs font-bold px-2 py-0.5 rounded-full min-w-[20px] text-center">
                    {badgeCount > 99 ? "99+" : badgeCount}
                  </span>
                )}
              </Link>
            );
          })}

          <div className="pt-4 mt-4 border-t border-gray-200 dark:border-gray-700">
            <Link
              href="/settings"
              onClick={() => setSidebarOpen(false)}
              className={`
                flex items-center gap-3 px-3 py-2.5 text-sm font-medium rounded-lg transition-colors
                ${
                  isActive("/settings")
                    ? "bg-blue-50 text-blue-700 dark:bg-blue-900/50 dark:text-blue-300"
                    : "text-gray-500 dark:text-gray-400 hover:bg-gray-100 dark:hover:bg-gray-700"
                }
              `}
            >
              <Settings className="w-5 h-5 flex-shrink-0" />
              <span className="truncate">설정</span>
            </Link>
          </div>
        </nav>
      </aside>

      {/* 메인 콘텐츠 */}
      <main className="lg:pl-64 min-h-screen flex flex-col">
        {/* 헤더 */}
        <header className="sticky top-0 z-30 h-16 bg-white dark:bg-gray-800 border-b border-gray-200 dark:border-gray-700 flex items-center justify-between px-4 lg:px-6">
          {/* 모바일 메뉴 버튼 */}
          <button
            onClick={() => setSidebarOpen(true)}
            className="lg:hidden p-2 -ml-2 rounded-lg hover:bg-gray-100 dark:hover:bg-gray-700"
            aria-label="메뉴 열기"
          >
            <Menu className="w-6 h-6 text-gray-600 dark:text-gray-400" />
          </button>

          <div className="text-sm text-gray-600 dark:text-gray-400 hidden sm:block">
            Polarad 마케팅 패키지 - 관리자 시스템
          </div>

          {/* 모바일 로고 */}
          <div className="lg:hidden flex items-center gap-2">
            <div className="w-7 h-7 bg-blue-600 rounded-lg flex items-center justify-center">
              <span className="text-white font-bold text-xs">P</span>
            </div>
            <span className="font-semibold text-gray-900 dark:text-white text-sm">
              Admin
            </span>
          </div>

          {/* 빈 공간 (우측 정렬용) */}
          <div className="w-10 lg:hidden" />
        </header>

        {/* 콘텐츠 영역 */}
        <div className="flex-1 p-4 lg:p-6 pb-[300px]">{children}</div>

        {/* 푸터 */}
        <footer className="bg-white dark:bg-gray-800 border-t border-gray-200 dark:border-gray-700 py-6 lg:py-8 px-4 lg:px-6">
          <div className="flex flex-col sm:flex-row items-center justify-between gap-2 text-sm text-gray-500 dark:text-gray-400">
            <div>© 2024 Polarad. All rights reserved.</div>
            <div className="flex items-center gap-4">
              <span>v2.0.0</span>
            </div>
          </div>
        </footer>
      </main>
    </div>
  );
}
