"use client";

import { useState, useEffect, use } from "react";
import { useRouter } from "next/navigation";
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
  Button,
  Input,
  Label,
  Badge,
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
  formatDate,
  formatDateTime,
  getDaysUntilExpiry,
} from "@polarad/ui";
import {
  ArrowLeft,
  Save,
  Loader2,
  Trash2,
  Bell,
  Key,
  Calendar,
  Building,
  AlertCircle,
  CheckCircle,
} from "lucide-react";

type AuthStatus = "ACTIVE" | "AUTH_REQUIRED" | "TOKEN_EXPIRED" | "TOKEN_EXPIRING";
type PlanType = "FREE" | "BASIC" | "PREMIUM" | "ENTERPRISE";

interface ClientDetail {
  id: string;
  clientId: string;
  clientName: string;
  email: string;
  phone: string | null;
  metaAdAccountId: string | null;
  metaAccessToken: string | null;
  metaRefreshToken: string | null;
  tokenExpiresAt: string | null;
  authStatus: AuthStatus;
  servicePeriodStart: string | null;
  servicePeriodEnd: string | null;
  telegramChatId: string | null;
  telegramEnabled: boolean;
  planType: PlanType;
  isActive: boolean;
  memo: string | null;
  createdAt: string;
  updatedAt: string;
  notificationLogs: Array<{
    id: string;
    notificationType: string;
    channel: string;
    status: string;
    sentAt: string;
  }>;
  tokenRefreshLogs: Array<{
    id: string;
    success: boolean;
    refreshedAt: string;
    errorMessage: string | null;
  }>;
}

interface ClientFormData {
  clientName: string;
  email: string;
  phone: string;
  servicePeriodStart: string;
  servicePeriodEnd: string;
  telegramChatId: string;
  telegramEnabled: boolean;
  planType: PlanType;
  isActive: boolean;
  memo: string;
}

const PLAN_OPTIONS: { value: PlanType; label: string }[] = [
  { value: "FREE", label: "무료" },
  { value: "BASIC", label: "베이직" },
  { value: "PREMIUM", label: "프리미엄" },
  { value: "ENTERPRISE", label: "엔터프라이즈" },
];

const AUTH_STATUS_LABELS: Record<AuthStatus, string> = {
  ACTIVE: "정상",
  AUTH_REQUIRED: "재인증 필요",
  TOKEN_EXPIRED: "토큰 만료",
  TOKEN_EXPIRING: "만료 임박",
};

const NOTIFICATION_TYPE_LABELS: Record<string, string> = {
  TOKEN_EXPIRY_CRITICAL: "토큰 만료 긴급",
  TOKEN_EXPIRY_WARNING: "토큰 만료 경고",
  TOKEN_EXPIRY_NOTICE: "토큰 만료 알림",
  AUTH_REQUIRED: "재인증 필요",
  SERVICE_EXPIRING: "서비스 만료 예정",
  SERVICE_EXPIRED: "서비스 만료",
  WELCOME: "환영 메시지",
  REPORT_DAILY: "일간 리포트",
  REPORT_WEEKLY: "주간 리포트",
  CUSTOM: "커스텀",
};

export default function ClientDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = use(params);
  const router = useRouter();
  const [client, setClient] = useState<ClientDetail | null>(null);
  const [formData, setFormData] = useState<ClientFormData | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [saveStatus, setSaveStatus] = useState<"idle" | "success" | "error">("idle");
  const [showDeleteModal, setShowDeleteModal] = useState(false);
  const [deleting, setDeleting] = useState(false);

  useEffect(() => {
    fetchClient();
  }, [id]);

  async function fetchClient() {
    setLoading(true);
    try {
      const res = await fetch(`/api/clients/${id}`);
      const data = await res.json();

      if (data.success) {
        setClient(data.data);
        setFormData({
          clientName: data.data.clientName,
          email: data.data.email,
          phone: data.data.phone || "",
          servicePeriodStart: data.data.servicePeriodStart
            ? new Date(data.data.servicePeriodStart).toISOString().split("T")[0]
            : "",
          servicePeriodEnd: data.data.servicePeriodEnd
            ? new Date(data.data.servicePeriodEnd).toISOString().split("T")[0]
            : "",
          telegramChatId: data.data.telegramChatId || "",
          telegramEnabled: data.data.telegramEnabled,
          planType: data.data.planType,
          isActive: data.data.isActive,
          memo: data.data.memo || "",
        });
      } else {
        router.push("/clients");
      }
    } catch (error) {
      console.error("Client fetch error:", error);
      router.push("/clients");
    } finally {
      setLoading(false);
    }
  }

  async function handleSave() {
    if (!formData) return;

    setSaving(true);
    setSaveStatus("idle");
    try {
      const res = await fetch(`/api/clients/${id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          ...formData,
          servicePeriodStart: formData.servicePeriodStart || null,
          servicePeriodEnd: formData.servicePeriodEnd || null,
        }),
      });

      const data = await res.json();

      if (data.success) {
        setSaveStatus("success");
        fetchClient();
        setTimeout(() => setSaveStatus("idle"), 3000);
      } else {
        setSaveStatus("error");
      }
    } catch (error) {
      console.error("Save error:", error);
      setSaveStatus("error");
    } finally {
      setSaving(false);
    }
  }

  async function handleDelete() {
    setDeleting(true);
    try {
      const res = await fetch(`/api/clients/${id}`, {
        method: "DELETE",
      });

      const data = await res.json();

      if (data.success) {
        router.push("/clients");
      } else {
        alert(data.error || "삭제에 실패했습니다.");
      }
    } catch (error) {
      console.error("Delete error:", error);
      alert("삭제에 실패했습니다.");
    } finally {
      setDeleting(false);
      setShowDeleteModal(false);
    }
  }

  function updateField(field: keyof ClientFormData, value: string | boolean) {
    if (!formData) return;
    setFormData({ ...formData, [field]: value });
    setSaveStatus("idle");
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
      </div>
    );
  }

  if (!client || !formData) {
    return null;
  }

  const daysUntilExpiry = getDaysUntilExpiry(client.tokenExpiresAt);

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-4">
          <Button variant="ghost" size="sm" onClick={() => router.back()}>
            <ArrowLeft className="h-4 w-4 mr-2" />
            뒤로
          </Button>
          <div>
            <h1 className="text-2xl font-bold text-gray-900 dark:text-white">
              {client.clientName}
            </h1>
            <p className="text-sm text-muted-foreground">{client.clientId}</p>
          </div>
        </div>
        <div className="flex items-center gap-2">
          <Button
            variant="destructive"
            size="sm"
            onClick={() => setShowDeleteModal(true)}
          >
            <Trash2 className="h-4 w-4 mr-2" />
            삭제
          </Button>
        </div>
      </div>

      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <Card>
          <CardContent className="pt-4">
            <div className="flex items-center gap-2">
              <Key className="h-4 w-4 text-muted-foreground" />
              <span className="text-sm text-muted-foreground">토큰 상태</span>
            </div>
            <div className="mt-2">
              <Badge
                variant={
                  client.authStatus === "ACTIVE"
                    ? "success"
                    : client.authStatus === "TOKEN_EXPIRING"
                    ? "warning"
                    : "error"
                }
              >
                {AUTH_STATUS_LABELS[client.authStatus]}
              </Badge>
              {daysUntilExpiry !== null && (
                <p className="text-xs text-muted-foreground mt-1">
                  {daysUntilExpiry > 0 ? `${daysUntilExpiry}일 남음` : "만료됨"}
                </p>
              )}
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="pt-4">
            <div className="flex items-center gap-2">
              <Bell className="h-4 w-4 text-muted-foreground" />
              <span className="text-sm text-muted-foreground">텔레그램</span>
            </div>
            <div className="mt-2">
              <Badge variant={client.telegramEnabled ? "success" : "secondary"}>
                {client.telegramEnabled ? "활성" : "비활성"}
              </Badge>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="pt-4">
            <div className="flex items-center gap-2">
              <Building className="h-4 w-4 text-muted-foreground" />
              <span className="text-sm text-muted-foreground">플랜</span>
            </div>
            <div className="mt-2">
              <Badge variant="info">
                {PLAN_OPTIONS.find((p) => p.value === client.planType)?.label}
              </Badge>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="pt-4">
            <div className="flex items-center gap-2">
              <Calendar className="h-4 w-4 text-muted-foreground" />
              <span className="text-sm text-muted-foreground">등록일</span>
            </div>
            <p className="text-sm font-medium mt-2">{formatDate(client.createdAt)}</p>
          </CardContent>
        </Card>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        <div className="lg:col-span-2 space-y-6">
          <Card>
            <CardHeader>
              <CardTitle>기본 정보</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <Label htmlFor="clientName">클라이언트명</Label>
                  <Input
                    id="clientName"
                    value={formData.clientName}
                    onChange={(e) => updateField("clientName", e.target.value)}
                    className="mt-1"
                  />
                </div>
                <div>
                  <Label htmlFor="email">이메일</Label>
                  <Input
                    id="email"
                    type="email"
                    value={formData.email}
                    onChange={(e) => updateField("email", e.target.value)}
                    className="mt-1"
                  />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <Label htmlFor="phone">연락처</Label>
                  <Input
                    id="phone"
                    value={formData.phone}
                    onChange={(e) => updateField("phone", e.target.value)}
                    placeholder="010-1234-5678"
                    className="mt-1"
                  />
                </div>
                <div>
                  <Label htmlFor="planType">플랜</Label>
                  <select
                    id="planType"
                    value={formData.planType}
                    onChange={(e) => updateField("planType", e.target.value)}
                    className="mt-1 w-full px-3 py-2 rounded-lg border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-800"
                  >
                    {PLAN_OPTIONS.map((option) => (
                      <option key={option.value} value={option.value}>
                        {option.label}
                      </option>
                    ))}
                  </select>
                </div>
              </div>

              <div className="flex items-center gap-6">
                <label className="flex items-center gap-2 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={formData.isActive}
                    onChange={(e) => updateField("isActive", e.target.checked)}
                    className="w-4 h-4 rounded border-gray-300"
                  />
                  <span className="text-sm">활성 상태</span>
                </label>
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle>서비스 기간</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <Label htmlFor="servicePeriodStart">시작일</Label>
                  <Input
                    id="servicePeriodStart"
                    type="date"
                    value={formData.servicePeriodStart}
                    onChange={(e) => updateField("servicePeriodStart", e.target.value)}
                    className="mt-1"
                  />
                </div>
                <div>
                  <Label htmlFor="servicePeriodEnd">종료일</Label>
                  <Input
                    id="servicePeriodEnd"
                    type="date"
                    value={formData.servicePeriodEnd}
                    onChange={(e) => updateField("servicePeriodEnd", e.target.value)}
                    className="mt-1"
                  />
                </div>
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle>텔레그램 알림</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <Label htmlFor="telegramChatId">Chat ID</Label>
                  <Input
                    id="telegramChatId"
                    value={formData.telegramChatId}
                    onChange={(e) => updateField("telegramChatId", e.target.value)}
                    placeholder="123456789"
                    className="mt-1"
                  />
                </div>
                <div className="flex items-center pt-6">
                  <label className="flex items-center gap-2 cursor-pointer">
                    <input
                      type="checkbox"
                      checked={formData.telegramEnabled}
                      onChange={(e) => updateField("telegramEnabled", e.target.checked)}
                      className="w-4 h-4 rounded border-gray-300"
                    />
                    <span className="text-sm">텔레그램 알림 활성화</span>
                  </label>
                </div>
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle>메모</CardTitle>
            </CardHeader>
            <CardContent>
              <textarea
                value={formData.memo}
                onChange={(e) => updateField("memo", e.target.value)}
                placeholder="클라이언트에 대한 메모..."
                rows={3}
                className="w-full px-3 py-2 rounded-lg border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-800 resize-none"
              />
            </CardContent>
          </Card>

          <div className="flex items-center justify-end gap-4">
            {saveStatus === "success" && (
              <div className="flex items-center gap-2 text-green-600">
                <CheckCircle className="h-4 w-4" />
                <span className="text-sm">저장되었습니다.</span>
              </div>
            )}
            {saveStatus === "error" && (
              <div className="flex items-center gap-2 text-red-600">
                <AlertCircle className="h-4 w-4" />
                <span className="text-sm">저장에 실패했습니다.</span>
              </div>
            )}
            <Button onClick={handleSave} disabled={saving}>
              {saving ? (
                <Loader2 className="h-4 w-4 animate-spin mr-2" />
              ) : (
                <Save className="h-4 w-4 mr-2" />
              )}
              저장
            </Button>
          </div>
        </div>

        <div className="space-y-6">
          <Card>
            <CardHeader>
              <CardTitle className="text-base">최근 알림 이력</CardTitle>
            </CardHeader>
            <CardContent>
              {client.notificationLogs.length === 0 ? (
                <p className="text-sm text-muted-foreground">알림 이력이 없습니다.</p>
              ) : (
                <div className="space-y-3">
                  {client.notificationLogs.map((log) => (
                    <div
                      key={log.id}
                      className="p-2 bg-gray-50 dark:bg-gray-800 rounded-lg text-sm"
                    >
                      <div className="flex items-center justify-between">
                        <span className="font-medium">
                          {NOTIFICATION_TYPE_LABELS[log.notificationType] || log.notificationType}
                        </span>
                        <Badge
                          variant={log.status === "SENT" ? "success" : "error"}
                          className="text-xs"
                        >
                          {log.status === "SENT" ? "발송" : "실패"}
                        </Badge>
                      </div>
                      <p className="text-xs text-muted-foreground mt-1">
                        {formatDateTime(log.sentAt)}
                      </p>
                    </div>
                  ))}
                </div>
              )}
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle className="text-base">토큰 갱신 이력</CardTitle>
            </CardHeader>
            <CardContent>
              {client.tokenRefreshLogs.length === 0 ? (
                <p className="text-sm text-muted-foreground">갱신 이력이 없습니다.</p>
              ) : (
                <div className="space-y-3">
                  {client.tokenRefreshLogs.map((log) => (
                    <div
                      key={log.id}
                      className="p-2 bg-gray-50 dark:bg-gray-800 rounded-lg text-sm"
                    >
                      <div className="flex items-center justify-between">
                        <span className="font-medium">토큰 갱신</span>
                        <Badge
                          variant={log.success ? "success" : "error"}
                          className="text-xs"
                        >
                          {log.success ? "성공" : "실패"}
                        </Badge>
                      </div>
                      {log.errorMessage && (
                        <p className="text-xs text-red-500 mt-1">{log.errorMessage}</p>
                      )}
                      <p className="text-xs text-muted-foreground mt-1">
                        {formatDateTime(log.refreshedAt)}
                      </p>
                    </div>
                  ))}
                </div>
              )}
            </CardContent>
          </Card>
        </div>
      </div>

      <Dialog open={showDeleteModal} onOpenChange={setShowDeleteModal}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>클라이언트 삭제</DialogTitle>
            <DialogDescription>
              정말 이 클라이언트를 삭제하시겠습니까? 관련된 모든 알림 로그와 토큰 갱신
              이력도 함께 삭제됩니다. 이 작업은 되돌릴 수 없습니다.
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button variant="outline" onClick={() => setShowDeleteModal(false)}>
              취소
            </Button>
            <Button variant="destructive" onClick={handleDelete} disabled={deleting}>
              {deleting ? (
                <Loader2 className="h-4 w-4 animate-spin mr-2" />
              ) : (
                <Trash2 className="h-4 w-4 mr-2" />
              )}
              삭제
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
