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
  FileText,
  Search,
  ChevronLeft,
  ChevronRight,
  CheckCircle,
  Clock,
  AlertCircle,
  Eye,
  CheckCheck,
  Loader2,
} from "lucide-react";
import Link from "next/link";

interface Submission {
  id: string;
  userId: string;
  brandName: string | null;
  contactEmail: string | null;
  contactPhone: string | null;
  deliveryAddress: string | null;
  status: "DRAFT" | "SUBMITTED" | "IN_REVIEW" | "APPROVED";
  isComplete: boolean;
  submittedAt: string | null;
  reviewedAt: string | null;
  rejectionReason: string | null;
  slackChannelId: string | null;
  createdAt: string;
  updatedAt: string;
  user: {
    id: string;
    name: string;
    clientName: string;
    email: string;
    phone: string;
    telegramChatId: string | null;
    telegramEnabled: boolean;
  };
}

interface Stats {
  total: number;
  draft: number;
  submitted: number;
  inReview: number;
  approved: number;
}

interface Pagination {
  page: number;
  limit: number;
  total: number;
  totalPages: number;
}

export default function SubmissionsPage() {
  const [submissions, setSubmissions] = useState<Submission[]>([]);
  const [stats, setStats] = useState<Stats | null>(null);
  const [pagination, setPagination] = useState<Pagination | null>(null);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState<string>("all");
  const [currentPage, setCurrentPage] = useState(1);
  const [actionLoading, setActionLoading] = useState<string | null>(null);

  const fetchSubmissions = useCallback(async () => {
    setLoading(true);
    try {
      const params = new URLSearchParams({
        page: currentPage.toString(),
        limit: "20",
        ...(search && { search }),
        ...(statusFilter !== "all" && { status: statusFilter }),
      });

      const res = await fetch(`/api/admin/submissions?${params}`);
      const data = await res.json();

      if (data.success) {
        setSubmissions(data.data);
        setStats(data.stats);
        setPagination(data.pagination);
      }
    } catch (error) {
      console.error("Fetch submissions error:", error);
    } finally {
      setLoading(false);
    }
  }, [currentPage, search, statusFilter]);

  useEffect(() => {
    fetchSubmissions();
  }, [fetchSubmissions]);

  const handleSearch = (e: React.FormEvent) => {
    e.preventDefault();
    setCurrentPage(1);
    fetchSubmissions();
  };

  const getStatusBadge = (status: Submission["status"]) => {
    const config = {
      DRAFT: { variant: "secondary" as const, label: "작성중", icon: Clock },
      SUBMITTED: { variant: "warning" as const, label: "제출됨", icon: AlertCircle },
      IN_REVIEW: { variant: "info" as const, label: "검토중", icon: Eye },
      APPROVED: { variant: "success" as const, label: "승인", icon: CheckCircle },
    };

    const { variant, label, icon: Icon } = config[status];
    return (
      <Badge variant={variant} className="flex items-center gap-1">
        <Icon className="h-3 w-3" />
        {label}
      </Badge>
    );
  };

  const handleApprove = async (id: string) => {
    if (!confirm("이 자료를 승인하시겠습니까?\n워크플로우가 자동 생성됩니다.")) return;

    setActionLoading(id);
    try {
      const res = await fetch(`/api/admin/submissions/${id}/approve`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({}),
      });

      const data = await res.json();
      if (data.success) {
        alert(`승인 완료! ${data.data.workflows.length}개의 워크플로우가 생성되었습니다.`);
        fetchSubmissions();
      } else {
        alert(data.error || "승인에 실패했습니다.");
      }
    } catch (error) {
      console.error("Approve error:", error);
      alert("승인 처리 중 오류가 발생했습니다.");
    } finally {
      setActionLoading(null);
    }
  };

  const handleStartReview = async (id: string) => {
    setActionLoading(id);
    try {
      const res = await fetch(`/api/admin/submissions/${id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ status: "IN_REVIEW" }),
      });

      const data = await res.json();
      if (data.success) {
        fetchSubmissions();
      } else {
        alert(data.error || "상태 변경에 실패했습니다.");
      }
    } catch (error) {
      console.error("Start review error:", error);
      alert("상태 변경 중 오류가 발생했습니다.");
    } finally {
      setActionLoading(null);
    }
  };

  return (
    <div className="space-y-4 lg:space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="text-xl lg:text-2xl font-bold text-gray-900 dark:text-white">
          자료 제출 관리
        </h1>
      </div>

      {/* 통계 카드 */}
      <div className="grid grid-cols-2 lg:grid-cols-5 gap-3 lg:gap-4">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-1 lg:pb-2 px-3 lg:px-6 pt-3 lg:pt-6">
            <CardTitle className="text-xs lg:text-sm font-medium">전체</CardTitle>
            <FileText className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent className="px-3 lg:px-6 pb-3 lg:pb-6">
            <div className="text-xl lg:text-2xl font-bold">{stats?.total || 0}</div>
          </CardContent>
        </Card>

        <Card className="bg-yellow-50 dark:bg-yellow-900/20">
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-1 lg:pb-2 px-3 lg:px-6 pt-3 lg:pt-6">
            <CardTitle className="text-xs lg:text-sm font-medium">제출됨</CardTitle>
            <AlertCircle className="h-4 w-4 text-yellow-500" />
          </CardHeader>
          <CardContent className="px-3 lg:px-6 pb-3 lg:pb-6">
            <div className="text-xl lg:text-2xl font-bold text-yellow-600">{stats?.submitted || 0}</div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-1 lg:pb-2 px-3 lg:px-6 pt-3 lg:pt-6">
            <CardTitle className="text-xs lg:text-sm font-medium">검토중</CardTitle>
            <Eye className="h-4 w-4 text-blue-500" />
          </CardHeader>
          <CardContent className="px-3 lg:px-6 pb-3 lg:pb-6">
            <div className="text-xl lg:text-2xl font-bold text-blue-600">{stats?.inReview || 0}</div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-1 lg:pb-2 px-3 lg:px-6 pt-3 lg:pt-6">
            <CardTitle className="text-xs lg:text-sm font-medium">승인</CardTitle>
            <CheckCircle className="h-4 w-4 text-green-500" />
          </CardHeader>
          <CardContent className="px-3 lg:px-6 pb-3 lg:pb-6">
            <div className="text-xl lg:text-2xl font-bold text-green-600">{stats?.approved || 0}</div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-1 lg:pb-2 px-3 lg:px-6 pt-3 lg:pt-6">
            <CardTitle className="text-xs lg:text-sm font-medium">작성중</CardTitle>
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
                  placeholder="브랜드명, 업체명, 담당자 검색..."
                  value={search}
                  onChange={(e) => setSearch(e.target.value)}
                  className="pl-10 text-sm"
                />
              </div>
              <Button type="submit" size="sm" className="px-3 lg:px-4">
                검색
              </Button>
            </form>

            <div className="flex gap-2 overflow-x-auto pb-1">
              {[
                { key: "all", label: "전체" },
                { key: "SUBMITTED", label: "제출됨" },
                { key: "IN_REVIEW", label: "검토중" },
                { key: "APPROVED", label: "승인" },
                { key: "DRAFT", label: "작성중" },
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
          ) : submissions.length === 0 ? (
            <div className="text-center py-12 text-muted-foreground">
              자료 제출이 없습니다.
            </div>
          ) : (
            <>
              {/* 모바일 카드 뷰 */}
              <div className="lg:hidden space-y-3">
                {submissions.map((sub) => (
                  <div
                    key={sub.id}
                    className="p-3 bg-gray-50 dark:bg-gray-800 rounded-lg space-y-3"
                  >
                    <div className="flex items-start justify-between gap-2">
                      <div className="min-w-0 flex-1">
                        <p className="font-medium text-gray-900 dark:text-white truncate">
                          {sub.user.clientName}
                        </p>
                        <p className="text-sm text-muted-foreground">
                          {sub.brandName || "-"}
                        </p>
                      </div>
                      {getStatusBadge(sub.status)}
                    </div>

                    <div className="text-xs text-muted-foreground">
                      <p>담당자: {sub.user.name}</p>
                      <p>제출일: {sub.submittedAt ? formatDate(sub.submittedAt) : "-"}</p>
                    </div>

                    {sub.rejectionReason && (
                      <div className="text-xs text-red-500 bg-red-50 p-2 rounded">
                        반려 사유: {sub.rejectionReason}
                      </div>
                    )}

                    <div className="flex items-center justify-end gap-2 pt-2 border-t border-gray-200 dark:border-gray-700">
                      <Link href={`/submissions/${sub.id}`}>
                        <Button variant="outline" size="sm">
                          <Eye className="h-4 w-4 mr-1" />
                          상세
                        </Button>
                      </Link>
                      {sub.status === "SUBMITTED" && (
                        <Button
                          size="sm"
                          variant="outline"
                          onClick={() => handleStartReview(sub.id)}
                          disabled={actionLoading === sub.id}
                        >
                          검토 시작
                        </Button>
                      )}
                      {(sub.status === "SUBMITTED" || sub.status === "IN_REVIEW") && (
                          <Button
                            size="sm"
                            variant="default"
                            onClick={() => handleApprove(sub.id)}
                            disabled={actionLoading === sub.id}
                          >
                            {actionLoading === sub.id ? (
                              <Loader2 className="h-4 w-4 animate-spin" />
                            ) : (
                              <CheckCheck className="h-4 w-4" />
                            )}
                          </Button>
                      )}
                    </div>
                  </div>
                ))}
              </div>

              {/* 데스크탑 테이블 뷰 */}
              <div className="hidden lg:block overflow-x-auto">
                <table className="w-full">
                  <thead>
                    <tr className="border-b">
                      <th className="text-left py-3 px-4 font-medium text-muted-foreground">
                        업체/브랜드
                      </th>
                      <th className="text-left py-3 px-4 font-medium text-muted-foreground">
                        담당자
                      </th>
                      <th className="text-left py-3 px-4 font-medium text-muted-foreground">
                        상태
                      </th>
                      <th className="text-left py-3 px-4 font-medium text-muted-foreground">
                        제출일
                      </th>
                      <th className="text-left py-3 px-4 font-medium text-muted-foreground">
                        검토일
                      </th>
                      <th className="text-right py-3 px-4 font-medium text-muted-foreground">
                        관리
                      </th>
                    </tr>
                  </thead>
                  <tbody>
                    {submissions.map((sub) => (
                      <tr
                        key={sub.id}
                        className="border-b hover:bg-gray-50 dark:hover:bg-gray-800/50"
                      >
                        <td className="py-3 px-4">
                          <div>
                            <p className="font-medium text-gray-900 dark:text-white">
                              {sub.user.clientName}
                            </p>
                            <p className="text-sm text-muted-foreground">
                              {sub.brandName || "-"}
                            </p>
                          </div>
                        </td>
                        <td className="py-3 px-4">
                          <div>
                            <p className="text-sm">{sub.user.name}</p>
                            <p className="text-xs text-muted-foreground">{sub.user.phone}</p>
                          </div>
                        </td>
                        <td className="py-3 px-4">
                          <div className="space-y-1">
                            {getStatusBadge(sub.status)}
                            {sub.rejectionReason && (
                              <p className="text-xs text-red-500 max-w-[200px] truncate" title={sub.rejectionReason}>
                                사유: {sub.rejectionReason}
                              </p>
                            )}
                          </div>
                        </td>
                        <td className="py-3 px-4 text-sm text-muted-foreground">
                          {sub.submittedAt ? formatDate(sub.submittedAt) : "-"}
                        </td>
                        <td className="py-3 px-4 text-sm text-muted-foreground">
                          {sub.reviewedAt ? formatDate(sub.reviewedAt) : "-"}
                        </td>
                        <td className="py-3 px-4 text-right">
                          <div className="flex items-center justify-end gap-1">
                            <Link href={`/submissions/${sub.id}`}>
                              <Button variant="ghost" size="sm" title="상세보기">
                                <Eye className="h-4 w-4" />
                              </Button>
                            </Link>
                            {sub.status === "SUBMITTED" && (
                              <Button
                                variant="outline"
                                size="sm"
                                onClick={() => handleStartReview(sub.id)}
                                disabled={actionLoading === sub.id}
                              >
                                검토 시작
                              </Button>
                            )}
                            {(sub.status === "SUBMITTED" || sub.status === "IN_REVIEW") && (
                                <Button
                                  variant="default"
                                  size="sm"
                                  onClick={() => handleApprove(sub.id)}
                                  disabled={actionLoading === sub.id}
                                  title="승인"
                                  className="bg-green-600 hover:bg-green-700"
                                >
                                  {actionLoading === sub.id ? (
                                    <Loader2 className="h-4 w-4 animate-spin" />
                                  ) : (
                                    <CheckCheck className="h-4 w-4" />
                                  )}
                                </Button>
                            )}
                          </div>
                        </td>
                      </tr>
                    ))}
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
