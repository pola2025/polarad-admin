"use client";

import { useState, useEffect, useCallback } from "react";
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
  Badge,
  Button,
  Input,
} from "@polarad/ui";
import {
  MessageSquare,
  Search,
  ChevronLeft,
  ChevronRight,
  Clock,
  CheckCircle,
  AlertCircle,
  ChevronRight as ArrowRight,
  Loader2,
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
  OPEN: { label: "대기중", variant: "warning" as const, icon: AlertCircle },
  IN_PROGRESS: { label: "진행중", variant: "info" as const, icon: Clock },
  RESOLVED: { label: "완료", variant: "success" as const, icon: CheckCircle },
};

const CATEGORIES = ["전체", "홈페이지", "로고", "인쇄물", "광고", "일반"];

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
    const days = Math.floor(diff / (1000 * 60 * 60 * 24));

    if (days === 0) {
      return date.toLocaleTimeString("ko-KR", { hour: "2-digit", minute: "2-digit" });
    } else if (days === 1) {
      return "어제";
    } else if (days < 7) {
      return `${days}일 전`;
    } else {
      return date.toLocaleDateString("ko-KR", { month: "short", day: "numeric" });
    }
  };

  const getStatusBadge = (status: Thread["status"]) => {
    const config = statusConfig[status];
    const Icon = config.icon;
    return (
      <Badge variant={config.variant} className="flex items-center gap-1">
        <Icon className="h-3 w-3" />
        {config.label}
      </Badge>
    );
  };

  return (
    <div className="space-y-4 lg:space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-xl lg:text-2xl font-bold text-gray-900 dark:text-white">
            문의 관리
          </h1>
          {unreadCount > 0 && (
            <p className="text-sm text-blue-600 mt-1">
              {unreadCount}개의 읽지 않은 메시지가 있습니다
            </p>
          )}
        </div>
      </div>

      {/* 통계 카드 */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 lg:gap-4">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-1 lg:pb-2 px-3 lg:px-6 pt-3 lg:pt-6">
            <CardTitle className="text-xs lg:text-sm font-medium">전체</CardTitle>
            <MessageSquare className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent className="px-3 lg:px-6 pb-3 lg:pb-6">
            <div className="text-xl lg:text-2xl font-bold">{stats?.total || 0}</div>
          </CardContent>
        </Card>

        <Card className="bg-yellow-50 dark:bg-yellow-900/20">
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-1 lg:pb-2 px-3 lg:px-6 pt-3 lg:pt-6">
            <CardTitle className="text-xs lg:text-sm font-medium">대기중</CardTitle>
            <AlertCircle className="h-4 w-4 text-yellow-500" />
          </CardHeader>
          <CardContent className="px-3 lg:px-6 pb-3 lg:pb-6">
            <div className="text-xl lg:text-2xl font-bold text-yellow-600">{stats?.open || 0}</div>
          </CardContent>
        </Card>

        <Card className="bg-blue-50 dark:bg-blue-900/20">
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-1 lg:pb-2 px-3 lg:px-6 pt-3 lg:pt-6">
            <CardTitle className="text-xs lg:text-sm font-medium">진행중</CardTitle>
            <Clock className="h-4 w-4 text-blue-500" />
          </CardHeader>
          <CardContent className="px-3 lg:px-6 pb-3 lg:pb-6">
            <div className="text-xl lg:text-2xl font-bold text-blue-600">{stats?.inProgress || 0}</div>
          </CardContent>
        </Card>

        <Card className="bg-green-50 dark:bg-green-900/20">
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-1 lg:pb-2 px-3 lg:px-6 pt-3 lg:pt-6">
            <CardTitle className="text-xs lg:text-sm font-medium">완료</CardTitle>
            <CheckCircle className="h-4 w-4 text-green-500" />
          </CardHeader>
          <CardContent className="px-3 lg:px-6 pb-3 lg:pb-6">
            <div className="text-xl lg:text-2xl font-bold text-green-600">{stats?.resolved || 0}</div>
          </CardContent>
        </Card>
      </div>

      {/* 검색 및 필터 */}
      <Card>
        <CardContent className="p-3 lg:pt-6 lg:px-6 lg:pb-6">
          <div className="flex flex-col gap-3">
            <form onSubmit={handleSearch} className="flex gap-2">
              <div className="relative flex-1">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                <Input
                  placeholder="제목, 업체명, 담당자 검색..."
                  value={search}
                  onChange={(e) => setSearch(e.target.value)}
                  className="pl-10 text-sm"
                />
              </div>
              <Button type="submit" size="sm" className="px-3 lg:px-4">
                검색
              </Button>
            </form>

            <div className="flex flex-wrap gap-2">
              {[
                { key: "all", label: "전체" },
                { key: "OPEN", label: "대기중" },
                { key: "IN_PROGRESS", label: "진행중" },
                { key: "RESOLVED", label: "완료" },
              ].map((item) => (
                <Button
                  key={item.key}
                  variant={statusFilter === item.key ? "default" : "outline"}
                  onClick={() => {
                    setStatusFilter(item.key);
                    setCurrentPage(1);
                  }}
                  size="sm"
                >
                  {item.label}
                </Button>
              ))}

              <div className="border-l border-gray-300 dark:border-gray-600 mx-2" />

              {CATEGORIES.map((cat) => (
                <Button
                  key={cat}
                  variant={categoryFilter === cat ? "default" : "outline"}
                  onClick={() => {
                    setCategoryFilter(cat);
                    setCurrentPage(1);
                  }}
                  size="sm"
                >
                  {cat}
                </Button>
              ))}
            </div>
          </div>
        </CardContent>
      </Card>

      {/* 목록 */}
      <Card>
        <CardContent className="p-3 lg:pt-6 lg:px-6 lg:pb-6">
          {loading ? (
            <div className="flex items-center justify-center py-12">
              <Loader2 className="h-8 w-8 animate-spin text-blue-600" />
            </div>
          ) : threads.length === 0 ? (
            <div className="text-center py-12 text-muted-foreground">
              문의가 없습니다.
            </div>
          ) : (
            <>
              {/* 목록 */}
              <div className="divide-y divide-gray-200 dark:divide-gray-700">
                {threads.map((thread) => (
                  <Link
                    key={thread.id}
                    href={`/communications/${thread.id}`}
                    className="flex items-center p-3 lg:p-4 hover:bg-gray-50 dark:hover:bg-gray-800/50 transition-colors -mx-3 lg:-mx-6 first:-mt-3 last:-mb-3 lg:first:-mt-6 lg:last:-mb-6"
                  >
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 mb-1">
                        {getStatusBadge(thread.status)}
                        <span className="text-xs text-muted-foreground">
                          {thread.category}
                        </span>
                        {thread.hasUnreadUserMessage && (
                          <span className="w-2 h-2 bg-blue-600 rounded-full" />
                        )}
                      </div>
                      <h3 className="font-medium text-gray-900 dark:text-white truncate">
                        {thread.title}
                      </h3>
                      <div className="flex items-center gap-2 mt-1 text-sm text-muted-foreground">
                        <span>{thread.user.clientName}</span>
                        <span>·</span>
                        <span>{thread.user.name}</span>
                      </div>
                      {thread.lastMessage && (
                        <p className="text-sm text-muted-foreground truncate mt-1">
                          {thread.lastMessage.authorType === "admin" ? "나: " : ""}
                          {thread.lastMessage.content}
                        </p>
                      )}
                    </div>
                    <div className="flex items-center gap-3 ml-4">
                      <span className="text-xs text-muted-foreground whitespace-nowrap">
                        {formatDate(thread.lastReplyAt)}
                      </span>
                      <ArrowRight className="w-5 h-5 text-gray-400" />
                    </div>
                  </Link>
                ))}
              </div>
            </>
          )}

          {/* 페이지네이션 */}
          {pagination && pagination.totalPages > 1 && (
            <div className="flex flex-col sm:flex-row items-center justify-between gap-3 mt-4 lg:mt-6 pt-4 border-t">
              <p className="text-xs lg:text-sm text-muted-foreground order-2 sm:order-1">
                총 {pagination.total}건 중 {(pagination.page - 1) * pagination.limit + 1}-
                {Math.min(pagination.page * pagination.limit, pagination.total)}건
              </p>
              <div className="flex items-center gap-2 order-1 sm:order-2">
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => setCurrentPage((p) => Math.max(1, p - 1))}
                  disabled={currentPage === 1}
                  className="h-8 w-8 p-0"
                >
                  <ChevronLeft className="h-4 w-4" />
                </Button>
                <span className="text-sm min-w-[60px] text-center">
                  {pagination.page} / {pagination.totalPages}
                </span>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => setCurrentPage((p) => Math.min(pagination.totalPages, p + 1))}
                  disabled={currentPage === pagination.totalPages}
                  className="h-8 w-8 p-0"
                >
                  <ChevronRight className="h-4 w-4" />
                </Button>
              </div>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
