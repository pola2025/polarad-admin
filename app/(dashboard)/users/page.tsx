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
  Users,
  Search,
  ChevronLeft,
  ChevronRight,
  CheckCircle,
  XCircle,
  FileText,
  Bell,
  Mail,
  Phone,
  Eye,
  Edit,
  Loader2,
  Power,
  PowerOff,
  Trash2,
} from "lucide-react";
import Link from "next/link";

interface User {
  id: string;
  clientName: string;
  name: string;
  email: string;
  phone: string;
  isActive: boolean;
  smsConsent: boolean;
  emailConsent: boolean;
  telegramEnabled: boolean;
  lastLoginAt: string | null;
  createdAt: string;
  submission: {
    status: string;
    isComplete: boolean;
  } | null;
  _count: {
    workflows: number;
  };
}

interface Stats {
  total: number;
  active: number;
  inactive: number;
  submissionComplete: number;
}

interface Pagination {
  page: number;
  limit: number;
  total: number;
  totalPages: number;
}

export default function UsersPage() {
  const [users, setUsers] = useState<User[]>([]);
  const [stats, setStats] = useState<Stats | null>(null);
  const [pagination, setPagination] = useState<Pagination | null>(null);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState<string>("all");
  const [currentPage, setCurrentPage] = useState(1);
  const [togglingId, setTogglingId] = useState<string | null>(null);
  const [deletingId, setDeletingId] = useState<string | null>(null);

  const fetchUsers = useCallback(async () => {
    setLoading(true);
    try {
      const params = new URLSearchParams({
        page: currentPage.toString(),
        limit: "20",
        ...(search && { search }),
        ...(statusFilter !== "all" && { status: statusFilter }),
      });

      const res = await fetch(`/api/users?${params}`);
      const data = await res.json();

      if (data.success) {
        setUsers(data.data);
        setStats(data.stats);
        setPagination(data.pagination);
      }
    } catch (error) {
      console.error("Fetch users error:", error);
    } finally {
      setLoading(false);
    }
  }, [currentPage, search, statusFilter]);

  useEffect(() => {
    fetchUsers();
  }, [fetchUsers]);

  const handleSearch = (e: React.FormEvent) => {
    e.preventDefault();
    setCurrentPage(1);
    fetchUsers();
  };

  const getSubmissionBadge = (submission: User["submission"]) => {
    if (!submission) {
      return <Badge variant="secondary">미제출</Badge>;
    }
    if (submission.isComplete) {
      return <Badge variant="success">제출완료</Badge>;
    }
    return <Badge variant="warning">작성중</Badge>;
  };

  const handleToggleActive = async (user: User) => {
    if (togglingId) return;

    const newStatus = !user.isActive;
    const action = newStatus ? "활성화" : "비활성화";

    if (!confirm(`${user.clientName} 사용자를 ${action}하시겠습니까?`)) {
      return;
    }

    setTogglingId(user.id);
    try {
      const res = await fetch(`/api/users/${user.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ isActive: newStatus }),
      });

      if (res.ok) {
        fetchUsers();
      } else {
        const data = await res.json();
        alert(data.error || `${action}에 실패했습니다.`);
      }
    } catch (error) {
      console.error("Toggle active error:", error);
      alert(`${action} 처리 중 오류가 발생했습니다.`);
    } finally {
      setTogglingId(null);
    }
  };

  const handleDelete = async (userId: string, clientName: string) => {
    if (!confirm(`"${clientName}" 사용자를 완전히 삭제하시겠습니까?\n\n⚠️ 이 작업은 되돌릴 수 없습니다.`)) {
      return;
    }

    setDeletingId(userId);
    try {
      const res = await fetch(`/api/users/${userId}`, {
        method: "DELETE",
      });
      const data = await res.json();

      if (data.success) {
        fetchUsers();
      } else {
        alert(data.error || "삭제에 실패했습니다.");
      }
    } catch (error) {
      console.error("Delete user error:", error);
      alert("삭제 중 오류가 발생했습니다.");
    } finally {
      setDeletingId(null);
    }
  };

  return (
    <div className="space-y-4 lg:space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="text-xl lg:text-2xl font-bold text-gray-900 dark:text-white">
          사용자 관리
        </h1>
      </div>

      {/* 통계 카드 */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 lg:gap-4">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-1 lg:pb-2 px-3 lg:px-6 pt-3 lg:pt-6">
            <CardTitle className="text-xs lg:text-sm font-medium">전체 사용자</CardTitle>
            <Users className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent className="px-3 lg:px-6 pb-3 lg:pb-6">
            <div className="text-xl lg:text-2xl font-bold">{stats?.total || 0}</div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-1 lg:pb-2 px-3 lg:px-6 pt-3 lg:pt-6">
            <CardTitle className="text-xs lg:text-sm font-medium">활성</CardTitle>
            <CheckCircle className="h-4 w-4 text-green-500" />
          </CardHeader>
          <CardContent className="px-3 lg:px-6 pb-3 lg:pb-6">
            <div className="text-xl lg:text-2xl font-bold text-green-600">{stats?.active || 0}</div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-1 lg:pb-2 px-3 lg:px-6 pt-3 lg:pt-6">
            <CardTitle className="text-xs lg:text-sm font-medium">비활성</CardTitle>
            <XCircle className="h-4 w-4 text-red-500" />
          </CardHeader>
          <CardContent className="px-3 lg:px-6 pb-3 lg:pb-6">
            <div className="text-xl lg:text-2xl font-bold text-red-600">{stats?.inactive || 0}</div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-1 lg:pb-2 px-3 lg:px-6 pt-3 lg:pt-6">
            <CardTitle className="text-xs lg:text-sm font-medium">자료 제출</CardTitle>
            <FileText className="h-4 w-4 text-blue-500" />
          </CardHeader>
          <CardContent className="px-3 lg:px-6 pb-3 lg:pb-6">
            <div className="text-xl lg:text-2xl font-bold text-blue-600">
              {stats?.submissionComplete || 0}
            </div>
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
                  placeholder="업체명, 이름, 연락처 검색..."
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
              <Button
                variant={statusFilter === "all" ? "default" : "outline"}
                onClick={() => {
                  setStatusFilter("all");
                  setCurrentPage(1);
                }}
                size="sm"
                className="flex-shrink-0"
              >
                전체
              </Button>
              <Button
                variant={statusFilter === "active" ? "default" : "outline"}
                onClick={() => {
                  setStatusFilter("active");
                  setCurrentPage(1);
                }}
                size="sm"
                className="flex-shrink-0"
              >
                활성
              </Button>
              <Button
                variant={statusFilter === "inactive" ? "default" : "outline"}
                onClick={() => {
                  setStatusFilter("inactive");
                  setCurrentPage(1);
                }}
                size="sm"
                className="flex-shrink-0"
              >
                비활성
              </Button>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* 사용자 목록 */}
      <Card>
        <CardContent className="p-3 lg:pt-6 lg:px-6 lg:pb-6">
          {loading ? (
            <div className="flex items-center justify-center py-12">
              <Loader2 className="h-8 w-8 animate-spin text-blue-600" />
            </div>
          ) : users.length === 0 ? (
            <div className="text-center py-12 text-muted-foreground">
              사용자가 없습니다.
            </div>
          ) : (
            <>
              {/* 모바일 카드 뷰 */}
              <div className="lg:hidden space-y-3">
                {users.map((user) => (
                  <div
                    key={user.id}
                    className="p-3 bg-gray-50 dark:bg-gray-800 rounded-lg space-y-3"
                  >
                    <div className="flex items-start justify-between gap-2">
                      <div className="min-w-0 flex-1">
                        <p className="font-medium text-gray-900 dark:text-white truncate">
                          {user.clientName}
                        </p>
                        <p className="text-sm text-muted-foreground">{user.name}</p>
                      </div>
                      <div className="flex items-center gap-1 flex-shrink-0">
                        <Badge variant={user.isActive ? "success" : "error"} className="text-xs">
                          {user.isActive ? "활성" : "비활성"}
                        </Badge>
                        {getSubmissionBadge(user.submission)}
                      </div>
                    </div>

                    <div className="flex flex-wrap items-center gap-2 text-xs text-muted-foreground">
                      <span className="flex items-center gap-1">
                        <Phone className="h-3 w-3" />
                        {user.phone}
                      </span>
                      <span className="flex items-center gap-1">
                        <Mail className="h-3 w-3" />
                        <span className="truncate max-w-[150px]">{user.email}</span>
                      </span>
                    </div>

                    <div className="flex items-center justify-between pt-2 border-t border-gray-200 dark:border-gray-700">
                      <div className="flex items-center gap-2">
                        {user.telegramEnabled && (
                          <Bell className="h-4 w-4 text-blue-500" />
                        )}
                        {user.smsConsent && (
                          <span className="text-xs bg-green-100 text-green-700 px-1.5 py-0.5 rounded">
                            SMS
                          </span>
                        )}
                        {user.emailConsent && (
                          <span className="text-xs bg-blue-100 text-blue-700 px-1.5 py-0.5 rounded">
                            이메일
                          </span>
                        )}
                        <span className="text-xs text-muted-foreground">
                          {formatDate(user.createdAt)}
                        </span>
                      </div>

                      <div className="flex items-center gap-1">
                        <Link href={`/users/${user.id}`}>
                          <Button variant="ghost" size="sm" className="h-8 w-8 p-0">
                            <Eye className="h-4 w-4" />
                          </Button>
                        </Link>
                        <Link href={`/users/${user.id}/edit`}>
                          <Button variant="ghost" size="sm" className="h-8 w-8 p-0">
                            <Edit className="h-4 w-4" />
                          </Button>
                        </Link>
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() => handleToggleActive(user)}
                          disabled={togglingId === user.id}
                          className={`h-8 w-8 p-0 ${user.isActive ? "text-red-500" : "text-green-500"}`}
                        >
                          {togglingId === user.id ? (
                            <Loader2 className="h-4 w-4 animate-spin" />
                          ) : user.isActive ? (
                            <PowerOff className="h-4 w-4" />
                          ) : (
                            <Power className="h-4 w-4" />
                          )}
                        </Button>
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() => handleDelete(user.id, user.clientName)}
                          disabled={deletingId === user.id}
                          className="h-8 w-8 p-0 text-red-500"
                        >
                          {deletingId === user.id ? (
                            <Loader2 className="h-4 w-4 animate-spin" />
                          ) : (
                            <Trash2 className="h-4 w-4" />
                          )}
                        </Button>
                      </div>
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
                        업체/담당자
                      </th>
                      <th className="text-left py-3 px-4 font-medium text-muted-foreground">
                        연락처
                      </th>
                      <th className="text-left py-3 px-4 font-medium text-muted-foreground">
                        자료제출
                      </th>
                      <th className="text-left py-3 px-4 font-medium text-muted-foreground">
                        알림
                      </th>
                      <th className="text-left py-3 px-4 font-medium text-muted-foreground">
                        상태
                      </th>
                      <th className="text-left py-3 px-4 font-medium text-muted-foreground">
                        가입일
                      </th>
                      <th className="text-right py-3 px-4 font-medium text-muted-foreground">
                        관리
                      </th>
                    </tr>
                  </thead>
                  <tbody>
                    {users.map((user) => (
                      <tr
                        key={user.id}
                        className="border-b hover:bg-gray-50 dark:hover:bg-gray-800/50"
                      >
                        <td className="py-3 px-4">
                          <div>
                            <p className="font-medium text-gray-900 dark:text-white">
                              {user.clientName}
                            </p>
                            <p className="text-sm text-muted-foreground">{user.name}</p>
                          </div>
                        </td>
                        <td className="py-3 px-4">
                          <div className="space-y-1">
                            <p className="text-sm flex items-center gap-1">
                              <Mail className="h-3 w-3" />
                              {user.email}
                            </p>
                            <p className="text-sm flex items-center gap-1">
                              <Phone className="h-3 w-3" />
                              {user.phone}
                            </p>
                          </div>
                        </td>
                        <td className="py-3 px-4">{getSubmissionBadge(user.submission)}</td>
                        <td className="py-3 px-4">
                          <div className="flex items-center gap-2">
                            {user.telegramEnabled && (
                              <Bell className="h-4 w-4 text-blue-500" aria-label="텔레그램" />
                            )}
                            {user.smsConsent && (
                              <span className="text-xs bg-green-100 text-green-700 px-1.5 py-0.5 rounded">
                                SMS
                              </span>
                            )}
                            {user.emailConsent && (
                              <span className="text-xs bg-blue-100 text-blue-700 px-1.5 py-0.5 rounded">
                                이메일
                              </span>
                            )}
                          </div>
                        </td>
                        <td className="py-3 px-4">
                          <Badge variant={user.isActive ? "success" : "error"}>
                            {user.isActive ? "활성" : "비활성"}
                          </Badge>
                        </td>
                        <td className="py-3 px-4 text-sm text-muted-foreground">
                          {formatDate(user.createdAt)}
                        </td>
                        <td className="py-3 px-4 text-right">
                          <div className="flex items-center justify-end gap-1">
                            <Link href={`/users/${user.id}`}>
                              <Button variant="ghost" size="sm" title="상세보기">
                                <Eye className="h-4 w-4" />
                              </Button>
                            </Link>
                            <Link href={`/users/${user.id}/edit`}>
                              <Button variant="ghost" size="sm" title="수정">
                                <Edit className="h-4 w-4" />
                              </Button>
                            </Link>
                            <Button
                              variant="ghost"
                              size="sm"
                              onClick={() => handleToggleActive(user)}
                              disabled={togglingId === user.id}
                              title={user.isActive ? "비활성화" : "활성화"}
                              className={user.isActive ? "text-red-500 hover:text-red-600 hover:bg-red-50" : "text-green-500 hover:text-green-600 hover:bg-green-50"}
                            >
                              {togglingId === user.id ? (
                                <Loader2 className="h-4 w-4 animate-spin" />
                              ) : user.isActive ? (
                                <PowerOff className="h-4 w-4" />
                              ) : (
                                <Power className="h-4 w-4" />
                              )}
                            </Button>
                            <Button
                              variant="ghost"
                              size="sm"
                              onClick={() => handleDelete(user.id, user.clientName)}
                              disabled={deletingId === user.id}
                              title="삭제"
                              className="text-red-500 hover:text-red-700 hover:bg-red-50"
                            >
                              {deletingId === user.id ? (
                                <Loader2 className="h-4 w-4 animate-spin" />
                              ) : (
                                <Trash2 className="h-4 w-4" />
                              )}
                            </Button>
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
                총 {pagination.total}명 중 {(pagination.page - 1) * pagination.limit + 1}-
                {Math.min(pagination.page * pagination.limit, pagination.total)}명
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
