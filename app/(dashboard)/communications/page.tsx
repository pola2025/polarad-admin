"use client";

import { useState, useEffect, useCallback } from "react";
import { Card, CardContent, Badge, Button, Input } from "@polarad/ui";
import {
  MessageSquare,
  Search,
  ChevronLeft,
  ChevronRight,
  Clock,
  CheckCircle,
  AlertCircle,
  Loader2,
  Reply,
  MoreHorizontal,
  Paperclip,
  ExternalLink,
  LayoutGrid,
  List,
} from "lucide-react";
import Link from "next/link";

interface Thread {
  id: string;
  title: string;
  category: string;
  status: "OPEN" | "IN_PROGRESS" | "RESOLVED";
  lastReplyAt: string;
  createdAt: string;
  hasUnreadUserMessage: boolean;
  messageCount: number;
  user: {
    id: string;
    name: string;
    clientName: string;
    email: string;
    phone: string;
  };
  lastMessage: {
    content: string;
    authorType: string;
    createdAt: string;
  } | null;
}

interface Stats {
  total: number;
  open: number;
  inProgress: number;
  resolved: number;
}

interface Pagination {
  page: number;
  limit: number;
  total: number;
  totalPages: number;
}

const statusConfig = {
  OPEN: {
    label: "신규",
    variant: "warning" as const,
    icon: AlertCircle,
    dotClass: "bg-yellow-500",
  },
  IN_PROGRESS: {
    label: "진행중",
    variant: "info" as const,
    icon: Clock,
    dotClass: "bg-blue-500",
  },
  RESOLVED: {
    label: "완료",
    variant: "success" as const,
    icon: CheckCircle,
    dotClass: "bg-green-500",
  },
};

const CATEGORIES = ["전체", "홈페이지", "로고", "인쇄물", "광고", "일반"];

const AVATAR_COLORS = [
  "bg-indigo-500",
  "bg-cyan-600",
  "bg-fuchsia-500",
  "bg-emerald-600",
  "bg-red-500",
  "bg-orange-600",
  "bg-violet-500",
  "bg-teal-500",
];

function getAvatarColor(name: string) {
  let hash = 0;
  for (let i = 0; i < name.length; i++) {
    hash = name.charCodeAt(i) + ((hash << 5) - hash);
  }
  return AVATAR_COLORS[Math.abs(hash) % AVATAR_COLORS.length];
}

function getInitial(name: string) {
  return name.charAt(0);
}

export default function CommunicationsPage() {
  const [threads, setThreads] = useState<Thread[]>([]);
  const [stats, setStats] = useState<Stats | null>(null);
  const [pagination, setPagination] = useState<Pagination | null>(null);
  const [unreadCount, setUnreadCount] = useState(0);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState<string>("all");
  const [categoryFilter, setCategoryFilter] = useState<string>("전체");
  const [currentPage, setCurrentPage] = useState(1);

  const fetchThreads = useCallback(async () => {
    setLoading(true);
    try {
      const params = new URLSearchParams({
        page: currentPage.toString(),
        limit: "20",
        ...(search && { search }),
        ...(statusFilter !== "all" && { status: statusFilter }),
        ...(categoryFilter !== "전체" && { category: categoryFilter }),
      });

      const res = await fetch(`/api/admin/communications?${params}`);
      const data = await res.json();

      if (data.success) {
        setThreads(data.data);
        setStats(data.stats);
        setPagination(data.pagination);
        setUnreadCount(data.unreadCount);
      }
    } catch (error) {
      console.error("Fetch threads error:", error);
    } finally {
      setLoading(false);
    }
  }, [currentPage, search, statusFilter, categoryFilter]);

  useEffect(() => {
    fetchThreads();
  }, [fetchThreads]);

  const handleSearch = (e: React.FormEvent) => {
    e.preventDefault();
    setCurrentPage(1);
    fetchThreads();
  };

  const formatDate = (dateString: string) => {
    const date = new Date(dateString);
    const now = new Date();
    const diff = now.getTime() - date.getTime();
    const minutes = Math.floor(diff / (1000 * 60));
    const hours = Math.floor(diff / (1000 * 60 * 60));
    const days = Math.floor(diff / (1000 * 60 * 60 * 24));

    if (minutes < 1) return "방금 전";
    if (minutes < 60) return `${minutes}분 전`;
    if (hours < 24) return `${hours}시간 전`;
    if (days === 1) return "어제";
    if (days < 7) return `${days}일 전`;
    return date.toLocaleDateString("ko-KR", { month: "short", day: "numeric" });
  };

  const getPriorityStripe = (status: Thread["status"]) => {
    switch (status) {
      case "OPEN":
        return "bg-red-500";
      case "IN_PROGRESS":
        return "bg-yellow-400";
      case "RESOLVED":
        return "bg-transparent";
    }
  };

  return (
    <div className="space-y-4 lg:space-y-5">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-xl lg:text-2xl font-bold text-gray-900 dark:text-white">
            문의 관리
            <span className="text-base font-normal text-gray-400 ml-2">
              총 {stats?.total || 0}건
            </span>
          </h1>
          {unreadCount > 0 && (
            <p className="text-sm text-blue-600 mt-0.5">
              {unreadCount}개의 읽지 않은 메시지
            </p>
          )}
        </div>
      </div>

      {/* Stats Cards - clickable filter */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-2 lg:gap-3">
        {[
          {
            key: "all",
            label: "전체",
            value: stats?.total,
            icon: "📋",
            bg: "",
            valueCls: "",
          },
          {
            key: "OPEN",
            label: "신규 대기",
            value: stats?.open,
            icon: "🔔",
            bg: "bg-yellow-50 dark:bg-yellow-900/20",
            valueCls: "text-yellow-600",
          },
          {
            key: "IN_PROGRESS",
            label: "진행중",
            value: stats?.inProgress,
            icon: "💬",
            bg: "bg-blue-50 dark:bg-blue-900/20",
            valueCls: "text-blue-600",
          },
          {
            key: "RESOLVED",
            label: "완료",
            value: stats?.resolved,
            icon: "✅",
            bg: "bg-green-50 dark:bg-green-900/20",
            valueCls: "text-green-600",
          },
        ].map((s) => (
          <button
            key={s.key}
            onClick={() => {
              setStatusFilter(s.key);
              setCurrentPage(1);
            }}
            className={`flex items-center gap-3 p-3 lg:p-4 rounded-xl border text-left transition-all hover:shadow-md ${
              statusFilter === s.key
                ? "border-blue-500 ring-1 ring-blue-500 bg-blue-50 dark:bg-blue-900/20"
                : `border-gray-200 dark:border-gray-700 ${s.bg || "bg-white dark:bg-gray-900"}`
            }`}
          >
            <span className="text-lg lg:text-xl">{s.icon}</span>
            <div>
              <div className="text-[11px] lg:text-xs text-gray-500">
                {s.label}
              </div>
              <div
                className={`text-lg lg:text-xl font-bold ${statusFilter === s.key ? "text-blue-600" : s.valueCls}`}
              >
                {s.value ?? 0}
              </div>
            </div>
          </button>
        ))}
      </div>

      {/* Filter Bar */}
      <Card>
        <CardContent className="p-3 lg:p-4">
          <div className="flex flex-col lg:flex-row gap-3">
            <form onSubmit={handleSearch} className="flex gap-2 flex-1">
              <div className="relative flex-1">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-gray-400" />
                <Input
                  placeholder="업체명, 이름, 문의 내용 검색..."
                  value={search}
                  onChange={(e) => setSearch(e.target.value)}
                  className="pl-10 text-sm"
                />
              </div>
              <Button type="submit" size="sm" className="px-4 shrink-0">
                검색
              </Button>
            </form>
            <div className="flex gap-1.5 overflow-x-auto pb-0.5 lg:pb-0">
              {CATEGORIES.map((cat) => (
                <button
                  key={cat}
                  onClick={() => {
                    setCategoryFilter(cat);
                    setCurrentPage(1);
                  }}
                  className={`px-3 py-1.5 rounded-full text-xs font-medium border whitespace-nowrap transition-all ${
                    categoryFilter === cat
                      ? "bg-gray-900 text-white border-gray-900 dark:bg-white dark:text-gray-900 dark:border-white"
                      : "bg-white text-gray-600 border-gray-200 hover:bg-gray-50 dark:bg-gray-800 dark:text-gray-300 dark:border-gray-600 dark:hover:bg-gray-700"
                  }`}
                >
                  {cat}
                </button>
              ))}
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Card Grid */}
      {loading ? (
        <div className="flex items-center justify-center py-16">
          <Loader2 className="h-8 w-8 animate-spin text-blue-600" />
        </div>
      ) : threads.length === 0 ? (
        <div className="text-center py-16 text-gray-400">
          <MessageSquare className="h-12 w-12 mx-auto mb-3 opacity-30" />
          <p>문의가 없습니다.</p>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-3 lg:gap-4">
          {threads.map((thread) => {
            const config = statusConfig[thread.status];
            return (
              <Link
                key={thread.id}
                href={`/communications/${thread.id}`}
                className="group block"
              >
                <div
                  className={`bg-white dark:bg-gray-900 border rounded-xl overflow-hidden transition-all hover:shadow-md hover:border-gray-300 dark:hover:border-gray-600 ${
                    thread.hasUnreadUserMessage
                      ? "border-l-[3px] border-l-blue-500 border-gray-200 dark:border-gray-700"
                      : "border-gray-200 dark:border-gray-700"
                  }`}
                >
                  {/* Priority Stripe */}
                  <div
                    className={`h-[3px] ${getPriorityStripe(thread.status)}`}
                  />

                  {/* Top: Avatar + Client + Badges */}
                  <div className="p-3 lg:p-4 pb-0">
                    <div className="flex items-start justify-between gap-2">
                      <div className="flex items-center gap-2.5 min-w-0">
                        <div
                          className={`w-9 h-9 rounded-full flex items-center justify-center text-white text-sm font-semibold shrink-0 ${getAvatarColor(thread.user.name)}`}
                        >
                          {getInitial(thread.user.name)}
                        </div>
                        <div className="min-w-0">
                          <div className="flex items-center gap-1.5 text-sm font-semibold text-gray-900 dark:text-white">
                            {thread.hasUnreadUserMessage && (
                              <span className="w-1.5 h-1.5 bg-blue-500 rounded-full shrink-0" />
                            )}
                            <span className="truncate">{thread.user.name}</span>
                          </div>
                          <div className="text-xs text-gray-500 truncate">
                            {thread.user.clientName}
                          </div>
                        </div>
                      </div>
                      <div className="flex gap-1.5 shrink-0">
                        <span className="inline-flex items-center px-2 py-0.5 rounded-md text-[10px] font-semibold bg-purple-100 text-purple-700 dark:bg-purple-900/30 dark:text-purple-300">
                          {thread.category}
                        </span>
                        <Badge
                          variant={config.variant}
                          className="flex items-center gap-1 text-[10px] px-2 py-0.5"
                        >
                          <span
                            className={`w-1.5 h-1.5 rounded-full ${config.dotClass}`}
                          />
                          {config.label}
                        </Badge>
                      </div>
                    </div>
                  </div>

                  {/* Body: Title + Preview */}
                  <div className="px-3 lg:px-4 py-2.5">
                    <h3 className="text-sm font-semibold text-gray-900 dark:text-white truncate">
                      {thread.title}
                    </h3>
                    {thread.lastMessage && (
                      <p className="text-xs text-gray-500 mt-1 line-clamp-2 leading-relaxed">
                        {thread.lastMessage.authorType === "admin" && (
                          <span className="text-blue-500 font-medium">
                            나:{" "}
                          </span>
                        )}
                        {thread.lastMessage.content}
                      </p>
                    )}
                  </div>

                  {/* Footer: Meta + Actions */}
                  <div className="px-3 lg:px-4 py-2.5 border-t border-gray-100 dark:border-gray-800 bg-gray-50/50 dark:bg-gray-800/30 flex items-center justify-between">
                    <div className="flex items-center gap-3 text-[11px] text-gray-400">
                      <span className="flex items-center gap-1">
                        <Clock className="w-3.5 h-3.5" />
                        {formatDate(thread.lastReplyAt)}
                      </span>
                      <span className="flex items-center gap-1">
                        <MessageSquare className="w-3.5 h-3.5" />
                        {thread.messageCount}
                      </span>
                    </div>
                    <div className="flex gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                      <span className="w-7 h-7 rounded-md border border-gray-200 dark:border-gray-600 bg-white dark:bg-gray-800 flex items-center justify-center text-gray-400 hover:text-gray-600">
                        <Reply className="w-3.5 h-3.5" />
                      </span>
                      <span className="w-7 h-7 rounded-md border border-gray-200 dark:border-gray-600 bg-white dark:bg-gray-800 flex items-center justify-center text-gray-400 hover:text-gray-600">
                        <ExternalLink className="w-3.5 h-3.5" />
                      </span>
                    </div>
                  </div>
                </div>
              </Link>
            );
          })}
        </div>
      )}

      {/* Pagination */}
      {pagination && pagination.totalPages > 1 && (
        <div className="flex items-center justify-center gap-1.5 pt-2">
          <Button
            variant="outline"
            size="sm"
            onClick={() => setCurrentPage((p) => Math.max(1, p - 1))}
            disabled={currentPage === 1}
            className="h-9 w-9 p-0 rounded-lg"
          >
            <ChevronLeft className="h-4 w-4" />
          </Button>
          {Array.from(
            { length: Math.min(pagination.totalPages, 5) },
            (_, i) => {
              let pageNum: number;
              if (pagination.totalPages <= 5) {
                pageNum = i + 1;
              } else if (currentPage <= 3) {
                pageNum = i + 1;
              } else if (currentPage >= pagination.totalPages - 2) {
                pageNum = pagination.totalPages - 4 + i;
              } else {
                pageNum = currentPage - 2 + i;
              }
              return (
                <Button
                  key={pageNum}
                  variant={currentPage === pageNum ? "default" : "outline"}
                  size="sm"
                  onClick={() => setCurrentPage(pageNum)}
                  className="h-9 w-9 p-0 rounded-lg"
                >
                  {pageNum}
                </Button>
              );
            },
          )}
          <Button
            variant="outline"
            size="sm"
            onClick={() =>
              setCurrentPage((p) => Math.min(pagination.totalPages, p + 1))
            }
            disabled={currentPage === pagination.totalPages}
            className="h-9 w-9 p-0 rounded-lg"
          >
            <ChevronRight className="h-4 w-4" />
          </Button>
        </div>
      )}
    </div>
  );
}
