"use client";

import { useState, useEffect, useCallback } from "react";
import { useParams, useRouter } from "next/navigation";
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
  ArrowLeft,
  Loader2,
  ExternalLink,
  Send,
  Upload,
  CheckCircle,
  Clock,
  Eye,
  RefreshCw,
  MessageSquare,
  Bell,
  User,
  UserCog,
} from "lucide-react";
import Link from "next/link";

interface DesignFeedback {
  id: string;
  versionId: string;
  authorId: string;
  authorType: "user" | "admin";
  authorName: string;
  content: string;
  createdAt: string;
}

interface DesignVersion {
  id: string;
  designId: string;
  version: number;
  url: string;
  note: string | null;
  uploadedBy: string;
  createdAt: string;
  feedbacks: DesignFeedback[];
}

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
  versions: DesignVersion[];
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

export default function DesignDetailPage() {
  const params = useParams();
  const router = useRouter();
  const id = params.id as string;

  const [design, setDesign] = useState<Design | null>(null);
  const [loading, setLoading] = useState(true);
  const [actionLoading, setActionLoading] = useState(false);

  // 새 버전 업로드
  const [newVersionUrl, setNewVersionUrl] = useState("");
  const [newVersionNote, setNewVersionNote] = useState("");
  const [uploadLoading, setUploadLoading] = useState(false);

  // 피드백
  const [feedbackContent, setFeedbackContent] = useState("");
  const [feedbackLoading, setFeedbackLoading] = useState(false);

  const fetchDesign = useCallback(async () => {
    setLoading(true);
    try {
      const res = await fetch(`/api/admin/designs/${id}`);
      const data = await res.json();

      if (data.success) {
        setDesign(data.data);
      } else {
        alert(data.error || "시안을 불러올 수 없습니다.");
        router.push("/designs");
      }
    } catch (error) {
      console.error("Fetch design error:", error);
      alert("시안을 불러오는 중 오류가 발생했습니다.");
      router.push("/designs");
    } finally {
      setLoading(false);
    }
  }, [id, router]);

  useEffect(() => {
    if (id) {
      fetchDesign();
    }
  }, [id, fetchDesign]);

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

  const handleStatusChange = async (newStatus: Design["status"], sendNotification = false) => {
    if (!design) return;

    const confirmMessage = {
      DRAFT: "임시저장 상태로 변경하시겠습니까?",
      PENDING_REVIEW: sendNotification
        ? "확인요청 상태로 변경하고 고객에게 알림을 발송하시겠습니까?"
        : "확인요청 상태로 변경하시겠습니까?",
      REVISION_REQUESTED: "수정요청 상태로 변경하시겠습니까?",
      APPROVED: "시안을 확정 처리하시겠습니까?",
    };

    if (!confirm(confirmMessage[newStatus])) return;

    setActionLoading(true);
    try {
      const res = await fetch(`/api/admin/designs/${id}/status`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ status: newStatus, sendNotification }),
      });

      const data = await res.json();
      if (data.success) {
        await fetchDesign();
        alert("상태가 변경되었습니다.");
      } else {
        alert(data.error || "상태 변경에 실패했습니다.");
      }
    } catch (error) {
      console.error("Status change error:", error);
      alert("상태 변경 중 오류가 발생했습니다.");
    } finally {
      setActionLoading(false);
    }
  };

  const handleUploadVersion = async () => {
    if (!newVersionUrl.trim()) {
      alert("시안 URL을 입력해주세요.");
      return;
    }

    setUploadLoading(true);
    try {
      const res = await fetch(`/api/admin/designs/${id}/versions`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          url: newVersionUrl,
          note: newVersionNote || undefined,
        }),
      });

      const data = await res.json();
      if (data.success) {
        setNewVersionUrl("");
        setNewVersionNote("");
        await fetchDesign();
        alert("새 버전이 업로드되었습니다.");
      } else {
        alert(data.error || "버전 업로드에 실패했습니다.");
      }
    } catch (error) {
      console.error("Upload version error:", error);
      alert("버전 업로드 중 오류가 발생했습니다.");
    } finally {
      setUploadLoading(false);
    }
  };

  const handleSendFeedback = async () => {
    if (!feedbackContent.trim()) {
      alert("피드백 내용을 입력해주세요.");
      return;
    }

    setFeedbackLoading(true);
    try {
      const res = await fetch(`/api/admin/designs/${id}/feedback`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ content: feedbackContent }),
      });

      const data = await res.json();
      if (data.success) {
        setFeedbackContent("");
        await fetchDesign();
        alert("피드백이 전송되었습니다.");
      } else {
        alert(data.error || "피드백 전송에 실패했습니다.");
      }
    } catch (error) {
      console.error("Send feedback error:", error);
      alert("피드백 전송 중 오류가 발생했습니다.");
    } finally {
      setFeedbackLoading(false);
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-[400px]">
        <Loader2 className="h-8 w-8 animate-spin text-blue-600" />
      </div>
    );
  }

  if (!design) {
    return (
      <div className="text-center py-12">
        <p className="text-muted-foreground">시안을 찾을 수 없습니다.</p>
        <Link href="/designs">
          <Button variant="outline" className="mt-4">
            목록으로 돌아가기
          </Button>
        </Link>
      </div>
    );
  }

  const currentVersion = design.versions[0];
  const typeKorean = WORKFLOW_TYPE_KOREAN[design.workflow.type] || design.workflow.type;

  return (
    <div className="space-y-6">
      {/* 헤더 */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-4">
          <Link href="/designs">
            <Button variant="ghost" size="sm">
              <ArrowLeft className="h-4 w-4 mr-1" />
              목록
            </Button>
          </Link>
          <div>
            <div className="flex items-center gap-2">
              <h1 className="text-xl lg:text-2xl font-bold text-gray-900 dark:text-white">
                {design.workflow.user.clientName} · {typeKorean}
              </h1>
              {getStatusBadge(design.status)}
            </div>
            <p className="text-sm text-muted-foreground mt-1">
              담당자: {design.workflow.user.name} ({design.workflow.user.phone})
            </p>
          </div>
        </div>
      </div>

      <div className="grid lg:grid-cols-2 gap-6">
        {/* 좌측: 현재 시안 + 새 버전 업로드 */}
        <div className="space-y-4">
          {/* 현재 시안 */}
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center justify-between">
                <span>현재 시안 (v{design.currentVersion})</span>
                {design.approvedVersion && (
                  <Badge variant="success">
                    확정: v{design.approvedVersion}
                  </Badge>
                )}
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              {currentVersion ? (
                <>
                  <div className="bg-gray-50 dark:bg-gray-800 rounded-lg p-4 flex flex-col items-center gap-4">
                    <a
                      href={currentVersion.url}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="flex items-center gap-2 text-blue-600 hover:text-blue-800"
                    >
                      <ExternalLink className="h-5 w-5" />
                      시안 보기 (새 탭에서 열기)
                    </a>
                    <p className="text-sm text-muted-foreground text-center">
                      {currentVersion.note || `v${currentVersion.version} 시안`}
                    </p>
                  </div>

                  <div className="flex flex-wrap gap-2">
                    {design.status === "DRAFT" && (
                      <>
                        <Button
                          size="sm"
                          onClick={() => handleStatusChange("PENDING_REVIEW", true)}
                          disabled={actionLoading}
                        >
                          {actionLoading ? <Loader2 className="h-4 w-4 animate-spin" /> : <Bell className="h-4 w-4 mr-1" />}
                          확인요청 + 알림 발송
                        </Button>
                        <Button
                          size="sm"
                          variant="outline"
                          onClick={() => handleStatusChange("PENDING_REVIEW", false)}
                          disabled={actionLoading}
                        >
                          확인요청 (알림 없이)
                        </Button>
                      </>
                    )}
                    {(design.status === "PENDING_REVIEW" || design.status === "REVISION_REQUESTED") && (
                      <Button
                        size="sm"
                        variant="outline"
                        onClick={() => handleStatusChange("DRAFT")}
                        disabled={actionLoading}
                      >
                        임시저장으로 변경
                      </Button>
                    )}
                  </div>
                </>
              ) : (
                <p className="text-muted-foreground">시안 버전이 없습니다.</p>
              )}
            </CardContent>
          </Card>

          {/* 새 버전 업로드 */}
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Upload className="h-5 w-5" />
                새 버전 업로드
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div>
                <label className="block text-sm font-medium mb-1">시안 URL</label>
                <Input
                  value={newVersionUrl}
                  onChange={(e) => setNewVersionUrl(e.target.value)}
                  placeholder="https://drive.google.com/..."
                />
              </div>
              <div>
                <label className="block text-sm font-medium mb-1">메모 (선택)</label>
                <Input
                  value={newVersionNote}
                  onChange={(e) => setNewVersionNote(e.target.value)}
                  placeholder="변경사항 메모"
                />
              </div>
              <Button
                onClick={handleUploadVersion}
                disabled={uploadLoading || !newVersionUrl.trim()}
                className="w-full"
              >
                {uploadLoading ? (
                  <Loader2 className="h-4 w-4 animate-spin mr-1" />
                ) : (
                  <Upload className="h-4 w-4 mr-1" />
                )}
                v{design.currentVersion + 1} 업로드
              </Button>
            </CardContent>
          </Card>
        </div>

        {/* 우측: 버전 히스토리 + 피드백 */}
        <div className="space-y-4">
          {/* 버전 히스토리 */}
          <Card>
            <CardHeader>
              <CardTitle>📜 버전 히스토리</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="space-y-3">
                {design.versions.map((version, index) => (
                  <div
                    key={version.id}
                    className={`p-3 rounded-lg ${
                      index === 0
                        ? "bg-blue-50 dark:bg-blue-900/20 border border-blue-200 dark:border-blue-800"
                        : "bg-gray-50 dark:bg-gray-800"
                    }`}
                  >
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-2">
                        <span className="font-medium">
                          v{version.version}
                          {index === 0 && (
                            <span className="text-xs text-blue-600 ml-1">(현재)</span>
                          )}
                        </span>
                        {design.approvedVersion === version.version && (
                          <Badge variant="success" className="text-xs">확정</Badge>
                        )}
                      </div>
                      <span className="text-xs text-muted-foreground">
                        {formatDate(version.createdAt)}
                      </span>
                    </div>
                    <p className="text-sm text-muted-foreground mt-1">
                      {version.note || "메모 없음"}
                    </p>
                    <a
                      href={version.url}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="text-xs text-blue-600 hover:underline flex items-center gap-1 mt-1"
                    >
                      <ExternalLink className="h-3 w-3" />
                      시안 보기
                    </a>
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>

          {/* 피드백 */}
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <MessageSquare className="h-5 w-5" />
                피드백
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              {/* 피드백 목록 */}
              <div className="space-y-3 max-h-[300px] overflow-y-auto">
                {design.versions.map((version) =>
                  version.feedbacks.map((feedback) => (
                    <div
                      key={feedback.id}
                      className={`p-3 rounded-lg ${
                        feedback.authorType === "user"
                          ? "bg-yellow-50 dark:bg-yellow-900/20 border-l-4 border-yellow-400"
                          : "bg-blue-50 dark:bg-blue-900/20 border-l-4 border-blue-400"
                      }`}
                    >
                      <div className="flex items-center gap-2 mb-1">
                        {feedback.authorType === "user" ? (
                          <User className="h-4 w-4 text-yellow-600" />
                        ) : (
                          <UserCog className="h-4 w-4 text-blue-600" />
                        )}
                        <span className="text-sm font-medium">
                          {feedback.authorName}
                          <span className="text-xs text-muted-foreground ml-1">
                            ({feedback.authorType === "user" ? "고객" : "관리자"})
                          </span>
                        </span>
                        <span className="text-xs text-muted-foreground ml-auto">
                          v{version.version} · {formatDate(feedback.createdAt)}
                        </span>
                      </div>
                      <p className="text-sm">{feedback.content}</p>
                    </div>
                  ))
                )}
                {design.versions.every((v) => v.feedbacks.length === 0) && (
                  <p className="text-center text-muted-foreground text-sm py-4">
                    아직 피드백이 없습니다.
                  </p>
                )}
              </div>

              {/* 피드백 입력 */}
              <div className="border-t pt-4">
                <div className="flex gap-2">
                  <Input
                    value={feedbackContent}
                    onChange={(e) => setFeedbackContent(e.target.value)}
                    placeholder="피드백을 입력하세요..."
                    className="flex-1"
                  />
                  <Button
                    onClick={handleSendFeedback}
                    disabled={feedbackLoading || !feedbackContent.trim()}
                  >
                    {feedbackLoading ? (
                      <Loader2 className="h-4 w-4 animate-spin" />
                    ) : (
                      <Send className="h-4 w-4" />
                    )}
                  </Button>
                </div>
                <p className="text-xs text-muted-foreground mt-1">
                  피드백 작성 시 고객에게 Telegram 알림이 발송됩니다.
                </p>
              </div>
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  );
}
