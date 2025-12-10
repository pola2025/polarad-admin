"use client";

import { useState, useEffect, use } from "react";
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
  Badge,
  Button,
  formatDate,
} from "@polarad/ui";
import {
  ArrowLeft,
  CheckCircle,
  XCircle,
  Clock,
  AlertCircle,
  Eye,
  User,
  Building,
  Phone,
  Mail,
  MapPin,
  Globe,
  Palette,
  FileText,
  ExternalLink,
  Loader2,
  CheckCheck,
  X,
} from "lucide-react";
import Link from "next/link";
import { useRouter } from "next/navigation";

interface Submission {
  id: string;
  userId: string;
  brandName: string | null;
  businessLicense: string | null;
  profilePhoto: string | null;
  contactEmail: string | null;
  contactPhone: string | null;
  bankAccount: string | null;
  deliveryAddress: string | null;
  websiteStyle: string | null;
  websiteColor: string | null;
  blogDesignNote: string | null;
  additionalNote: string | null;
  status: "DRAFT" | "SUBMITTED" | "IN_REVIEW" | "APPROVED" | "REJECTED";
  isComplete: boolean;
  completedAt: string | null;
  submittedAt: string | null;
  reviewedAt: string | null;
  reviewedBy: string | null;
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
    createdAt: string;
    workflows: Array<{
      id: string;
      type: string;
      status: string;
      createdAt: string;
    }>;
  };
}

export default function SubmissionDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = use(params);
  const router = useRouter();
  const [submission, setSubmission] = useState<Submission | null>(null);
  const [loading, setLoading] = useState(true);
  const [actionLoading, setActionLoading] = useState(false);

  useEffect(() => {
    fetchSubmission();
  }, [id]);

  const fetchSubmission = async () => {
    try {
      const res = await fetch(`/api/admin/submissions/${id}`);
      const data = await res.json();

      if (data.success) {
        setSubmission(data.data);
      }
    } catch (error) {
      console.error("Fetch submission error:", error);
    } finally {
      setLoading(false);
    }
  };

  const getStatusBadge = (status: Submission["status"]) => {
    const config = {
      DRAFT: { variant: "secondary" as const, label: "작성중", icon: Clock },
      SUBMITTED: { variant: "warning" as const, label: "제출됨", icon: AlertCircle },
      IN_REVIEW: { variant: "info" as const, label: "검토중", icon: Eye },
      APPROVED: { variant: "success" as const, label: "승인", icon: CheckCircle },
      REJECTED: { variant: "error" as const, label: "반려", icon: XCircle },
    };

    const { variant, label, icon: Icon } = config[status];
    return (
      <Badge variant={variant} className="flex items-center gap-1 text-sm px-3 py-1">
        <Icon className="h-4 w-4" />
        {label}
      </Badge>
    );
  };

  const handleApprove = async () => {
    if (!confirm("이 자료를 승인하시겠습니까?\n워크플로우가 자동 생성됩니다.")) return;

    setActionLoading(true);
    try {
      const res = await fetch(`/api/admin/submissions/${id}/approve`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({}),
      });

      const data = await res.json();
      if (data.success) {
        alert(`승인 완료! ${data.data.workflows.length}개의 워크플로우가 생성되었습니다.`);
        fetchSubmission();
      } else {
        alert(data.error || "승인에 실패했습니다.");
      }
    } catch (error) {
      console.error("Approve error:", error);
      alert("승인 처리 중 오류가 발생했습니다.");
    } finally {
      setActionLoading(false);
    }
  };

  const handleReject = async () => {
    const reason = prompt("반려 사유를 입력하세요:");
    if (!reason) return;

    setActionLoading(true);
    try {
      const res = await fetch(`/api/admin/submissions/${id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ status: "REJECTED", rejectionReason: reason }),
      });

      const data = await res.json();
      if (data.success) {
        alert("반려 처리되었습니다.");
        fetchSubmission();
      } else {
        alert(data.error || "반려에 실패했습니다.");
      }
    } catch (error) {
      console.error("Reject error:", error);
      alert("반려 처리 중 오류가 발생했습니다.");
    } finally {
      setActionLoading(false);
    }
  };

  const handleStartReview = async () => {
    setActionLoading(true);
    try {
      const res = await fetch(`/api/admin/submissions/${id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ status: "IN_REVIEW" }),
      });

      const data = await res.json();
      if (data.success) {
        fetchSubmission();
      } else {
        alert(data.error || "상태 변경에 실패했습니다.");
      }
    } catch (error) {
      console.error("Start review error:", error);
      alert("상태 변경 중 오류가 발생했습니다.");
    } finally {
      setActionLoading(false);
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center py-12">
        <Loader2 className="h-8 w-8 animate-spin text-blue-600" />
      </div>
    );
  }

  if (!submission) {
    return (
      <div className="text-center py-12">
        <p className="text-muted-foreground">Submission을 찾을 수 없습니다.</p>
        <Button variant="outline" onClick={() => router.back()} className="mt-4">
          뒤로 가기
        </Button>
      </div>
    );
  }

  const canAction = submission.status === "SUBMITTED" || submission.status === "IN_REVIEW";

  return (
    <div className="space-y-4 lg:space-y-6">
      {/* 헤더 */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <Button variant="ghost" size="sm" onClick={() => router.back()}>
            <ArrowLeft className="h-4 w-4" />
          </Button>
          <div>
            <h1 className="text-xl lg:text-2xl font-bold text-gray-900 dark:text-white">
              자료 제출 상세
            </h1>
            <p className="text-sm text-muted-foreground">{submission.user.clientName}</p>
          </div>
        </div>
        {getStatusBadge(submission.status)}
      </div>

      {/* 액션 버튼 */}
      {canAction && (
        <Card className="bg-yellow-50 dark:bg-yellow-900/20 border-yellow-200">
          <CardContent className="p-4">
            <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
              <div>
                <p className="font-medium text-yellow-800 dark:text-yellow-200">
                  검토가 필요합니다
                </p>
                <p className="text-sm text-yellow-700 dark:text-yellow-300">
                  자료를 확인하고 승인 또는 반려해주세요.
                </p>
              </div>
              <div className="flex gap-2">
                {submission.status === "SUBMITTED" && (
                  <Button
                    variant="outline"
                    onClick={handleStartReview}
                    disabled={actionLoading}
                  >
                    검토 시작
                  </Button>
                )}
                <Button
                  onClick={handleApprove}
                  disabled={actionLoading}
                  className="bg-green-600 hover:bg-green-700"
                >
                  {actionLoading ? (
                    <Loader2 className="h-4 w-4 animate-spin mr-2" />
                  ) : (
                    <CheckCheck className="h-4 w-4 mr-2" />
                  )}
                  승인
                </Button>
                <Button
                  variant="destructive"
                  onClick={handleReject}
                  disabled={actionLoading}
                >
                  <X className="h-4 w-4 mr-2" />
                  반려
                </Button>
              </div>
            </div>
          </CardContent>
        </Card>
      )}

      {/* 반려 사유 */}
      {submission.rejectionReason && (
        <Card className="bg-red-50 dark:bg-red-900/20 border-red-200">
          <CardContent className="p-4">
            <p className="font-medium text-red-800 dark:text-red-200 mb-1">반려 사유</p>
            <p className="text-sm text-red-700 dark:text-red-300">{submission.rejectionReason}</p>
          </CardContent>
        </Card>
      )}

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4 lg:gap-6">
        {/* 사용자 정보 */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <User className="h-5 w-5" />
              사용자 정보
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="grid grid-cols-2 gap-4">
              <div>
                <p className="text-sm text-muted-foreground">업체명</p>
                <p className="font-medium">{submission.user.clientName}</p>
              </div>
              <div>
                <p className="text-sm text-muted-foreground">담당자</p>
                <p className="font-medium">{submission.user.name}</p>
              </div>
              <div>
                <p className="text-sm text-muted-foreground flex items-center gap-1">
                  <Mail className="h-3 w-3" /> 이메일
                </p>
                <p className="font-medium text-sm">{submission.user.email}</p>
              </div>
              <div>
                <p className="text-sm text-muted-foreground flex items-center gap-1">
                  <Phone className="h-3 w-3" /> 연락처
                </p>
                <p className="font-medium">{submission.user.phone}</p>
              </div>
            </div>
            <div className="pt-2 border-t">
              <p className="text-sm text-muted-foreground">가입일</p>
              <p className="font-medium">{formatDate(submission.user.createdAt)}</p>
            </div>
            <Link href={`/users/${submission.user.id}`}>
              <Button variant="outline" size="sm" className="w-full">
                <ExternalLink className="h-4 w-4 mr-2" />
                사용자 상세 보기
              </Button>
            </Link>
          </CardContent>
        </Card>

        {/* 브랜드 정보 */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Building className="h-5 w-5" />
              브랜드 정보
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div>
              <p className="text-sm text-muted-foreground">브랜드명</p>
              <p className="font-medium">{submission.brandName || "-"}</p>
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div>
                <p className="text-sm text-muted-foreground flex items-center gap-1">
                  <Mail className="h-3 w-3" /> 연락 이메일
                </p>
                <p className="font-medium text-sm">{submission.contactEmail || "-"}</p>
              </div>
              <div>
                <p className="text-sm text-muted-foreground flex items-center gap-1">
                  <Phone className="h-3 w-3" /> 연락처
                </p>
                <p className="font-medium">{submission.contactPhone || "-"}</p>
              </div>
            </div>
            <div>
              <p className="text-sm text-muted-foreground">은행 계좌</p>
              <p className="font-medium">{submission.bankAccount || "-"}</p>
            </div>
            <div>
              <p className="text-sm text-muted-foreground flex items-center gap-1">
                <MapPin className="h-3 w-3" /> 배송 주소
              </p>
              <p className="font-medium">{submission.deliveryAddress || "-"}</p>
            </div>
          </CardContent>
        </Card>

        {/* 홈페이지 정보 */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Globe className="h-5 w-5" />
              홈페이지 정보
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div>
              <p className="text-sm text-muted-foreground flex items-center gap-1">
                <Palette className="h-3 w-3" /> 스타일
              </p>
              <p className="font-medium">{submission.websiteStyle || "-"}</p>
            </div>
            <div>
              <p className="text-sm text-muted-foreground flex items-center gap-1">
                <Palette className="h-3 w-3" /> 컬러
              </p>
              <p className="font-medium">{submission.websiteColor || "-"}</p>
            </div>
            <div>
              <p className="text-sm text-muted-foreground">블로그 디자인 노트</p>
              <p className="font-medium whitespace-pre-wrap">{submission.blogDesignNote || "-"}</p>
            </div>
          </CardContent>
        </Card>

        {/* 첨부 파일 및 추가 정보 */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <FileText className="h-5 w-5" />
              첨부 파일 및 추가 정보
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div>
              <p className="text-sm text-muted-foreground mb-2">사업자등록증</p>
              {submission.businessLicense ? (
                <a
                  href={submission.businessLicense}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="text-blue-600 hover:underline flex items-center gap-1"
                >
                  <ExternalLink className="h-4 w-4" />
                  파일 보기
                </a>
              ) : (
                <p className="text-muted-foreground">-</p>
              )}
            </div>
            <div>
              <p className="text-sm text-muted-foreground mb-2">프로필 사진</p>
              {submission.profilePhoto ? (
                <a
                  href={submission.profilePhoto}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="text-blue-600 hover:underline flex items-center gap-1"
                >
                  <ExternalLink className="h-4 w-4" />
                  파일 보기
                </a>
              ) : (
                <p className="text-muted-foreground">-</p>
              )}
            </div>
            <div>
              <p className="text-sm text-muted-foreground">추가 요청사항</p>
              <p className="font-medium whitespace-pre-wrap">{submission.additionalNote || "-"}</p>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* 워크플로우 목록 */}
      {submission.user.workflows.length > 0 && (
        <Card>
          <CardHeader>
            <CardTitle>생성된 워크플로우</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
              {submission.user.workflows.map((wf) => (
                <Link key={wf.id} href={`/workflows/${wf.id}`}>
                  <div className="p-3 border rounded-lg hover:bg-gray-50 dark:hover:bg-gray-800 transition-colors">
                    <p className="font-medium text-sm">{wf.type}</p>
                    <p className="text-xs text-muted-foreground">{wf.status}</p>
                  </div>
                </Link>
              ))}
            </div>
          </CardContent>
        </Card>
      )}

      {/* 타임라인 */}
      <Card>
        <CardHeader>
          <CardTitle>처리 이력</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="space-y-4">
            <div className="flex items-start gap-3">
              <div className="w-2 h-2 rounded-full bg-gray-400 mt-2" />
              <div>
                <p className="font-medium">생성됨</p>
                <p className="text-sm text-muted-foreground">{formatDate(submission.createdAt)}</p>
              </div>
            </div>
            {submission.submittedAt && (
              <div className="flex items-start gap-3">
                <div className="w-2 h-2 rounded-full bg-yellow-500 mt-2" />
                <div>
                  <p className="font-medium">제출됨</p>
                  <p className="text-sm text-muted-foreground">{formatDate(submission.submittedAt)}</p>
                </div>
              </div>
            )}
            {submission.reviewedAt && (
              <div className="flex items-start gap-3">
                <div className={`w-2 h-2 rounded-full mt-2 ${
                  submission.status === "APPROVED" ? "bg-green-500" : "bg-red-500"
                }`} />
                <div>
                  <p className="font-medium">
                    {submission.status === "APPROVED" ? "승인됨" : "반려됨"}
                  </p>
                  <p className="text-sm text-muted-foreground">{formatDate(submission.reviewedAt)}</p>
                </div>
              </div>
            )}
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
