"use client";

import { useState, useEffect, use } from "react";
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
  Badge,
  Button,
  Input,
  Label,
  formatDate,
  formatDateTime,
} from "@polarad/ui";
import {
  ArrowLeft,
  User,
  Mail,
  Phone,
  Building,
  Bell,
  FileText,
  Package,
  Clock,
  CheckCircle,
  XCircle,
  Loader2,
  Save,
  ExternalLink,
  Pencil,
} from "lucide-react";
import Link from "next/link";
import { useRouter } from "next/navigation";

interface Submission {
  id: string;
  businessLicense: string | null;
  profilePhoto: string | null;
  brandName: string | null;
  contactEmail: string | null;
  contactPhone: string | null;
  bankAccount: string | null;
  deliveryAddress: string | null;
  websiteStyle: string | null;
  websiteColor: string | null;
  blogDesignNote: string | null;
  additionalNote: string | null;
  status: string;
  isComplete: boolean;
  completedAt: string | null;
  createdAt: string;
  updatedAt: string;
}

interface Workflow {
  id: string;
  type: string;
  status: string;
  designUrl: string | null;
  finalUrl: string | null;
  courier: string | null;
  trackingNumber: string | null;
  revisionCount: number;
  createdAt: string;
  updatedAt: string;
}

interface Notification {
  id: string;
  type: string;
  channel: string;
  title: string | null;
  message: string;
  status: string;
  sentAt: string;
}

interface Client {
  id: string;
  clientId: string;
  metaAdAccountId: string | null;
  authStatus: string;
  tokenExpiresAt: string | null;
}

interface UserDetail {
  id: string;
  clientName: string;
  name: string;
  email: string;
  phone: string;
  isActive: boolean;
  smsConsent: boolean;
  emailConsent: boolean;
  telegramEnabled: boolean;
  telegramChatId: string | null;
  lastLoginAt: string | null;
  createdAt: string;
  updatedAt: string;
  submission: Submission | null;
  workflows: Workflow[];
  userNotifications: Notification[];
  client: Client | null;
}

const WORKFLOW_TYPE_LABELS: Record<string, string> = {
  NAMECARD: "명함",
  NAMETAG: "명찰",
  CONTRACT: "계약서",
  ENVELOPE: "봉투",
  WEBSITE: "웹사이트",
  BLOG: "블로그",
  META_ADS: "메타 광고",
  NAVER_ADS: "네이버 광고",
};

const WORKFLOW_STATUS_LABELS: Record<string, string> = {
  PENDING: "대기",
  SUBMITTED: "제출됨",
  IN_PROGRESS: "진행중",
  DESIGN_UPLOADED: "시안 업로드",
  ORDER_REQUESTED: "발주 요청",
  ORDER_APPROVED: "발주 승인",
  COMPLETED: "완료",
  SHIPPED: "배송완료",
  CANCELLED: "취소",
};

const getWorkflowStatusVariant = (status: string) => {
  switch (status) {
    case "PENDING":
      return "secondary";
    case "SUBMITTED":
      return "info";
    case "IN_PROGRESS":
      return "warning";
    case "DESIGN_UPLOADED":
      return "info";
    case "ORDER_REQUESTED":
      return "warning";
    case "ORDER_APPROVED":
      return "success";
    case "COMPLETED":
      return "success";
    case "SHIPPED":
      return "success";
    case "CANCELLED":
      return "error";
    default:
      return "secondary";
  }
};

export default function UserDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = use(params);
  const router = useRouter();
  const [user, setUser] = useState<UserDetail | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [isEditing, setIsEditing] = useState(false);
  const [editForm, setEditForm] = useState({
    clientName: "",
    name: "",
    email: "",
    phone: "",
    isActive: true,
    smsConsent: false,
    emailConsent: false,
    telegramEnabled: false,
    telegramChatId: "",
  });

  useEffect(() => {
    fetchUser();
  }, [id]);

  const fetchUser = async () => {
    setLoading(true);
    try {
      const res = await fetch(`/api/users/${id}`);
      const data = await res.json();

      if (data.success) {
        setUser(data.data);
        setEditForm({
          clientName: data.data.clientName,
          name: data.data.name,
          email: data.data.email,
          phone: data.data.phone,
          isActive: data.data.isActive,
          smsConsent: data.data.smsConsent,
          emailConsent: data.data.emailConsent,
          telegramEnabled: data.data.telegramEnabled,
          telegramChatId: data.data.telegramChatId || "",
        });
      }
    } catch (error) {
      console.error("Fetch user error:", error);
    } finally {
      setLoading(false);
    }
  };

  const handleSave = async () => {
    setSaving(true);
    try {
      const res = await fetch(`/api/users/${id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(editForm),
      });
      const data = await res.json();

      if (data.success) {
        setUser((prev) => (prev ? { ...prev, ...data.data } : null));
        setIsEditing(false);
        alert("저장되었습니다.");
      } else {
        alert(data.error || "저장에 실패했습니다.");
      }
    } catch (error) {
      console.error("Save error:", error);
      alert("저장 중 오류가 발생했습니다.");
    } finally {
      setSaving(false);
    }
  };

  const handleDeactivate = async () => {
    if (!confirm("정말 이 사용자를 비활성화하시겠습니까?")) return;

    try {
      const res = await fetch(`/api/users/${id}`, {
        method: "DELETE",
      });
      const data = await res.json();

      if (data.success) {
        alert("사용자가 비활성화되었습니다.");
        router.push("/users");
      } else {
        alert(data.error || "비활성화에 실패했습니다.");
      }
    } catch (error) {
      console.error("Deactivate error:", error);
      alert("비활성화 중 오류가 발생했습니다.");
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-[400px]">
        <Loader2 className="h-8 w-8 animate-spin text-blue-600" />
      </div>
    );
  }

  if (!user) {
    return (
      <div className="text-center py-12">
        <p className="text-muted-foreground">사용자를 찾을 수 없습니다.</p>
        <Link href="/users">
          <Button variant="outline" className="mt-4">
            목록으로 돌아가기
          </Button>
        </Link>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-4">
          <Link href="/users">
            <Button variant="ghost" size="sm">
              <ArrowLeft className="h-4 w-4 mr-2" />
              목록으로
            </Button>
          </Link>
          <div>
            <h1 className="text-2xl font-bold text-gray-900 dark:text-white">
              {user.clientName}
            </h1>
            <p className="text-sm text-muted-foreground">{user.name}</p>
          </div>
          <Badge variant={user.isActive ? "success" : "error"}>
            {user.isActive ? "활성" : "비활성"}
          </Badge>
        </div>
        <div className="flex gap-2">
          {isEditing ? (
            <>
              <Button variant="outline" onClick={() => setIsEditing(false)} disabled={saving}>
                취소
              </Button>
              <Button onClick={handleSave} disabled={saving}>
                {saving ? (
                  <Loader2 className="h-4 w-4 animate-spin mr-2" />
                ) : (
                  <Save className="h-4 w-4 mr-2" />
                )}
                저장
              </Button>
            </>
          ) : (
            <>
              <Button variant="outline" onClick={() => setIsEditing(true)}>
                <Pencil className="h-4 w-4 mr-2" />
                수정
              </Button>
              {user.isActive && (
                <Button variant="destructive" onClick={handleDeactivate}>
                  비활성화
                </Button>
              )}
            </>
          )}
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        <Card className="lg:col-span-2">
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <User className="h-5 w-5" />
              기본 정보
            </CardTitle>
          </CardHeader>
          <CardContent>
            {isEditing ? (
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <Label htmlFor="clientName">업체명</Label>
                  <Input
                    id="clientName"
                    value={editForm.clientName}
                    onChange={(e) => setEditForm({ ...editForm, clientName: e.target.value })}
                  />
                </div>
                <div>
                  <Label htmlFor="name">담당자명</Label>
                  <Input
                    id="name"
                    value={editForm.name}
                    onChange={(e) => setEditForm({ ...editForm, name: e.target.value })}
                  />
                </div>
                <div>
                  <Label htmlFor="email">이메일</Label>
                  <Input
                    id="email"
                    type="email"
                    value={editForm.email}
                    onChange={(e) => setEditForm({ ...editForm, email: e.target.value })}
                  />
                </div>
                <div>
                  <Label htmlFor="phone">연락처</Label>
                  <Input
                    id="phone"
                    value={editForm.phone}
                    onChange={(e) => setEditForm({ ...editForm, phone: e.target.value })}
                  />
                </div>
                <div>
                  <Label htmlFor="telegramChatId">텔레그램 Chat ID</Label>
                  <Input
                    id="telegramChatId"
                    value={editForm.telegramChatId}
                    onChange={(e) => setEditForm({ ...editForm, telegramChatId: e.target.value })}
                  />
                </div>
                <div className="flex flex-col gap-2">
                  <Label>알림 설정</Label>
                  <div className="flex flex-wrap gap-3">
                    <label className="flex items-center gap-2 cursor-pointer">
                      <input
                        type="checkbox"
                        checked={editForm.smsConsent}
                        onChange={(e) => setEditForm({ ...editForm, smsConsent: e.target.checked })}
                        className="rounded"
                      />
                      <span className="text-sm">SMS</span>
                    </label>
                    <label className="flex items-center gap-2 cursor-pointer">
                      <input
                        type="checkbox"
                        checked={editForm.emailConsent}
                        onChange={(e) => setEditForm({ ...editForm, emailConsent: e.target.checked })}
                        className="rounded"
                      />
                      <span className="text-sm">이메일</span>
                    </label>
                    <label className="flex items-center gap-2 cursor-pointer">
                      <input
                        type="checkbox"
                        checked={editForm.telegramEnabled}
                        onChange={(e) => setEditForm({ ...editForm, telegramEnabled: e.target.checked })}
                        className="rounded"
                      />
                      <span className="text-sm">텔레그램</span>
                    </label>
                  </div>
                </div>
              </div>
            ) : (
              <div className="grid grid-cols-2 gap-y-4">
                <div>
                  <p className="text-sm text-muted-foreground">업체명</p>
                  <p className="font-medium flex items-center gap-2">
                    <Building className="h-4 w-4" />
                    {user.clientName}
                  </p>
                </div>
                <div>
                  <p className="text-sm text-muted-foreground">담당자명</p>
                  <p className="font-medium">{user.name}</p>
                </div>
                <div>
                  <p className="text-sm text-muted-foreground">이메일</p>
                  <p className="font-medium flex items-center gap-2">
                    <Mail className="h-4 w-4" />
                    {user.email}
                  </p>
                </div>
                <div>
                  <p className="text-sm text-muted-foreground">연락처</p>
                  <p className="font-medium flex items-center gap-2">
                    <Phone className="h-4 w-4" />
                    {user.phone}
                  </p>
                </div>
                <div>
                  <p className="text-sm text-muted-foreground">가입일</p>
                  <p className="font-medium">{formatDate(user.createdAt)}</p>
                </div>
                <div>
                  <p className="text-sm text-muted-foreground">마지막 로그인</p>
                  <p className="font-medium">
                    {user.lastLoginAt ? formatDateTime(user.lastLoginAt) : "-"}
                  </p>
                </div>
              </div>
            )}
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Bell className="h-5 w-5" />
              알림 설정
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-3">
              <div className="flex items-center justify-between">
                <span className="text-sm">SMS 알림</span>
                {user.smsConsent ? (
                  <CheckCircle className="h-5 w-5 text-green-500" />
                ) : (
                  <XCircle className="h-5 w-5 text-gray-300" />
                )}
              </div>
              <div className="flex items-center justify-between">
                <span className="text-sm">이메일 알림</span>
                {user.emailConsent ? (
                  <CheckCircle className="h-5 w-5 text-green-500" />
                ) : (
                  <XCircle className="h-5 w-5 text-gray-300" />
                )}
              </div>
              <div className="flex items-center justify-between">
                <span className="text-sm">텔레그램 알림</span>
                {user.telegramEnabled ? (
                  <CheckCircle className="h-5 w-5 text-green-500" />
                ) : (
                  <XCircle className="h-5 w-5 text-gray-300" />
                )}
              </div>
              {user.telegramChatId && (
                <div className="pt-2 border-t">
                  <p className="text-xs text-muted-foreground">Chat ID</p>
                  <p className="text-sm font-mono">{user.telegramChatId}</p>
                </div>
              )}
            </div>
          </CardContent>
        </Card>

        <Card className="lg:col-span-2">
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <FileText className="h-5 w-5" />
              제출 자료
            </CardTitle>
          </CardHeader>
          <CardContent>
            {user.submission ? (
              <div className="space-y-4">
                <div className="flex items-center gap-2">
                  <Badge variant={user.submission.isComplete ? "success" : "warning"}>
                    {user.submission.isComplete ? "제출 완료" : "작성 중"}
                  </Badge>
                  {user.submission.completedAt && (
                    <span className="text-sm text-muted-foreground">
                      완료일: {formatDate(user.submission.completedAt)}
                    </span>
                  )}
                </div>
                <div className="grid grid-cols-2 gap-4 text-sm">
                  <div>
                    <p className="text-muted-foreground">브랜드명</p>
                    <p className="font-medium">{user.submission.brandName || "-"}</p>
                  </div>
                  <div>
                    <p className="text-muted-foreground">연락용 이메일</p>
                    <p className="font-medium">{user.submission.contactEmail || "-"}</p>
                  </div>
                  <div>
                    <p className="text-muted-foreground">연락용 전화</p>
                    <p className="font-medium">{user.submission.contactPhone || "-"}</p>
                  </div>
                  <div>
                    <p className="text-muted-foreground">계좌 정보</p>
                    <p className="font-medium">{user.submission.bankAccount || "-"}</p>
                  </div>
                  <div className="col-span-2">
                    <p className="text-muted-foreground">배송지 주소</p>
                    <p className="font-medium">{user.submission.deliveryAddress || "-"}</p>
                  </div>
                  <div>
                    <p className="text-muted-foreground">웹사이트 스타일</p>
                    <p className="font-medium">{user.submission.websiteStyle || "-"}</p>
                  </div>
                  <div>
                    <p className="text-muted-foreground">웹사이트 색상</p>
                    <p className="font-medium">{user.submission.websiteColor || "-"}</p>
                  </div>
                  {user.submission.businessLicense && (
                    <div>
                      <p className="text-muted-foreground">사업자등록증</p>
                      <a
                        href={user.submission.businessLicense}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="text-blue-600 hover:underline flex items-center gap-1"
                      >
                        보기 <ExternalLink className="h-3 w-3" />
                      </a>
                    </div>
                  )}
                  {user.submission.profilePhoto && (
                    <div>
                      <p className="text-muted-foreground">프로필 사진</p>
                      <a
                        href={user.submission.profilePhoto}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="text-blue-600 hover:underline flex items-center gap-1"
                      >
                        보기 <ExternalLink className="h-3 w-3" />
                      </a>
                    </div>
                  )}
                </div>
                {user.submission.additionalNote && (
                  <div className="pt-2 border-t">
                    <p className="text-muted-foreground text-sm">추가 메모</p>
                    <p className="text-sm mt-1">{user.submission.additionalNote}</p>
                  </div>
                )}
              </div>
            ) : (
              <div className="text-center py-8 text-muted-foreground">
                제출된 자료가 없습니다.
              </div>
            )}
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Clock className="h-5 w-5" />
              최근 알림
            </CardTitle>
          </CardHeader>
          <CardContent>
            {user.userNotifications.length > 0 ? (
              <div className="space-y-3">
                {user.userNotifications.slice(0, 5).map((notification) => (
                  <div key={notification.id} className="p-2 bg-gray-50 dark:bg-gray-800 rounded-lg">
                    <div className="flex items-center justify-between mb-1">
                      <Badge variant="secondary" className="text-xs">
                        {notification.type}
                      </Badge>
                      <span className="text-xs text-muted-foreground">
                        {formatDateTime(notification.sentAt)}
                      </span>
                    </div>
                    <p className="text-sm line-clamp-2">{notification.message}</p>
                  </div>
                ))}
              </div>
            ) : (
              <div className="text-center py-4 text-muted-foreground text-sm">
                알림 내역이 없습니다.
              </div>
            )}
          </CardContent>
        </Card>

        <Card className="lg:col-span-3">
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Package className="h-5 w-5" />
              워크플로우 ({user.workflows.length})
            </CardTitle>
          </CardHeader>
          <CardContent>
            {user.workflows.length > 0 ? (
              <div className="overflow-x-auto">
                <table className="w-full">
                  <thead>
                    <tr className="border-b">
                      <th className="text-left py-3 px-4 font-medium text-muted-foreground">유형</th>
                      <th className="text-left py-3 px-4 font-medium text-muted-foreground">상태</th>
                      <th className="text-left py-3 px-4 font-medium text-muted-foreground">시안</th>
                      <th className="text-left py-3 px-4 font-medium text-muted-foreground">배송정보</th>
                      <th className="text-left py-3 px-4 font-medium text-muted-foreground">수정 횟수</th>
                      <th className="text-left py-3 px-4 font-medium text-muted-foreground">생성일</th>
                      <th className="text-right py-3 px-4 font-medium text-muted-foreground">관리</th>
                    </tr>
                  </thead>
                  <tbody>
                    {user.workflows.map((workflow) => (
                      <tr key={workflow.id} className="border-b hover:bg-gray-50 dark:hover:bg-gray-800/50">
                        <td className="py-3 px-4">
                          <span className="font-medium">
                            {WORKFLOW_TYPE_LABELS[workflow.type] || workflow.type}
                          </span>
                        </td>
                        <td className="py-3 px-4">
                          <Badge
                            variant={
                              getWorkflowStatusVariant(workflow.status) as
                                | "success"
                                | "warning"
                                | "error"
                                | "info"
                                | "secondary"
                            }
                          >
                            {WORKFLOW_STATUS_LABELS[workflow.status] || workflow.status}
                          </Badge>
                        </td>
                        <td className="py-3 px-4">
                          {workflow.designUrl ? (
                            <a
                              href={workflow.designUrl}
                              target="_blank"
                              rel="noopener noreferrer"
                              className="text-blue-600 hover:underline flex items-center gap-1 text-sm"
                            >
                              시안 보기 <ExternalLink className="h-3 w-3" />
                            </a>
                          ) : (
                            <span className="text-muted-foreground">-</span>
                          )}
                        </td>
                        <td className="py-3 px-4 text-sm">
                          {workflow.courier && workflow.trackingNumber ? (
                            <span>
                              {workflow.courier}: {workflow.trackingNumber}
                            </span>
                          ) : (
                            <span className="text-muted-foreground">-</span>
                          )}
                        </td>
                        <td className="py-3 px-4">
                          {workflow.revisionCount > 0 ? (
                            <Badge variant="warning">{workflow.revisionCount}회</Badge>
                          ) : (
                            <span className="text-muted-foreground">0</span>
                          )}
                        </td>
                        <td className="py-3 px-4 text-sm text-muted-foreground">
                          {formatDate(workflow.createdAt)}
                        </td>
                        <td className="py-3 px-4 text-right">
                          <Link href={`/workflows/${workflow.id}`}>
                            <Button variant="ghost" size="sm">
                              상세
                            </Button>
                          </Link>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            ) : (
              <div className="text-center py-8 text-muted-foreground">
                진행 중인 워크플로우가 없습니다.
              </div>
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
