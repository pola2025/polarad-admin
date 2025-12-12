"use client";

import { useState, useEffect, useCallback, use } from "react";
import { useRouter } from "next/navigation";
import { Card, CardContent, CardHeader, CardTitle, Badge, formatDate } from "@polarad/ui";
import {
  ArrowLeft,
  Building,
  User,
  Package,
  Phone,
  Mail,
  MapPin,
  FileText,
  CheckCircle,
  XCircle,
  Download,
  Clock,
  Loader2,
  History,
} from "lucide-react";

interface ContractDetail {
  id: string;
  contractNumber: string;
  companyName: string;
  ceoName: string;
  businessNumber: string;
  address: string;
  contactName: string;
  contactEmail: string;
  contactPhone: string;
  status: string;
  monthlyFee: number;
  setupFee: number;
  contractPeriod: number;
  totalAmount: number;
  startDate: string | null;
  endDate: string | null;
  additionalNotes: string | null;
  clientSignature: string | null;
  signedAt: string | null;
  createdAt: string;
  approvedAt: string | null;
  approvedBy: string | null;
  rejectedAt: string | null;
  rejectReason: string | null;
  emailSentAt: string | null;
  package: {
    id: string;
    name: string;
    displayName: string;
    price: number;
    description: string;
    features: string[];
  };
  user: {
    id: string;
    name: string;
    email: string;
    phone: string;
    clientName: string;
    telegramChatId: string | null;
    telegramEnabled: boolean;
  };
  logs: Array<{
    id: string;
    fromStatus: string | null;
    toStatus: string;
    changedBy: string | null;
    note: string | null;
    createdAt: string;
  }>;
}

const STATUS_LABELS: Record<string, string> = {
  PENDING: "대기",
  SUBMITTED: "승인 대기",
  APPROVED: "승인됨",
  REJECTED: "거절됨",
  ACTIVE: "진행중",
  EXPIRED: "만료",
  CANCELLED: "취소",
};

const STATUS_COLORS: Record<string, "secondary" | "info" | "success" | "warning" | "error"> = {
  PENDING: "secondary",
  SUBMITTED: "warning",
  APPROVED: "success",
  REJECTED: "error",
  ACTIVE: "info",
  EXPIRED: "secondary",
  CANCELLED: "secondary",
};

export default function AdminContractDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = use(params);
  const router = useRouter();
  const [contract, setContract] = useState<ContractDetail | null>(null);
  const [loading, setLoading] = useState(true);
  const [processingAction, setProcessingAction] = useState<string | null>(null);

  const fetchContract = useCallback(async () => {
    try {
      const res = await fetch(`/api/admin/contracts/${id}`);
      if (!res.ok) {
        if (res.status === 404) {
          alert("계약을 찾을 수 없습니다");
          router.push("/contracts");
          return;
        }
        throw new Error("Failed to fetch");
      }
      const data = await res.json();
      setContract(data.contract);
    } catch (error) {
      console.error("계약 상세 조회 오류:", error);
      alert("계약 정보를 불러오는데 실패했습니다");
    } finally {
      setLoading(false);
    }
  }, [id, router]);

  useEffect(() => {
    fetchContract();
  }, [fetchContract]);

  const handleApprove = async () => {
    if (!confirm("이 계약을 승인하시겠습니까?")) return;

    setProcessingAction("approve");
    try {
      const res = await fetch(`/api/admin/contracts/${id}/approve`, {
        method: "POST",
      });

      if (!res.ok) {
        const error = await res.json();
        throw new Error(error.error || "승인 실패");
      }

      alert("계약이 승인되었습니다. 이메일로 계약서가 발송됩니다.");
      fetchContract();
    } catch (error) {
      alert(error instanceof Error ? error.message : "승인 처리 중 오류가 발생했습니다");
    } finally {
      setProcessingAction(null);
    }
  };

  const handleReject = async () => {
    const reason = prompt("거절 사유를 입력해주세요:");
    if (reason === null) return;

    setProcessingAction("reject");
    try {
      const res = await fetch(`/api/admin/contracts/${id}/reject`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ reason }),
      });

      if (!res.ok) {
        const error = await res.json();
        throw new Error(error.error || "거절 실패");
      }

      alert("계약이 거절되었습니다.");
      fetchContract();
    } catch (error) {
      alert(error instanceof Error ? error.message : "거절 처리 중 오류가 발생했습니다");
    } finally {
      setProcessingAction(null);
    }
  };

  const formatCurrency = (amount: number) => {
    return new Intl.NumberFormat("ko-KR").format(amount) + "원";
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <Loader2 className="w-8 h-8 animate-spin text-blue-600" />
      </div>
    );
  }

  if (!contract) {
    return null;
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-4">
          <button
            onClick={() => router.push("/contracts")}
            className="p-2 hover:bg-gray-100 dark:hover:bg-gray-700 rounded-lg transition-colors"
          >
            <ArrowLeft className="w-5 h-5" />
          </button>
          <div>
            <h1 className="text-2xl font-bold text-gray-900 dark:text-white">계약 상세</h1>
            <p className="text-sm text-gray-500 font-mono">{contract.contractNumber}</p>
          </div>
        </div>
        <Badge variant={STATUS_COLORS[contract.status]} className="text-sm px-3 py-1">
          {STATUS_LABELS[contract.status]}
        </Badge>
      </div>

      {contract.status === "SUBMITTED" && (
        <Card className="border-yellow-200 bg-yellow-50 dark:bg-yellow-900/20">
          <CardContent className="py-4">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2 text-yellow-700 dark:text-yellow-400">
                <Clock className="w-5 h-5" />
                <span className="font-medium">승인 대기 중인 계약입니다</span>
              </div>
              <div className="flex gap-2">
                <button
                  onClick={handleApprove}
                  disabled={!!processingAction}
                  className="flex items-center gap-2 px-4 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700 disabled:opacity-50 transition-colors"
                >
                  {processingAction === "approve" ? (
                    <Loader2 className="w-4 h-4 animate-spin" />
                  ) : (
                    <CheckCircle className="w-4 h-4" />
                  )}
                  승인
                </button>
                <button
                  onClick={handleReject}
                  disabled={!!processingAction}
                  className="flex items-center gap-2 px-4 py-2 bg-red-600 text-white rounded-lg hover:bg-red-700 disabled:opacity-50 transition-colors"
                >
                  {processingAction === "reject" ? (
                    <Loader2 className="w-4 h-4 animate-spin" />
                  ) : (
                    <XCircle className="w-4 h-4" />
                  )}
                  거절
                </button>
              </div>
            </div>
          </CardContent>
        </Card>
      )}

      {contract.status === "REJECTED" && contract.rejectReason && (
        <Card className="border-red-200 bg-red-50 dark:bg-red-900/20">
          <CardContent className="py-4">
            <div className="flex items-start gap-2">
              <XCircle className="w-5 h-5 text-red-600 mt-0.5" />
              <div>
                <p className="font-medium text-red-700 dark:text-red-400">거절 사유</p>
                <p className="text-sm text-red-600 dark:text-red-300">{contract.rejectReason}</p>
              </div>
            </div>
          </CardContent>
        </Card>
      )}

      <div className="grid lg:grid-cols-3 gap-6">
        <div className="lg:col-span-2 space-y-6">
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2 text-lg">
                <FileText className="w-5 h-5" />
                계약 정보
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="grid md:grid-cols-2 gap-4">
                <InfoRow label="패키지" value={contract.package.displayName} />
                <InfoRow label="계약 기간" value={`${contract.contractPeriod}개월`} />
                <InfoRow label="계약 금액" value={formatCurrency(contract.totalAmount)} highlight />
                {contract.startDate && (
                  <InfoRow label="계약 시작일" value={formatDate(contract.startDate)} />
                )}
                {contract.endDate && (
                  <InfoRow label="계약 종료일" value={formatDate(contract.endDate)} />
                )}
              </div>
              {contract.additionalNotes && (
                <div className="pt-4 border-t border-gray-200 dark:border-gray-700">
                  <p className="text-sm font-medium text-gray-500 mb-1">추가 요청사항</p>
                  <p className="text-gray-900 dark:text-white whitespace-pre-wrap">
                    {contract.additionalNotes}
                  </p>
                </div>
              )}
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2 text-lg">
                <Building className="w-5 h-5" />
                사업자 정보
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="grid md:grid-cols-2 gap-4">
                <InfoRow label="상호" value={contract.companyName} />
                <InfoRow label="대표자" value={contract.ceoName} />
                <InfoRow label="사업자등록번호" value={contract.businessNumber} />
                <div className="md:col-span-2">
                  <InfoRow
                    label="주소"
                    value={contract.address}
                    icon={<MapPin className="w-4 h-4" />}
                  />
                </div>
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2 text-lg">
                <User className="w-5 h-5" />
                담당자 정보
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="grid md:grid-cols-2 gap-4">
                <InfoRow label="담당자명" value={contract.contactName} />
                <InfoRow
                  label="연락처"
                  value={contract.contactPhone}
                  icon={<Phone className="w-4 h-4" />}
                />
                <div className="md:col-span-2">
                  <InfoRow
                    label="이메일"
                    value={contract.contactEmail}
                    icon={<Mail className="w-4 h-4" />}
                  />
                </div>
              </div>
            </CardContent>
          </Card>

          {contract.clientSignature && (
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2 text-lg">
                  <FileText className="w-5 h-5" />
                  전자 서명
                </CardTitle>
              </CardHeader>
              <CardContent>
                <div className="bg-gray-50 dark:bg-gray-800 rounded-lg p-4">
                  <img
                    src={contract.clientSignature}
                    alt="계약자 서명"
                    className="max-w-[300px] h-auto mx-auto border border-gray-200 dark:border-gray-700 rounded"
                  />
                  {contract.signedAt && (
                    <p className="text-center text-sm text-gray-500 mt-2">
                      서명일시: {formatDate(contract.signedAt)}
                    </p>
                  )}
                </div>
              </CardContent>
            </Card>
          )}
        </div>

        <div className="space-y-6">
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2 text-lg">
                <User className="w-5 h-5" />
                요청자 정보
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-3">
              <InfoRow label="이름" value={contract.user.name} />
              <InfoRow label="이메일" value={contract.user.email} />
              <InfoRow label="연락처" value={contract.user.phone} />
              <InfoRow label="소속" value={contract.user.clientName} />
              <div className="pt-2 border-t border-gray-200 dark:border-gray-700">
                <p className="text-xs text-gray-500 mb-1">텔레그램 알림</p>
                <Badge variant={contract.user.telegramEnabled ? "success" : "secondary"}>
                  {contract.user.telegramEnabled ? "활성화" : "비활성화"}
                </Badge>
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2 text-lg">
                <Package className="w-5 h-5" />
                패키지 상세
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="space-y-3">
                <div>
                  <p className="text-lg font-semibold text-gray-900 dark:text-white">
                    {contract.package.displayName}
                  </p>
                  <p className="text-blue-600 font-medium">
                    {contract.package.price === 0
                      ? "별도 협의"
                      : formatCurrency(contract.package.price)}
                  </p>
                </div>
                {contract.package.description && (
                  <p className="text-sm text-gray-600 dark:text-gray-400">
                    {contract.package.description}
                  </p>
                )}
                {contract.package.features.length > 0 && (
                  <ul className="space-y-1 pt-2 border-t border-gray-200 dark:border-gray-700">
                    {contract.package.features.map((feature, idx) => (
                      <li
                        key={idx}
                        className="text-sm text-gray-600 dark:text-gray-400 flex items-center gap-2"
                      >
                        <CheckCircle className="w-3 h-3 text-green-500 flex-shrink-0" />
                        {feature}
                      </li>
                    ))}
                  </ul>
                )}
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2 text-lg">
                <History className="w-5 h-5" />
                처리 이력
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="space-y-3">
                <TimelineItem label="계약 요청" date={contract.createdAt} status="completed" />
                {contract.signedAt && (
                  <TimelineItem label="서명 완료" date={contract.signedAt} status="completed" />
                )}
                {contract.approvedAt && (
                  <TimelineItem label="승인 완료" date={contract.approvedAt} status="completed" />
                )}
                {contract.rejectedAt && (
                  <TimelineItem label="거절됨" date={contract.rejectedAt} status="error" />
                )}
                {contract.emailSentAt && (
                  <TimelineItem label="이메일 발송" date={contract.emailSentAt} status="completed" />
                )}
              </div>

              {contract.logs.length > 0 && (
                <div className="mt-4 pt-4 border-t border-gray-200 dark:border-gray-700">
                  <p className="text-xs font-medium text-gray-500 mb-2">상태 변경 이력</p>
                  <div className="space-y-2 max-h-40 overflow-y-auto">
                    {contract.logs.map((log) => (
                      <div key={log.id} className="text-xs text-gray-600 dark:text-gray-400">
                        <span className="text-gray-500">{formatDate(log.createdAt)}</span>
                        <span className="mx-1">-</span>
                        {log.fromStatus && <span>{STATUS_LABELS[log.fromStatus]} → </span>}
                        <span className="font-medium">{STATUS_LABELS[log.toStatus]}</span>
                        {log.note && <span className="text-gray-400"> ({log.note})</span>}
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </CardContent>
          </Card>

          {["APPROVED", "ACTIVE", "EXPIRED"].includes(contract.status) && (
            <a
              href={`/api/contracts/${contract.id}/pdf`}
              className="flex items-center justify-center gap-2 w-full px-4 py-3 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors"
            >
              <Download className="w-5 h-5" />
              계약서 PDF 다운로드
            </a>
          )}
        </div>
      </div>
    </div>
  );
}

function InfoRow({
  label,
  value,
  icon,
  highlight,
}: {
  label: string;
  value: string;
  icon?: React.ReactNode;
  highlight?: boolean;
}) {
  return (
    <div>
      <p className="text-xs font-medium text-gray-500 mb-1">{label}</p>
      <p
        className={`flex items-center gap-1.5 ${
          highlight ? "text-lg font-bold text-blue-600" : "text-gray-900 dark:text-white"
        }`}
      >
        {icon}
        {value}
      </p>
    </div>
  );
}

function TimelineItem({
  label,
  date,
  status,
}: {
  label: string;
  date: string;
  status: "completed" | "pending" | "error";
}) {
  const colors = {
    completed: "bg-green-500",
    pending: "bg-gray-300",
    error: "bg-red-500",
  };

  return (
    <div className="flex items-center gap-3">
      <div className={`w-2 h-2 rounded-full ${colors[status]}`} />
      <div className="flex-1">
        <p className="text-sm font-medium text-gray-900 dark:text-white">{label}</p>
        <p className="text-xs text-gray-500">{formatDate(date)}</p>
      </div>
    </div>
  );
}
