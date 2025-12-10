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
  formatDate,
} from "@polarad/ui";
import {
  Palette,
  Search,
  ChevronLeft,
  ChevronRight,
  Clock,
  AlertCircle,
  Eye,
  CheckCircle,
  Loader2,
  MessageSquare,
  RefreshCw,
} from "lucide-react";
import Link from "next/link";

interface Design {
  id: string;
  workflowId: string;
  status: "DRAFT" | "PENDING_REVIEW" | "REVISION_REQUESTED" | "APPROVED";
  currentVersion: number;
  approvedAt: string | null;
  approvedVersion: number | null;
  createdAt: string;
  updatedAt: string;
  workflow: {
    id: string;
    type: string;
    status: string;
    user: {
      id: string;
      name: string;
      clientName: string;
      email: string;
      phone: string;
      telegramChatId: string | null;
      telegramEnabled: boolean;
    };
  };
  versions: {
    id: string;
    version: number;
    url: string;
    note: string | null;
    createdAt: string;
    feedbacks: {
      id: string;
      content: string;
      authorType: string;
      authorName: string;
      createdAt: string;
    }[];
  }[];
}

interface Stats {
  total: number;
  draft: number;
  pendingReview: number;
  revisionRequested: number;
  approved: number;
}

interface Pagination {
  page: number;
  limit: number;
  total: number;
  totalPages: number;
}

const WORKFLOW_TYPE_KOREAN: Record<string, string> = {
  NAMECARD: "명함",
  NAMETAG: "명찰",
  CONTRACT: "계약서",
  ENVELOPE: "대봉투",
  WEBSITE: "홈페이지",
  BLOG: "블로그",
  META_ADS: "메타광고",
  NAVER_ADS: "네이버광고",
};

export default function DesignsPage() {
  const [designs, setDesigns] = useState<Design[]>([]);
  const [stats, setStats] = useState<Stats | null>(null);
  const [pagination, setPagination] = useState<Pagination | null>(null);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState<string>("all");
  const [typeFilter, setTypeFilter] = useState<string>("all");
  const [currentPage, setCurrentPage] = useState(1);

  const fetchDesigns = useCallback(async () => {
    setLoading(true);
    try {
      const params = new URLSearchParams({
        page: currentPage.toString(),
        limit: "20",
        ...(search && { search }),
        ...(statusFilter !== "all" && { status: statusFilter }),
        ...(typeFilter !== "all" && { type: typeFilter }),
      });

      const res = await fetch(`/api/admin/designs?${params}`);
      const data = await res.json();

      if (data.success) {
        setDesigns(data.data);
        setStats(data.stats);
        setPagination(data.pagination);
      }
    } catch (error) {
      console.error("Fetch designs error:", error);
    } finally {
      setLoading(false);
    }
  }, [currentPage, search, statusFilter, typeFilter]);

  useEffect(() => {
    fetchDesigns();
  }, [fetchDesigns]);

  const handleSearch = (e: React.FormEvent) => {
    e.preventDefault();
    setCurrentPage(1);
    fetchDesigns();
  };

  const getStatusBadge = (status: Design["status"]) => {
    const config = {
      DRAFT: { variant: "secondary" as const, label: "임시저장", icon: Clock },
      PENDING_REVIEW: { variant: "warning" as const, label: "확인 대기", icon: Eye },
      REVISION_REQUESTED: { variant: "destructive" as const, label: "수정 요청", icon: RefreshCw },
      APPROVED: { variant: "success" as const, label: "확정", icon: CheckCircle },
    };

    const { variant, label, icon: Icon } = config[status];
    return (
      <Badge variant={variant} className="flex items-center gap-1">
        <Icon className="h-3 w-3" />
        {label}
      </Badge>
    );
  };

  return (
    <div className="space-y-4 lg:space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="text-xl lg:text-2xl font-bold text-gray-900 dark:text-white">
          시안 관리
        </h1>
      </div>

      {/* 통계 카드 */}
      <div className="grid grid-cols-2 lg:grid-cols-5 gap-3 lg:gap-4">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-1 lg:pb-2 px-3 lg:px-6 pt-3 lg:pt-6">
            <CardTitle className="text-xs lg:text-sm font-medium">전체</CardTitle>
            <Palette className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent className="px-3 lg:px-6 pb-3 lg:pb-6">
            <div className="text-xl lg:text-2xl font-bold">{stats?.total || 0}</div>
          </CardContent>
        </Card>

        <Card className="bg-yellow-50 dark:bg-yellow-900/20">
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-1 lg:pb-2 px-3 lg:px-6 pt-3 lg:pt-6">
            <CardTitle className="text-xs lg:text-sm font-medium">확인 대기</CardTitle>
            <Eye className="h-4 w-4 text-yellow-500" />
          </CardHeader>
          <CardContent className="px-3 lg:px-6 pb-3 lg:pb-6">
            <div className="text-xl lg:text-2xl font-bold text-yellow-600">{stats?.pendingReview || 0}</div>
          </CardContent>
        </Card>

        <Card className="bg-red-50 dark:bg-red-900/20">
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-1 lg:pb-2 px-3 lg:px-6 pt-3 lg:pt-6">
            <CardTitle className="text-xs lg:text-sm font-medium">수정 요청</CardTitle>
            <RefreshCw className="h-4 w-4 text-red-500" />
          </CardHeader>
          <CardContent className="px-3 lg:px-6 pb-3 lg:pb-6">
            <div className="text-xl lg:text-2xl font-bold text-red-600">{stats?.revisionRequested || 0}</div>
          </CardContent>
        </Card>

        <Card className="bg-green-50 dark:bg-green-900/20">
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-1 lg:pb-2 px-3 lg:px-6 pt-3 lg:pt-6">
            <CardTitle className="text-xs lg:text-sm font-medium">확정</CardTitle>
            <CheckCircle className="h-4 w-4 text-green-500" />
          </CardHeader>
          <CardContent className="px-3 lg:px-6 pb-3 lg:pb-6">
            <div className="text-xl lg:text-2xl font-bold text-green-600">{stats?.approved || 0}</div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-1 lg:pb-2 px-3 lg:px-6 pt-3 lg:pt-6">
            <CardTitle className="text-xs lg:text-sm font-medium">임시저장</CardTitle>
            <Clock className="h-4 w-4 text-gray-500" />
          </CardHeader>
          <CardContent className="px-3 lg:px-6 pb-3 lg:pb-6">
            <div className="text-xl lg:text-2xl font-bold text-gray-600">{stats?.draft || 0}</div>
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
                  placeholder="업체명, 담당자 검색..."
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
              {/* 상태 필터 */}
              <div className="flex gap-2 overflow-x-auto pb-1">
                {[
                  { key: "all", label: "전체" },
                  { key: "PENDING_REVIEW", label: "확인 대기" },
                  { key: "REVISION_REQUESTED", label: "수정 요청" },
                  { key: "APPROVED", label: "확정" },
                  { key: "DRAFT", label: "임시저장" },
                ].map((item) => (
                  <Button
                    key={item.key}
                    variant={statusFilter === item.key ? "default" : "outline"}
                    onClick={() => {
                      setStatusFilter(item.key);
                      setCurrentPage(1);
                    }}
                    size="sm"
                    className="flex-shrink-0"
                  >
                    {item.label}
                  </Button>
                ))}
              </div>

              {/* 타입 필터 */}
              <select
                value={typeFilter}
                onChange={(e) => {
                  setTypeFilter(e.target.value);
                  setCurrentPage(1);
                }}
                className="text-sm border rounded-md px-2 py-1"
              >
                <option value="all">모든 타입</option>
                {Object.entries(WORKFLOW_TYPE_KOREAN).map(([key, label]) => (
                  <option key={key} value={key}>{label}</option>
                ))}
              </select>
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
          ) : designs.length === 0 ? (
            <div className="text-center py-12 text-muted-foreground">
              시안이 없습니다.
            </div>
          ) : (
            <>
              {/* 모바일 카드 뷰 */}
              <div className="lg:hidden space-y-3">
                {designs.map((design) => {
                  const latestVersion = design.versions[0];
                  const latestFeedback = latestVersion?.feedbacks[0];

                  return (
                    <div
                      key={design.id}
                      className="p-3 bg-gray-50 dark:bg-gray-800 rounded-lg space-y-3"
                    >
                      <div className="flex items-start justify-between gap-2">
                        <div className="min-w-0 flex-1">
                          <p className="font-medium text-gray-900 dark:text-white truncate">
                            {design.workflow.user.clientName}
                          </p>
                          <p className="text-sm text-muted-foreground">
                            {WORKFLOW_TYPE_KOREAN[design.workflow.type] || design.workflow.type}
                          </p>
                        </div>
                        {getStatusBadge(design.status)}
                      </div>

                      <div className="text-xs text-muted-foreground">
                        <p>담당자: {design.workflow.user.name}</p>
                        <p>버전: v{design.currentVersion}</p>
                        <p>업데이트: {formatDate(design.updatedAt)}</p>
                      </div>

                      {latestFeedback && (
                        <div className="text-xs bg-blue-50 dark:bg-blue-900/20 p-2 rounded flex items-start gap-1">
                          <MessageSquare className="h-3 w-3 text-blue-500 flex-shrink-0 mt-0.5" />
                          <span className="truncate">
                            {latestFeedback.authorName}: {latestFeedback.content}
                          </span>
                        </div>
                      )}

                      <div className="flex items-center justify-end gap-2 pt-2 border-t border-gray-200 dark:border-gray-700">
                        <Link href={`/designs/${design.id}`}>
                          <Button variant="outline" size="sm">
                            <Eye className="h-4 w-4 mr-1" />
                            상세
                          </Button>
                        </Link>
                      </div>
                    </div>
                  );
                })}
              </div>

              {/* 데스크탑 테이블 뷰 */}
              <div className="hidden lg:block overflow-x-auto">
                <table className="w-full">
                  <thead>
                    <tr className="border-b">
                      <th className="text-left py-3 px-4 font-medium text-muted-foreground">
                        업체/타입
                      </th>
                      <th className="text-left py-3 px-4 font-medium text-muted-foreground">
                        담당자
                      </th>
                      <th className="text-left py-3 px-4 font-medium text-muted-foreground">
                        상태
                      </th>
                      <th className="text-left py-3 px-4 font-medium text-muted-foreground">
                        버전
                      </th>
                      <th className="text-left py-3 px-4 font-medium text-muted-foreground">
                        최근 피드백
                      </th>
                      <th className="text-left py-3 px-4 font-medium text-muted-foreground">
                        업데이트
                      </th>
                      <th className="text-right py-3 px-4 font-medium text-muted-foreground">
                        관리
                      </th>
                    </tr>
                  </thead>
                  <tbody>
                    {designs.map((design) => {
                      const latestVersion = design.versions[0];
                      const latestFeedback = latestVersion?.feedbacks[0];

                      return (
                        <tr
                          key={design.id}
                          className="border-b hover:bg-gray-50 dark:hover:bg-gray-800/50"
                        >
                          <td className="py-3 px-4">
                            <div>
                              <p className="font-medium text-gray-900 dark:text-white">
                                {design.workflow.user.clientName}
                              </p>
                              <p className="text-sm text-muted-foreground">
                                {WORKFLOW_TYPE_KOREAN[design.workflow.type] || design.workflow.type}
                              </p>
                            </div>
                          </td>
                          <td className="py-3 px-4">
                            <div>
                              <p className="text-sm">{design.workflow.user.name}</p>
                              <p className="text-xs text-muted-foreground">{design.workflow.user.phone}</p>
                            </div>
                          </td>
                          <td className="py-3 px-4">
                            {getStatusBadge(design.status)}
                          </td>
                          <td className="py-3 px-4">
                            <span className="font-medium">v{design.currentVersion}</span>
                            {design.approvedVersion && (
                              <span className="text-xs text-green-600 ml-1">
                                (확정: v{design.approvedVersion})
                              </span>
                            )}
                          </td>
                          <td className="py-3 px-4">
                            {latestFeedback ? (
                              <div className="max-w-[200px]">
                                <p className="text-xs text-muted-foreground">
                                  {latestFeedback.authorType === "user" ? "고객" : "관리자"}:
                                </p>
                                <p className="text-sm truncate" title={latestFeedback.content}>
                                  {latestFeedback.content}
                                </p>
                              </div>
                            ) : (
                              <span className="text-muted-foreground text-sm">-</span>
                            )}
                          </td>
                          <td className="py-3 px-4 text-sm text-muted-foreground">
                            {formatDate(design.updatedAt)}
                          </td>
                          <td className="py-3 px-4 text-right">
                            <Link href={`/designs/${design.id}`}>
                              <Button variant="ghost" size="sm" title="상세보기">
                                <Eye className="h-4 w-4" />
                              </Button>
                            </Link>
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
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
