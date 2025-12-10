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
  formatDateTime,
} from "@polarad/ui";
import {
  ArrowLeft,
  Package,
  User,
  Clock,
  CheckCircle,
  Truck,
  FileImage,
  Send,
  Upload,
  Save,
  Loader2,
  ExternalLink,
  AlertCircle,
} from "lucide-react";
import Link from "next/link";

interface WorkflowLog {
  id: string;
  fromStatus: string | null;
  toStatus: string;
  changedBy: string | null;
  note: string | null;
  createdAt: string;
}

interface WorkflowUser {
  id: string;
  clientName: string;
  name: string;
  email: string;
  phone: string;
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
  revisionNote: string | null;
  adminNote: string | null;
  submittedAt: string | null;
  designStartedAt: string | null;
  designUploadedAt: string | null;
  orderRequestedAt: string | null;
  orderApprovedAt: string | null;
  completedAt: string | null;
  shippedAt: string | null;
  createdAt: string;
  updatedAt: string;
  user: WorkflowUser;
  logs: WorkflowLog[];
}

const WORKFLOW_TYPE_LABELS: Record<string, string> = {
  NAMECARD: "명함",
  NAMETAG: "명찰",
  CONTRACT: "계약서",
  ENVELOPE: "대봉투",
  WEBSITE: "홈페이지",
  BLOG: "블로그",
  META_ADS: "메타 광고",
  NAVER_ADS: "네이버 광고",
};

const WORKFLOW_STATUS_LABELS: Record<string, string> = {
  PENDING: "대기",
  SUBMITTED: "자료제출",
  IN_PROGRESS: "진행중",
  DESIGN_UPLOADED: "시안완료",
  ORDER_REQUESTED: "발주요청",
  ORDER_APPROVED: "발주승인",
  COMPLETED: "제작완료",
  SHIPPED: "발송완료",
  CANCELLED: "취소",
};

const WORKFLOW_STEPS = [
  { status: "PENDING", label: "대기" },
  { status: "SUBMITTED", label: "자료제출" },
  { status: "IN_PROGRESS", label: "디자인" },
  { status: "DESIGN_UPLOADED", label: "시안완료" },
  { status: "ORDER_REQUESTED", label: "발주요청" },
  { status: "ORDER_APPROVED", label: "발주승인" },
  { status: "COMPLETED", label: "제작완료" },
  { status: "SHIPPED", label: "발송완료" },
];

const COURIER_OPTIONS = ["CJ대한통운", "한진택배", "롯데택배", "우체국택배", "로젠택배"];

function getStatusIndex(status: string): number {
  return WORKFLOW_STEPS.findIndex((step) => step.status === status);
}

export default function WorkflowDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = use(params);
  const [workflow, setWorkflow] = useState<Workflow | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

  const [designUrl, setDesignUrl] = useState("");
  const [finalUrl, setFinalUrl] = useState("");
  const [courier, setCourier] = useState("");
  const [trackingNumber, setTrackingNumber] = useState("");
  const [adminNote, setAdminNote] = useState("");

  useEffect(() => {
    fetchWorkflow();
  }, [id]);

  const fetchWorkflow = async () => {
    setLoading(true);
    try {
      const res = await fetch(`/api/workflows/${id}`);
      const data = await res.json();

      if (data.success) {
        setWorkflow(data.data);
        setDesignUrl(data.data.designUrl || "");
        setFinalUrl(data.data.finalUrl || "");
        setCourier(data.data.courier || "");
        setTrackingNumber(data.data.trackingNumber || "");
        setAdminNote(data.data.adminNote || "");
      }
    } catch (error) {
      console.error("Fetch workflow error:", error);
    } finally {
      setLoading(false);
    }
  };

  const handleStatusChange = async (newStatus: string) => {
    if (!confirm(`상태를 "${WORKFLOW_STATUS_LABELS[newStatus]}"(으)로 변경하시겠습니까?`)) {
      return;
    }

    setSaving(true);
    try {
      const res = await fetch(`/api/workflows/${id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ status: newStatus, changedBy: "admin" }),
      });
      const data = await res.json();

      if (data.success) {
        alert("상태가 변경되었습니다.");
        fetchWorkflow();
      } else {
        alert(data.error || "상태 변경에 실패했습니다.");
      }
    } catch (error) {
      console.error("Status change error:", error);
      alert("상태 변경 중 오류가 발생했습니다.");
    } finally {
      setSaving(false);
    }
  };

  const handleSaveDetails = async () => {
    setSaving(true);
    try {
      const res = await fetch(`/api/workflows/${id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          designUrl: designUrl || null,
          finalUrl: finalUrl || null,
          courier: courier || null,
          trackingNumber: trackingNumber || null,
          adminNote: adminNote || null,
          changedBy: "admin",
        }),
      });
      const data = await res.json();

      if (data.success) {
        alert("저장되었습니다.");
        fetchWorkflow();
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

  const handleUploadDesign = async () => {
    if (!designUrl.trim()) {
      alert("시안 URL을 입력해주세요.");
      return;
    }

    setSaving(true);
    try {
      const res = await fetch(`/api/workflows/${id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ status: "DESIGN_UPLOADED", designUrl, changedBy: "admin" }),
      });
      const data = await res.json();

      if (data.success) {
        alert("시안이 업로드되었습니다.");
        fetchWorkflow();
      } else {
        alert(data.error || "시안 업로드에 실패했습니다.");
      }
    } catch (error) {
      console.error("Upload design error:", error);
      alert("시안 업로드 중 오류가 발생했습니다.");
    } finally {
      setSaving(false);
    }
  };

  const handleApproveOrder = async () => {
    if (!confirm("발주를 승인하시겠습니까?")) return;

    setSaving(true);
    try {
      const res = await fetch(`/api/workflows/${id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ status: "ORDER_APPROVED", changedBy: "admin" }),
      });
      const data = await res.json();

      if (data.success) {
        alert("발주가 승인되었습니다.");
        fetchWorkflow();
      } else {
        alert(data.error || "발주 승인에 실패했습니다.");
      }
    } catch (error) {
      console.error("Approve order error:", error);
      alert("발주 승인 중 오류가 발생했습니다.");
    } finally {
      setSaving(false);
    }
  };

  const handleShipped = async () => {
    if (!courier || !trackingNumber) {
      alert("택배사와 운송장번호를 입력해주세요.");
      return;
    }

    if (!confirm("배송 정보를 저장하고 발송완료 처리하시겠습니까?")) return;

    setSaving(true);
    try {
      const res = await fetch(`/api/workflows/${id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ status: "SHIPPED", courier, trackingNumber, changedBy: "admin" }),
      });
      const data = await res.json();

      if (data.success) {
        alert("발송완료 처리되었습니다.");
        fetchWorkflow();
      } else {
        alert(data.error || "처리에 실패했습니다.");
      }
    } catch (error) {
      console.error("Shipped error:", error);
      alert("처리 중 오류가 발생했습니다.");
    } finally {
      setSaving(false);
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-[400px]">
        <Loader2 className="h-8 w-8 animate-spin text-blue-600" />
      </div>
    );
  }

  if (!workflow) {
    return (
      <div className="text-center py-12">
        <p className="text-muted-foreground">워크플로우를 찾을 수 없습니다.</p>
        <Link href="/workflows">
          <Button variant="outline" className="mt-4">
            목록으로 돌아가기
          </Button>
        </Link>
      </div>
    );
  }

  const currentStepIndex = getStatusIndex(workflow.status);

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-4">
          <Link href="/workflows">
            <Button variant="ghost" size="sm">
              <ArrowLeft className="h-4 w-4 mr-2" />
              목록으로
            </Button>
          </Link>
          <div>
            <h1 className="text-2xl font-bold text-gray-900 dark:text-white">
              {WORKFLOW_TYPE_LABELS[workflow.type] || workflow.type}
            </h1>
            <p className="text-sm text-muted-foreground">
              {workflow.user.clientName} • {workflow.user.name}
            </p>
          </div>
          <Badge
            variant={
              workflow.status === "COMPLETED" || workflow.status === "SHIPPED"
                ? "success"
                : workflow.status === "CANCELLED"
                ? "error"
                : "info"
            }
          >
            {WORKFLOW_STATUS_LABELS[workflow.status]}
          </Badge>
        </div>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>진행 단계</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="flex items-center justify-between overflow-x-auto pb-2">
            {WORKFLOW_STEPS.map((step, index) => {
              const isCompleted = index <= currentStepIndex;
              const isCurrent = index === currentStepIndex;

              return (
                <div key={step.status} className="flex items-center">
                  <button
                    onClick={() => handleStatusChange(step.status)}
                    disabled={saving}
                    className="flex flex-col items-center min-w-[80px] group cursor-pointer"
                  >
                    <div
                      className={`w-10 h-10 rounded-full flex items-center justify-center transition-all group-hover:scale-110 ${
                        isCurrent
                          ? "bg-blue-600 text-white ring-4 ring-blue-100"
                          : isCompleted
                          ? "bg-green-500 text-white"
                          : "bg-gray-200 dark:bg-gray-700 text-gray-400 group-hover:bg-gray-300"
                      }`}
                    >
                      {isCompleted && !isCurrent ? (
                        <CheckCircle className="w-5 h-5" />
                      ) : (
                        <span className="text-sm font-medium">{index + 1}</span>
                      )}
                    </div>
                    <span
                      className={`text-xs mt-2 ${
                        isCurrent
                          ? "text-blue-600 font-medium"
                          : isCompleted
                          ? "text-green-600"
                          : "text-gray-400"
                      }`}
                    >
                      {step.label}
                    </span>
                  </button>
                  {index < WORKFLOW_STEPS.length - 1 && (
                    <div
                      className={`w-full h-0.5 mx-2 min-w-[20px] ${
                        index < currentStepIndex ? "bg-green-500" : "bg-gray-200 dark:bg-gray-700"
                      }`}
                    />
                  )}
                </div>
              );
            })}
          </div>
        </CardContent>
      </Card>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <User className="h-5 w-5" />
              고객 정보
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-3">
              <div>
                <p className="text-sm text-muted-foreground">업체명</p>
                <p className="font-medium">{workflow.user.clientName}</p>
              </div>
              <div>
                <p className="text-sm text-muted-foreground">담당자</p>
                <p className="font-medium">{workflow.user.name}</p>
              </div>
              <div>
                <p className="text-sm text-muted-foreground">연락처</p>
                <p className="font-medium">{workflow.user.phone}</p>
              </div>
              <div>
                <p className="text-sm text-muted-foreground">이메일</p>
                <p className="font-medium">{workflow.user.email}</p>
              </div>
              <div className="pt-2">
                <Link href={`/users/${workflow.user.id}`}>
                  <Button variant="outline" size="sm">
                    고객 상세 보기
                  </Button>
                </Link>
              </div>
            </div>
          </CardContent>
        </Card>

        {workflow.revisionNote && (
          <Card className="border-orange-200 bg-orange-50 dark:bg-orange-900/10">
            <CardHeader>
              <CardTitle className="flex items-center gap-2 text-orange-700 dark:text-orange-400">
                <AlertCircle className="h-5 w-5" />
                고객 수정 요청 ({workflow.revisionCount}회)
              </CardTitle>
            </CardHeader>
            <CardContent>
              <p className="text-gray-700 dark:text-gray-300 whitespace-pre-wrap">
                {workflow.revisionNote}
              </p>
            </CardContent>
          </Card>
        )}

        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <FileImage className="h-5 w-5" />
              시안 관리
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-4">
              <div>
                <Label htmlFor="designUrl">시안 URL</Label>
                <div className="flex gap-2 mt-1">
                  <Input
                    id="designUrl"
                    value={designUrl}
                    onChange={(e) => setDesignUrl(e.target.value)}
                    placeholder="https://drive.google.com/... 또는 Dropbox 링크"
                  />
                  {designUrl && (
                    <a href={designUrl} target="_blank" rel="noopener noreferrer">
                      <Button variant="outline" size="icon">
                        <ExternalLink className="h-4 w-4" />
                      </Button>
                    </a>
                  )}
                </div>
              </div>

              {workflow.status === "IN_PROGRESS" && (
                <Button
                  onClick={handleUploadDesign}
                  disabled={saving || !designUrl}
                  className="w-full"
                >
                  {saving ? (
                    <Loader2 className="h-4 w-4 animate-spin mr-2" />
                  ) : (
                    <Upload className="h-4 w-4 mr-2" />
                  )}
                  시안 업로드 및 고객 확인 요청
                </Button>
              )}

              {workflow.designUploadedAt && (
                <p className="text-sm text-muted-foreground">
                  업로드: {formatDateTime(workflow.designUploadedAt)}
                </p>
              )}
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Package className="h-5 w-5" />
              발주 관리
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-4">
              {workflow.status === "ORDER_REQUESTED" && (
                <div className="p-3 bg-yellow-50 dark:bg-yellow-900/20 rounded-lg">
                  <p className="text-sm text-yellow-800 dark:text-yellow-200">
                    고객이 시안을 승인하고 발주를 요청했습니다.
                  </p>
                  <Button
                    onClick={handleApproveOrder}
                    disabled={saving}
                    className="mt-2"
                    variant="default"
                  >
                    {saving ? (
                      <Loader2 className="h-4 w-4 animate-spin mr-2" />
                    ) : (
                      <CheckCircle className="h-4 w-4 mr-2" />
                    )}
                    발주 승인
                  </Button>
                </div>
              )}

              {workflow.orderRequestedAt && (
                <p className="text-sm text-muted-foreground">
                  발주요청: {formatDateTime(workflow.orderRequestedAt)}
                </p>
              )}
              {workflow.orderApprovedAt && (
                <p className="text-sm text-muted-foreground">
                  발주승인: {formatDateTime(workflow.orderApprovedAt)}
                </p>
              )}
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Truck className="h-5 w-5" />
              배송 정보
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-4">
              <div>
                <Label htmlFor="courier">택배사</Label>
                <select
                  id="courier"
                  value={courier}
                  onChange={(e) => setCourier(e.target.value)}
                  className="w-full mt-1 px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-800"
                >
                  <option value="">선택해주세요</option>
                  {COURIER_OPTIONS.map((c) => (
                    <option key={c} value={c}>
                      {c}
                    </option>
                  ))}
                </select>
              </div>
              <div>
                <Label htmlFor="trackingNumber">운송장번호</Label>
                <Input
                  id="trackingNumber"
                  value={trackingNumber}
                  onChange={(e) => setTrackingNumber(e.target.value)}
                  placeholder="운송장번호 입력"
                  className="mt-1"
                />
              </div>

              {(workflow.status === "COMPLETED" || workflow.status === "ORDER_APPROVED") && (
                <Button
                  onClick={handleShipped}
                  disabled={saving || !courier || !trackingNumber}
                  className="w-full"
                >
                  {saving ? (
                    <Loader2 className="h-4 w-4 animate-spin mr-2" />
                  ) : (
                    <Send className="h-4 w-4 mr-2" />
                  )}
                  발송완료 처리
                </Button>
              )}

              {workflow.shippedAt && (
                <p className="text-sm text-muted-foreground">
                  발송: {formatDateTime(workflow.shippedAt)}
                </p>
              )}
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>관리자 메모</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-4">
              <textarea
                value={adminNote}
                onChange={(e) => setAdminNote(e.target.value)}
                placeholder="고객에게 안내할 내용이나 내부 메모를 입력하세요"
                rows={4}
                className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 resize-none"
              />
              <Button onClick={handleSaveDetails} disabled={saving}>
                {saving ? (
                  <Loader2 className="h-4 w-4 animate-spin mr-2" />
                ) : (
                  <Save className="h-4 w-4 mr-2" />
                )}
                메모 저장
              </Button>
            </div>
          </CardContent>
        </Card>

        <Card className="lg:col-span-2">
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Clock className="h-5 w-5" />
              진행 이력
            </CardTitle>
          </CardHeader>
          <CardContent>
            {workflow.logs.length > 0 ? (
              <div className="space-y-3">
                {workflow.logs.map((log) => (
                  <div
                    key={log.id}
                    className="flex items-start gap-3 p-3 bg-gray-50 dark:bg-gray-800 rounded-lg"
                  >
                    <div className="w-2 h-2 rounded-full bg-blue-500 mt-2 flex-shrink-0" />
                    <div className="flex-1">
                      <div className="flex items-center gap-2">
                        {log.fromStatus && (
                          <>
                            <Badge variant="secondary" className="text-xs">
                              {WORKFLOW_STATUS_LABELS[log.fromStatus]}
                            </Badge>
                            <span className="text-gray-400">→</span>
                          </>
                        )}
                        <Badge variant="info" className="text-xs">
                          {WORKFLOW_STATUS_LABELS[log.toStatus]}
                        </Badge>
                      </div>
                      {log.note && (
                        <p className="text-sm text-gray-600 dark:text-gray-400 mt-1">{log.note}</p>
                      )}
                      <p className="text-xs text-muted-foreground mt-1">
                        {formatDateTime(log.createdAt)}
                        {log.changedBy && ` • ${log.changedBy}`}
                      </p>
                    </div>
                  </div>
                ))}
              </div>
            ) : (
              <p className="text-center py-4 text-muted-foreground">진행 이력이 없습니다.</p>
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
