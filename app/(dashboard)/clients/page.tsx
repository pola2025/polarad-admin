"use client";

import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import {
  Button,
  Input,
  Badge,
  Card,
  CardContent,
  CardHeader,
  CardTitle,
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  formatDate,
  getDaysUntilExpiry,
} from "@polarad/ui";
import { Search, Plus, RefreshCw } from "lucide-react";

interface ClientListItem {
  id: string;
  clientId: string;
  clientName: string;
  email: string;
  phone: string | null;
  metaAdAccountId: string | null;
  tokenExpiresAt: string | null;
  authStatus: string;
  planType: string;
  isActive: boolean;
  telegramEnabled: boolean;
}

interface NewClientForm {
  clientId: string;
  clientName: string;
  email: string;
  phone: string;
  planType: "FREE" | "BASIC" | "PREMIUM" | "ENTERPRISE";
  telegramChatId: string;
  telegramEnabled: boolean;
  memo: string;
}

const initialFormState: NewClientForm = {
  clientId: "",
  clientName: "",
  email: "",
  phone: "",
  planType: "FREE",
  telegramChatId: "",
  telegramEnabled: false,
  memo: "",
};

export default function ClientsPage() {
  const router = useRouter();
  const [clients, setClients] = useState<ClientListItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [pagination, setPagination] = useState({
    total: 0,
    page: 1,
    limit: 20,
    totalPages: 0,
  });

  const [showAddModal, setShowAddModal] = useState(false);
  const [formData, setFormData] = useState<NewClientForm>(initialFormState);
  const [formError, setFormError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  async function fetchClients() {
    setLoading(true);
    try {
      const params = new URLSearchParams({
        page: pagination.page.toString(),
        limit: pagination.limit.toString(),
      });
      if (search) params.set("search", search);

      const res = await fetch(`/api/clients?${params}`);
      const data = await res.json();

      if (data.success) {
        setClients(data.data);
        setPagination(data.pagination);
      }
    } catch (error) {
      console.error("Clients fetch error:", error);
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    fetchClients();
  }, [pagination.page]);

  function handleSearch(e: React.FormEvent) {
    e.preventDefault();
    setPagination((prev) => ({ ...prev, page: 1 }));
    fetchClients();
  }

  async function handleAddClient(e: React.FormEvent) {
    e.preventDefault();
    setFormError(null);

    if (!formData.clientId.trim()) {
      setFormError("클라이언트 ID를 입력해주세요.");
      return;
    }
    if (!formData.clientName.trim()) {
      setFormError("클라이언트명을 입력해주세요.");
      return;
    }
    if (!formData.email.trim()) {
      setFormError("이메일을 입력해주세요.");
      return;
    }

    setSubmitting(true);
    try {
      const res = await fetch("/api/clients", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(formData),
      });

      const data = await res.json();

      if (!res.ok) {
        throw new Error(data.error || "등록에 실패했습니다.");
      }

      setShowAddModal(false);
      setFormData(initialFormState);
      fetchClients();
    } catch (error) {
      setFormError(error instanceof Error ? error.message : "등록에 실패했습니다.");
    } finally {
      setSubmitting(false);
    }
  }

  function updateFormField(field: keyof NewClientForm, value: string | boolean) {
    setFormData((prev) => ({ ...prev, [field]: value }));
    setFormError(null);
  }

  function getStatusBadge(client: ClientListItem) {
    if (client.authStatus === "AUTH_REQUIRED") {
      return <Badge variant="error">재인증 필요</Badge>;
    }
    if (client.authStatus === "TOKEN_EXPIRED") {
      return <Badge variant="error">토큰 만료</Badge>;
    }

    const days = getDaysUntilExpiry(client.tokenExpiresAt);
    if (days !== null && days <= 3) {
      return <Badge variant="error">{days}일 남음</Badge>;
    }
    if (days !== null && days <= 7) {
      return <Badge variant="warning">{days}일 남음</Badge>;
    }
    if (days !== null && days <= 14) {
      return <Badge variant="info">{days}일 남음</Badge>;
    }

    return <Badge variant="success">정상</Badge>;
  }

  return (
    <div className="space-y-4 lg:space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
        <h1 className="text-xl lg:text-2xl font-bold text-gray-900 dark:text-white">
          클라이언트 관리
        </h1>
        <Button onClick={() => setShowAddModal(true)} className="w-full sm:w-auto">
          <Plus className="w-4 h-4 mr-2" />
          새 클라이언트
        </Button>
      </div>

      <Card>
        <CardContent className="pt-4 lg:pt-6">
          <form onSubmit={handleSearch} className="flex flex-col sm:flex-row gap-2">
            <div className="relative flex-1">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
              <Input
                placeholder="클라이언트명, 이메일, ID로 검색..."
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                className="pl-10"
              />
            </div>
            <div className="flex gap-2">
              <Button type="submit" variant="secondary" className="flex-1 sm:flex-none">
                검색
              </Button>
              <Button
                type="button"
                variant="outline"
                onClick={() => {
                  setSearch("");
                  fetchClients();
                }}
              >
                <RefreshCw className="w-4 h-4" />
              </Button>
            </div>
          </form>
        </CardContent>
      </Card>

      <Card>
        <CardHeader className="pb-3 lg:pb-6">
          <CardTitle className="text-base lg:text-lg">
            클라이언트 목록 ({pagination.total}건)
          </CardTitle>
        </CardHeader>
        <CardContent>
          {loading ? (
            <div className="flex items-center justify-center h-32">
              <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600"></div>
            </div>
          ) : clients.length === 0 ? (
            <p className="text-center text-muted-foreground py-8">
              등록된 클라이언트가 없습니다.
            </p>
          ) : (
            <>
              {/* Mobile Card View */}
              <div className="lg:hidden space-y-3">
                {clients.map((client) => (
                  <div
                    key={client.id}
                    className="p-4 bg-gray-50 dark:bg-gray-800 rounded-lg cursor-pointer active:bg-gray-100 dark:active:bg-gray-700"
                    onClick={() => router.push(`/clients/${client.id}`)}
                  >
                    <div className="flex items-start justify-between mb-2">
                      <div>
                        <p className="font-medium text-gray-900 dark:text-white">{client.clientName}</p>
                        <p className="text-sm text-muted-foreground">{client.clientId}</p>
                      </div>
                      <div className="flex flex-col items-end gap-1">
                        {getStatusBadge(client)}
                        {client.telegramEnabled ? (
                          <Badge variant="success">알림 활성</Badge>
                        ) : (
                          <Badge variant="secondary">알림 비활성</Badge>
                        )}
                      </div>
                    </div>
                    <div className="grid grid-cols-2 gap-2 text-sm mt-3 pt-3 border-t border-gray-200 dark:border-gray-700">
                      <div>
                        <p className="text-muted-foreground text-xs">이메일</p>
                        <p className="truncate">{client.email}</p>
                      </div>
                      <div>
                        <p className="text-muted-foreground text-xs">광고 계정</p>
                        <p className="truncate">{client.metaAdAccountId || "-"}</p>
                      </div>
                      <div className="col-span-2">
                        <p className="text-muted-foreground text-xs">토큰 만료</p>
                        <p>{formatDate(client.tokenExpiresAt)}</p>
                      </div>
                    </div>
                  </div>
                ))}
              </div>

              {/* Desktop Table View */}
              <div className="hidden lg:block overflow-x-auto">
                <table className="w-full">
                  <thead>
                    <tr className="border-b">
                      <th className="text-left py-3 px-4 font-medium text-sm">클라이언트</th>
                      <th className="text-left py-3 px-4 font-medium text-sm">이메일</th>
                      <th className="text-left py-3 px-4 font-medium text-sm">광고 계정</th>
                      <th className="text-left py-3 px-4 font-medium text-sm">토큰 만료</th>
                      <th className="text-left py-3 px-4 font-medium text-sm">상태</th>
                      <th className="text-left py-3 px-4 font-medium text-sm">알림</th>
                    </tr>
                  </thead>
                  <tbody>
                    {clients.map((client) => (
                      <tr
                        key={client.id}
                        className="border-b hover:bg-gray-50 dark:hover:bg-gray-800 cursor-pointer"
                        onClick={() => router.push(`/clients/${client.id}`)}
                      >
                        <td className="py-3 px-4">
                          <div>
                            <p className="font-medium">{client.clientName}</p>
                            <p className="text-sm text-muted-foreground">{client.clientId}</p>
                          </div>
                        </td>
                        <td className="py-3 px-4 text-sm">{client.email}</td>
                        <td className="py-3 px-4 text-sm">{client.metaAdAccountId || "-"}</td>
                        <td className="py-3 px-4 text-sm">{formatDate(client.tokenExpiresAt)}</td>
                        <td className="py-3 px-4">{getStatusBadge(client)}</td>
                        <td className="py-3 px-4">
                          {client.telegramEnabled ? (
                            <Badge variant="success">활성</Badge>
                          ) : (
                            <Badge variant="secondary">비활성</Badge>
                          )}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </>
          )}

          {pagination.totalPages > 1 && (
            <div className="flex items-center justify-center gap-2 mt-4">
              <Button
                variant="outline"
                size="sm"
                disabled={pagination.page === 1}
                onClick={() => setPagination((prev) => ({ ...prev, page: prev.page - 1 }))}
              >
                이전
              </Button>
              <span className="text-sm text-muted-foreground">
                {pagination.page} / {pagination.totalPages}
              </span>
              <Button
                variant="outline"
                size="sm"
                disabled={pagination.page === pagination.totalPages}
                onClick={() => setPagination((prev) => ({ ...prev, page: prev.page + 1 }))}
              >
                다음
              </Button>
            </div>
          )}
        </CardContent>
      </Card>

      <Dialog open={showAddModal} onOpenChange={setShowAddModal}>
        <DialogContent className="max-w-lg max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>새 클라이언트 등록</DialogTitle>
          </DialogHeader>

          <form onSubmit={handleAddClient} className="space-y-4">
            {formError && (
              <div className="p-3 bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded-lg text-red-600 dark:text-red-400 text-sm">
                {formError}
              </div>
            )}

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div>
                <label className="block text-sm font-medium mb-1">
                  클라이언트 ID <span className="text-red-500">*</span>
                </label>
                <Input
                  value={formData.clientId}
                  onChange={(e) => updateFormField("clientId", e.target.value)}
                  placeholder="예: client_001"
                />
              </div>
              <div>
                <label className="block text-sm font-medium mb-1">
                  클라이언트명 <span className="text-red-500">*</span>
                </label>
                <Input
                  value={formData.clientName}
                  onChange={(e) => updateFormField("clientName", e.target.value)}
                  placeholder="예: 홍길동 컴퍼니"
                />
              </div>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div>
                <label className="block text-sm font-medium mb-1">
                  이메일 <span className="text-red-500">*</span>
                </label>
                <Input
                  type="email"
                  value={formData.email}
                  onChange={(e) => updateFormField("email", e.target.value)}
                  placeholder="example@email.com"
                />
              </div>
              <div>
                <label className="block text-sm font-medium mb-1">연락처</label>
                <Input
                  value={formData.phone}
                  onChange={(e) => updateFormField("phone", e.target.value)}
                  placeholder="010-1234-5678"
                />
              </div>
            </div>

            <div>
              <label className="block text-sm font-medium mb-1">플랜</label>
              <select
                value={formData.planType}
                onChange={(e) => updateFormField("planType", e.target.value)}
                className="w-full px-3 py-2 rounded-lg border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-800"
              >
                <option value="FREE">무료</option>
                <option value="BASIC">베이직</option>
                <option value="PREMIUM">프리미엄</option>
                <option value="ENTERPRISE">엔터프라이즈</option>
              </select>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div>
                <label className="block text-sm font-medium mb-1">텔레그램 Chat ID</label>
                <Input
                  value={formData.telegramChatId}
                  onChange={(e) => updateFormField("telegramChatId", e.target.value)}
                  placeholder="123456789"
                />
              </div>
              <div className="flex items-center sm:pt-6">
                <label className="flex items-center gap-2 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={formData.telegramEnabled}
                    onChange={(e) => updateFormField("telegramEnabled", e.target.checked)}
                    className="w-4 h-4 rounded border-gray-300"
                  />
                  <span className="text-sm">텔레그램 알림 활성화</span>
                </label>
              </div>
            </div>

            <div>
              <label className="block text-sm font-medium mb-1">메모</label>
              <textarea
                value={formData.memo}
                onChange={(e) => updateFormField("memo", e.target.value)}
                placeholder="클라이언트에 대한 메모..."
                rows={2}
                className="w-full px-3 py-2 rounded-lg border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-800 resize-none"
              />
            </div>

            <div className="flex justify-end gap-2 pt-4">
              <Button
                type="button"
                variant="outline"
                onClick={() => {
                  setShowAddModal(false);
                  setFormData(initialFormState);
                  setFormError(null);
                }}
              >
                취소
              </Button>
              <Button type="submit" disabled={submitting}>
                {submitting ? "등록 중..." : "등록"}
              </Button>
            </div>
          </form>
        </DialogContent>
      </Dialog>
    </div>
  );
}
