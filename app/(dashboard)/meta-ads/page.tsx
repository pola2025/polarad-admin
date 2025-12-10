"use client";

import { useState, useEffect, useRef } from "react";
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
  DialogFooter,
  formatDate,
  getDaysUntilExpiry,
} from "@polarad/ui";
import {
  ComposedChart,
  Bar,
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  ReferenceLine,
} from "recharts";
import {
  Search,
  RefreshCw,
  Save,
  Loader2,
  ExternalLink,
  AlertCircle,
  CheckCircle,
  Key,
  Building,
  Plus,
  Edit2,
  Trash2,
  Database,
  CreditCard,
  TrendingUp,
  Calendar,
  Users,
  Activity,
  ChevronLeft,
  ChevronRight,
  Play,
  X,
  Phone,
  Mail,
  Target,
} from "lucide-react";

// 인터페이스 정의
interface ClientTargets {
  targetLeads: number | null;
  targetSpend: number | null;
  targetCpl: number | null;
}

interface MetaAdClient {
  id: string;
  clientId: string;
  clientName: string;
  email: string;
  phone: string | null;
  contactPhone: string | null;
  contactName: string | null;
  metaAdAccountId: string | null;
  tokenExpiresAt: string | null;
  authStatus: string;
  isActive: boolean;
  telegramEnabled: boolean;
  telegramChatId: string | null;
  servicePeriodStart: string | null;
  servicePeriodEnd: string | null;
  createdAt: string;
  latestDataDate?: string | null;
  dataCount?: number;
  targets?: ClientTargets | null;
}

interface SystemStatus {
  clients: {
    total: number;
    active: number;
    inactive: number;
    withTelegram: number;
    expiringSoon: number;
    authRequired: number;
    tokenExpiring: number;
  };
  dataCollection: {
    todayRecords: number;
    missingDataClients: number;
  };
  recent7Days: {
    impressions: number;
    clicks: number;
    leads: number;
    spend: number;
    ctr: number;
    cpl: number;
  };
}

interface DailyFlowData {
  date: string;
  day: number;
  impressions: number;
  clicks: number;
  leads: number;
  spend: number;
  cpl: number;
  ctr: number;
  hasData: boolean;
}

interface MonthlyFlowResponse {
  dailyData: DailyFlowData[];
  monthlyTotals: {
    impressions: number;
    clicks: number;
    leads: number;
    spend: number;
    avgCpl: number;
  };
  analysis: {
    avgCpl: number;
    inefficientDays: number[];
    activeDays: number;
    inactiveDays: number;
  };
}

interface BackfillLog {
  time: string;
  type: "info" | "success" | "warning" | "error";
  message: string;
}

interface Payment {
  id: string;
  clientId: string;
  paymentDate: string;
  amount: number | null;
  paymentType: string;
  paymentMethod: string | null;
  memo: string | null;
  serviceMonths: number;
}

// 초기 폼 데이터
const initialFormData = {
  clientName: "",
  email: "",
  phone: "",
  contactPhone: "",
  contactName: "",
  metaAdAccountId: "",
  metaAccessToken: "",
  telegramChatId: "",
  planType: "FREE",
  targetLeads: "",
  targetSpend: "",
  targetCpl: "",
  servicePeriodStart: new Date().toISOString().split("T")[0],
  servicePeriodEnd: "",
  telegramEnabled: true,
  unlimitedService: false,
};

export default function MetaAdsPage() {
  const [clients, setClients] = useState<MetaAdClient[]>([]);
  const [systemStatus, setSystemStatus] = useState<SystemStatus | null>(null);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [filter, setFilter] = useState<"all" | "connected" | "not_connected" | "expiring">("all");

  // 모달 상태
  const [showModal, setShowModal] = useState(false);
  const [editingClient, setEditingClient] = useState<MetaAdClient | null>(null);
  const [formData, setFormData] = useState(initialFormData);
  const [submitting, setSubmitting] = useState(false);
  const [tokenValidating, setTokenValidating] = useState(false);
  const [tokenValidation, setTokenValidation] = useState<{
    valid: boolean;
    accountName?: string;
    error?: string;
  } | null>(null);

  // 월간 흐름 차트 상태
  const [monthlyFlowData, setMonthlyFlowData] = useState<MonthlyFlowResponse | null>(null);
  const [flowMonth, setFlowMonth] = useState(() => {
    const now = new Date();
    return { year: now.getFullYear(), month: now.getMonth() + 1 };
  });
  const [flowLoading, setFlowLoading] = useState(false);

  // 백필 모달 상태
  const [showBackfillModal, setShowBackfillModal] = useState(false);
  const [backfillClient, setBackfillClient] = useState<MetaAdClient | null>(null);
  const [backfillLoading, setBackfillLoading] = useState(false);
  const [backfillLogs, setBackfillLogs] = useState<BackfillLog[]>([]);
  const [backfillResult, setBackfillResult] = useState<{
    success: boolean;
    totalRecords?: number;
    savedRecords?: number;
  } | null>(null);
  const [backfillForm, setBackfillForm] = useState({
    startDate: "",
    endDate: "",
    preset: "last30",
  });
  const logsEndRef = useRef<HTMLDivElement>(null);

  // 결제 모달 상태
  const [showPaymentModal, setShowPaymentModal] = useState(false);
  const [paymentClient, setPaymentClient] = useState<MetaAdClient | null>(null);
  const [payments, setPayments] = useState<Payment[]>([]);
  const [paymentLoading, setPaymentLoading] = useState(false);
  const [paymentForm, setPaymentForm] = useState({
    paymentDate: new Date().toISOString().split("T")[0],
    amount: "",
    paymentType: "monthly",
    memo: "",
    serviceMonths: "3",
  });

  // 데이터 로드 함수
  async function fetchClients() {
    try {
      const params = new URLSearchParams({ limit: "100", includeStats: "true" });
      if (search) params.set("search", search);

      const res = await fetch(`/api/clients?${params}`);
      const data = await res.json();

      if (data.success) {
        setClients(data.data);
      }
    } catch (error) {
      console.error("Clients fetch error:", error);
    }
  }

  async function fetchSystemStatus() {
    try {
      const res = await fetch("/api/admin/status");
      const data = await res.json();

      if (data.success) {
        setSystemStatus(data);
      }
    } catch (error) {
      console.error("System status fetch error:", error);
    }
  }

  async function fetchMonthlyFlow() {
    setFlowLoading(true);
    try {
      const res = await fetch(
        `/api/admin/monthly-flow?year=${flowMonth.year}&month=${flowMonth.month}`
      );
      const data = await res.json();

      if (data.success) {
        setMonthlyFlowData(data);
      }
    } catch (error) {
      console.error("Monthly flow fetch error:", error);
    } finally {
      setFlowLoading(false);
    }
  }

  async function loadAll() {
    setLoading(true);
    await Promise.all([fetchClients(), fetchSystemStatus(), fetchMonthlyFlow()]);
    setLoading(false);
  }

  useEffect(() => {
    loadAll();
  }, []);

  useEffect(() => {
    fetchMonthlyFlow();
  }, [flowMonth]);

  // 클라이언트 등록/수정
  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setSubmitting(true);

    try {
      const url = editingClient
        ? `/api/clients/${editingClient.id}`
        : "/api/clients";
      const method = editingClient ? "PATCH" : "POST";

      const body = {
        ...formData,
        targetLeads: formData.targetLeads ? parseInt(formData.targetLeads) : null,
        targetSpend: formData.targetSpend ? parseInt(formData.targetSpend) : null,
        targetCpl: formData.targetCpl ? parseInt(formData.targetCpl) : null,
      };

      const res = await fetch(url, {
        method,
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      });

      const data = await res.json();

      if (data.success) {
        setShowModal(false);
        setEditingClient(null);
        setFormData(initialFormData);
        fetchClients();
      } else {
        alert(data.error || "저장에 실패했습니다.");
      }
    } catch (error) {
      console.error("Submit error:", error);
      alert("저장 중 오류가 발생했습니다.");
    } finally {
      setSubmitting(false);
    }
  }

  // 토큰 검증
  async function validateToken() {
    if (!formData.metaAdAccountId || !formData.metaAccessToken) {
      alert("광고계정 ID와 Access Token을 입력해주세요.");
      return;
    }

    setTokenValidating(true);
    setTokenValidation(null);

    try {
      const url = `https://graph.facebook.com/v22.0/${formData.metaAdAccountId}?fields=name,account_status&access_token=${formData.metaAccessToken}`;
      const res = await fetch(url);
      const data = await res.json();

      if (data.error) {
        setTokenValidation({ valid: false, error: data.error.message });
      } else {
        setTokenValidation({ valid: true, accountName: data.name });
      }
    } catch (error) {
      setTokenValidation({ valid: false, error: "검증 실패" });
    } finally {
      setTokenValidating(false);
    }
  }

  // 클라이언트 삭제
  async function handleDelete(client: MetaAdClient) {
    if (!confirm(`${client.clientName}을(를) 삭제하시겠습니까?`)) return;

    try {
      const res = await fetch(`/api/clients/${client.id}`, { method: "DELETE" });
      const data = await res.json();

      if (data.success) {
        fetchClients();
      } else {
        alert(data.error || "삭제에 실패했습니다.");
      }
    } catch (error) {
      console.error("Delete error:", error);
      alert("삭제 중 오류가 발생했습니다.");
    }
  }

  // 편집 모달 열기
  function openEditModal(client: MetaAdClient) {
    setEditingClient(client);
    setFormData({
      clientName: client.clientName,
      email: client.email,
      phone: client.phone || "",
      contactPhone: client.contactPhone || "",
      contactName: client.contactName || "",
      metaAdAccountId: client.metaAdAccountId || "",
      metaAccessToken: "",
      telegramChatId: client.telegramChatId || "",
      planType: "FREE",
      targetLeads: client.targets?.targetLeads?.toString() || "",
      targetSpend: client.targets?.targetSpend?.toString() || "",
      targetCpl: client.targets?.targetCpl?.toString() || "",
      servicePeriodStart: client.servicePeriodStart
        ? new Date(client.servicePeriodStart).toISOString().split("T")[0]
        : "",
      servicePeriodEnd: client.servicePeriodEnd
        ? new Date(client.servicePeriodEnd).toISOString().split("T")[0]
        : "",
      telegramEnabled: client.telegramEnabled,
      unlimitedService: !client.servicePeriodEnd,
    });
    setTokenValidation(null);
    setShowModal(true);
  }

  // 새 클라이언트 모달 열기
  function openNewModal() {
    setEditingClient(null);
    setFormData(initialFormData);
    setTokenValidation(null);
    setShowModal(true);
  }

  // 백필 시작
  async function startBackfill() {
    if (!backfillClient) return;

    setBackfillLoading(true);
    setBackfillLogs([]);
    setBackfillResult(null);

    // 날짜 계산
    let startDate = backfillForm.startDate;
    let endDate = backfillForm.endDate;

    if (backfillForm.preset !== "custom") {
      const end = new Date();
      end.setDate(end.getDate() - 1);
      const start = new Date(end);

      switch (backfillForm.preset) {
        case "last7":
          start.setDate(start.getDate() - 6);
          break;
        case "last30":
          start.setDate(start.getDate() - 29);
          break;
        case "last90":
          start.setDate(start.getDate() - 89);
          break;
        case "last180":
          start.setDate(start.getDate() - 179);
          break;
        case "last365":
          start.setDate(start.getDate() - 364);
          break;
      }

      startDate = start.toISOString().split("T")[0];
      endDate = end.toISOString().split("T")[0];
    }

    try {
      const res = await fetch("/api/admin/backfill", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          clientId: backfillClient.id,
          startDate,
          endDate,
        }),
      });

      const reader = res.body?.getReader();
      const decoder = new TextDecoder();

      if (!reader) return;

      while (true) {
        const { done, value } = await reader.read();
        if (done) break;

        const text = decoder.decode(value);
        const lines = text.split("\n");

        for (const line of lines) {
          if (line.startsWith("event:")) {
            const event = line.replace("event:", "").trim();
            const dataLine = lines[lines.indexOf(line) + 1];
            if (dataLine?.startsWith("data:")) {
              const data = JSON.parse(dataLine.replace("data:", "").trim());

              if (event === "log") {
                setBackfillLogs((prev) => [...prev, data]);
              } else if (event === "complete") {
                setBackfillResult({
                  success: true,
                  totalRecords: data.totalRecords,
                  savedRecords: data.savedRecords,
                });
              } else if (event === "error") {
                setBackfillResult({ success: false });
              }
            }
          }
        }
      }
    } catch (error) {
      console.error("Backfill error:", error);
      setBackfillResult({ success: false });
    } finally {
      setBackfillLoading(false);
      fetchClients();
    }
  }

  // 결제 로드
  async function loadPayments(clientId: string) {
    setPaymentLoading(true);
    try {
      const res = await fetch(`/api/payments?clientId=${clientId}`);
      const data = await res.json();
      if (data.success) {
        setPayments(data.data);
      }
    } catch (error) {
      console.error("Payments load error:", error);
    } finally {
      setPaymentLoading(false);
    }
  }

  // 결제 등록
  async function submitPayment(e: React.FormEvent) {
    e.preventDefault();
    if (!paymentClient) return;

    setPaymentLoading(true);
    try {
      const res = await fetch("/api/payments", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          clientId: paymentClient.id,
          paymentDate: paymentForm.paymentDate,
          amount: paymentForm.amount ? parseInt(paymentForm.amount) : null,
          paymentType: paymentForm.paymentType,
          serviceMonths: parseInt(paymentForm.serviceMonths),
          memo: paymentForm.memo || null,
        }),
      });

      const data = await res.json();
      if (data.success) {
        loadPayments(paymentClient.id);
        setPaymentForm({
          paymentDate: new Date().toISOString().split("T")[0],
          amount: "",
          paymentType: "monthly",
          memo: "",
          serviceMonths: "3",
        });
        fetchClients();
      } else {
        alert(data.error || "결제 등록에 실패했습니다.");
      }
    } catch (error) {
      console.error("Payment submit error:", error);
      alert("결제 등록 중 오류가 발생했습니다.");
    } finally {
      setPaymentLoading(false);
    }
  }

  // 상태 뱃지
  function getStatusBadge(client: MetaAdClient) {
    if (!client.metaAdAccountId) {
      return <Badge variant="secondary">미연결</Badge>;
    }

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

    return <Badge variant="success">정상</Badge>;
  }

  // 필터링
  const filteredClients = clients.filter((client) => {
    if (filter === "connected") return !!client.metaAdAccountId;
    if (filter === "not_connected") return !client.metaAdAccountId;
    if (filter === "expiring") {
      const days = getDaysUntilExpiry(client.tokenExpiresAt);
      return days !== null && days <= 7;
    }
    return true;
  });

  // 월 이동
  function changeMonth(delta: number) {
    setFlowMonth((prev) => {
      let newMonth = prev.month + delta;
      let newYear = prev.year;

      if (newMonth > 12) {
        newMonth = 1;
        newYear++;
      } else if (newMonth < 1) {
        newMonth = 12;
        newYear--;
      }

      return { year: newYear, month: newMonth };
    });
  }

  return (
    <div className="space-y-6">
      {/* 헤더 */}
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold text-gray-900 dark:text-white">
          Meta 광고 관리
        </h1>
        <Button onClick={openNewModal}>
          <Plus className="w-4 h-4 mr-2" />
          클라이언트 추가
        </Button>
      </div>

      {/* 시스템 현황 카드 */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        <Card>
          <CardContent className="pt-4">
            <div className="flex items-center gap-2">
              <Users className="h-4 w-4 text-blue-500" />
              <span className="text-sm text-muted-foreground">전체 클라이언트</span>
            </div>
            <p className="text-2xl font-bold mt-1">
              {systemStatus?.clients.total || clients.length}
            </p>
            <p className="text-xs text-muted-foreground">
              활성 {systemStatus?.clients.active || 0}
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="pt-4">
            <div className="flex items-center gap-2">
              <CheckCircle className="h-4 w-4 text-green-500" />
              <span className="text-sm text-muted-foreground">광고 계정 연결</span>
            </div>
            <p className="text-2xl font-bold mt-1 text-green-600">
              {clients.filter((c) => c.metaAdAccountId).length}
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="pt-4">
            <div className="flex items-center gap-2">
              <AlertCircle className="h-4 w-4 text-red-500" />
              <span className="text-sm text-muted-foreground">토큰 만료 임박</span>
            </div>
            <p className="text-2xl font-bold mt-1 text-red-600">
              {systemStatus?.clients.tokenExpiring || 0}
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="pt-4">
            <div className="flex items-center gap-2">
              <Activity className="h-4 w-4 text-purple-500" />
              <span className="text-sm text-muted-foreground">오늘 수집</span>
            </div>
            <p className="text-2xl font-bold mt-1 text-purple-600">
              {systemStatus?.dataCollection.todayRecords || 0}건
            </p>
          </CardContent>
        </Card>
      </div>

      {/* 최근 7일 성과 */}
      {systemStatus?.recent7Days && (
        <Card>
          <CardHeader>
            <CardTitle className="text-lg">최근 7일 전체 성과</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="grid grid-cols-2 md:grid-cols-6 gap-4">
              <div className="text-center">
                <p className="text-sm text-muted-foreground">노출</p>
                <p className="text-xl font-bold">
                  {systemStatus.recent7Days.impressions.toLocaleString()}
                </p>
              </div>
              <div className="text-center">
                <p className="text-sm text-muted-foreground">클릭</p>
                <p className="text-xl font-bold">
                  {systemStatus.recent7Days.clicks.toLocaleString()}
                </p>
              </div>
              <div className="text-center">
                <p className="text-sm text-muted-foreground">리드</p>
                <p className="text-xl font-bold text-blue-600">
                  {systemStatus.recent7Days.leads.toLocaleString()}
                </p>
              </div>
              <div className="text-center">
                <p className="text-sm text-muted-foreground">광고비</p>
                <p className="text-xl font-bold">
                  ₩{systemStatus.recent7Days.spend.toLocaleString()}
                </p>
              </div>
              <div className="text-center">
                <p className="text-sm text-muted-foreground">CTR</p>
                <p className="text-xl font-bold">{systemStatus.recent7Days.ctr}%</p>
              </div>
              <div className="text-center">
                <p className="text-sm text-muted-foreground">CPL</p>
                <p className="text-xl font-bold text-green-600">
                  ₩{systemStatus.recent7Days.cpl.toLocaleString()}
                </p>
              </div>
            </div>
          </CardContent>
        </Card>
      )}

      {/* 월간 흐름 차트 */}
      <Card>
        <CardHeader>
          <div className="flex items-center justify-between">
            <CardTitle className="text-lg">월간 광고 효율 추이</CardTitle>
            <div className="flex items-center gap-2">
              <Button
                variant="outline"
                size="sm"
                onClick={() => changeMonth(-1)}
              >
                <ChevronLeft className="w-4 h-4" />
              </Button>
              <span className="font-medium min-w-[100px] text-center">
                {flowMonth.year}년 {flowMonth.month}월
              </span>
              <Button
                variant="outline"
                size="sm"
                onClick={() => changeMonth(1)}
              >
                <ChevronRight className="w-4 h-4" />
              </Button>
            </div>
          </div>
        </CardHeader>
        <CardContent>
          {flowLoading ? (
            <div className="flex items-center justify-center h-64">
              <Loader2 className="w-8 h-8 animate-spin text-blue-500" />
            </div>
          ) : monthlyFlowData ? (
            <>
              <div className="h-64">
                <ResponsiveContainer width="100%" height="100%">
                  <ComposedChart data={monthlyFlowData.dailyData}>
                    <CartesianGrid strokeDasharray="3 3" />
                    <XAxis
                      dataKey="day"
                      tick={{ fontSize: 12 }}
                      tickFormatter={(day) => `${day}일`}
                    />
                    <YAxis
                      yAxisId="left"
                      orientation="left"
                      tick={{ fontSize: 12 }}
                      tickFormatter={(v) => `₩${(v / 1000).toFixed(0)}K`}
                    />
                    <YAxis
                      yAxisId="right"
                      orientation="right"
                      tick={{ fontSize: 12 }}
                      tickFormatter={(v) => `₩${v.toLocaleString()}`}
                    />
                    <Tooltip
                      formatter={(value: number, name: string) => {
                        if (name === "spend") return [`₩${value.toLocaleString()}`, "광고비"];
                        if (name === "cpl") return [`₩${value.toLocaleString()}`, "CPL"];
                        return [value, name];
                      }}
                      labelFormatter={(day) => `${flowMonth.month}월 ${day}일`}
                    />
                    {monthlyFlowData.analysis.avgCpl > 0 && (
                      <ReferenceLine
                        yAxisId="right"
                        y={monthlyFlowData.analysis.avgCpl}
                        stroke="#f59e0b"
                        strokeDasharray="5 5"
                        label={{ value: "평균 CPL", position: "right", fontSize: 10 }}
                      />
                    )}
                    <Bar
                      yAxisId="left"
                      dataKey="spend"
                      fill="#3b82f6"
                      name="spend"
                      radius={[4, 4, 0, 0]}
                    />
                    <Line
                      yAxisId="right"
                      type="monotone"
                      dataKey="cpl"
                      stroke="#10b981"
                      strokeWidth={2}
                      dot={{ r: 3 }}
                      name="cpl"
                    />
                  </ComposedChart>
                </ResponsiveContainer>
              </div>

              <div className="grid grid-cols-2 md:grid-cols-5 gap-4 mt-4 pt-4 border-t">
                <div className="text-center">
                  <p className="text-sm text-muted-foreground">월간 광고비</p>
                  <p className="text-lg font-bold">
                    ₩{monthlyFlowData.monthlyTotals.spend.toLocaleString()}
                  </p>
                </div>
                <div className="text-center">
                  <p className="text-sm text-muted-foreground">월간 리드</p>
                  <p className="text-lg font-bold text-blue-600">
                    {monthlyFlowData.monthlyTotals.leads.toLocaleString()}
                  </p>
                </div>
                <div className="text-center">
                  <p className="text-sm text-muted-foreground">평균 CPL</p>
                  <p className="text-lg font-bold text-green-600">
                    ₩{monthlyFlowData.monthlyTotals.avgCpl.toLocaleString()}
                  </p>
                </div>
                <div className="text-center">
                  <p className="text-sm text-muted-foreground">운영일</p>
                  <p className="text-lg font-bold">{monthlyFlowData.analysis.activeDays}일</p>
                </div>
                <div className="text-center">
                  <p className="text-sm text-muted-foreground">비효율 구간</p>
                  <p className="text-lg font-bold text-orange-500">
                    {monthlyFlowData.analysis.inefficientDays.length}일
                  </p>
                </div>
              </div>
            </>
          ) : (
            <div className="text-center py-8 text-muted-foreground">
              데이터가 없습니다.
            </div>
          )}
        </CardContent>
      </Card>

      {/* 검색/필터 */}
      <Card>
        <CardContent className="pt-6">
          <form
            onSubmit={(e) => {
              e.preventDefault();
              fetchClients();
            }}
            className="flex gap-2"
          >
            <div className="relative flex-1">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
              <Input
                placeholder="클라이언트명, 이메일로 검색..."
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                className="pl-10"
              />
            </div>
            <select
              value={filter}
              onChange={(e) => setFilter(e.target.value as typeof filter)}
              className="px-3 py-2 rounded-lg border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-800"
            >
              <option value="all">전체</option>
              <option value="connected">연결됨</option>
              <option value="not_connected">미연결</option>
              <option value="expiring">만료 임박</option>
            </select>
            <Button type="submit" variant="secondary">
              검색
            </Button>
            <Button
              type="button"
              variant="outline"
              onClick={() => {
                setSearch("");
                setFilter("all");
                loadAll();
              }}
            >
              <RefreshCw className="w-4 h-4" />
            </Button>
          </form>
        </CardContent>
      </Card>

      {/* 클라이언트 목록 */}
      <Card>
        <CardHeader>
          <CardTitle className="text-lg">
            클라이언트 목록 ({filteredClients.length}건)
          </CardTitle>
        </CardHeader>
        <CardContent>
          {loading ? (
            <div className="flex items-center justify-center h-32">
              <Loader2 className="w-8 h-8 animate-spin text-blue-500" />
            </div>
          ) : filteredClients.length === 0 ? (
            <p className="text-center text-muted-foreground py-8">
              해당하는 클라이언트가 없습니다.
            </p>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full">
                <thead>
                  <tr className="border-b">
                    <th className="text-left py-3 px-4 font-medium text-sm">클라이언트</th>
                    <th className="text-left py-3 px-4 font-medium text-sm">광고 계정</th>
                    <th className="text-left py-3 px-4 font-medium text-sm">서비스 기간</th>
                    <th className="text-left py-3 px-4 font-medium text-sm">최신 데이터</th>
                    <th className="text-left py-3 px-4 font-medium text-sm">상태</th>
                    <th className="text-left py-3 px-4 font-medium text-sm">관리</th>
                  </tr>
                </thead>
                <tbody>
                  {filteredClients.map((client) => (
                    <tr
                      key={client.id}
                      className="border-b hover:bg-gray-50 dark:hover:bg-gray-800"
                    >
                      <td className="py-3 px-4">
                        <div>
                          <p className="font-medium">{client.clientName}</p>
                          <p className="text-sm text-muted-foreground">{client.email}</p>
                        </div>
                      </td>
                      <td className="py-3 px-4 text-sm font-mono">
                        {client.metaAdAccountId || (
                          <span className="text-muted-foreground">-</span>
                        )}
                      </td>
                      <td className="py-3 px-4 text-sm">
                        {client.servicePeriodEnd ? (
                          <span
                            className={
                              getDaysUntilExpiry(client.servicePeriodEnd) !== null &&
                              getDaysUntilExpiry(client.servicePeriodEnd)! <= 7
                                ? "text-red-600"
                                : ""
                            }
                          >
                            ~{formatDate(client.servicePeriodEnd)}
                          </span>
                        ) : (
                          <span className="text-green-600">무제한</span>
                        )}
                      </td>
                      <td className="py-3 px-4 text-sm">
                        {client.latestDataDate ? (
                          formatDate(client.latestDataDate)
                        ) : (
                          <span className="text-muted-foreground">-</span>
                        )}
                        {client.dataCount !== undefined && client.dataCount > 0 && (
                          <span className="text-xs text-muted-foreground ml-1">
                            ({client.dataCount.toLocaleString()}건)
                          </span>
                        )}
                      </td>
                      <td className="py-3 px-4">{getStatusBadge(client)}</td>
                      <td className="py-3 px-4">
                        <div className="flex gap-1">
                          <Button
                            size="sm"
                            variant="ghost"
                            onClick={() => openEditModal(client)}
                            title="수정"
                          >
                            <Edit2 className="w-4 h-4" />
                          </Button>
                          <Button
                            size="sm"
                            variant="ghost"
                            onClick={() => {
                              setBackfillClient(client);
                              setBackfillLogs([]);
                              setBackfillResult(null);
                              setShowBackfillModal(true);
                            }}
                            title="백필"
                            disabled={!client.metaAdAccountId}
                          >
                            <Database className="w-4 h-4" />
                          </Button>
                          <Button
                            size="sm"
                            variant="ghost"
                            onClick={() => {
                              setPaymentClient(client);
                              loadPayments(client.id);
                              setShowPaymentModal(true);
                            }}
                            title="결제"
                          >
                            <CreditCard className="w-4 h-4" />
                          </Button>
                          <Button
                            size="sm"
                            variant="ghost"
                            onClick={() => handleDelete(client)}
                            title="삭제"
                          >
                            <Trash2 className="w-4 h-4 text-red-500" />
                          </Button>
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </CardContent>
      </Card>

      {/* 클라이언트 등록/수정 모달 */}
      <Dialog open={showModal} onOpenChange={setShowModal}>
        <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>
              {editingClient ? `클라이언트 수정 - ${editingClient.clientName}` : "새 클라이언트 등록"}
            </DialogTitle>
          </DialogHeader>

          <form onSubmit={handleSubmit} className="space-y-4 py-4">
            {/* 기본 정보 */}
            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="block text-sm font-medium mb-1">
                  클라이언트명 <span className="text-red-500">*</span>
                </label>
                <Input
                  value={formData.clientName}
                  onChange={(e) =>
                    setFormData((prev) => ({ ...prev, clientName: e.target.value }))
                  }
                  required
                />
              </div>
              <div>
                <label className="block text-sm font-medium mb-1">이메일</label>
                <Input
                  type="email"
                  value={formData.email}
                  onChange={(e) =>
                    setFormData((prev) => ({ ...prev, email: e.target.value }))
                  }
                />
              </div>
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="block text-sm font-medium mb-1">담당자명</label>
                <Input
                  value={formData.contactName}
                  onChange={(e) =>
                    setFormData((prev) => ({ ...prev, contactName: e.target.value }))
                  }
                />
              </div>
              <div>
                <label className="block text-sm font-medium mb-1">담당자 연락처</label>
                <Input
                  value={formData.contactPhone}
                  onChange={(e) =>
                    setFormData((prev) => ({ ...prev, contactPhone: e.target.value }))
                  }
                  placeholder="010-0000-0000"
                />
              </div>
            </div>

            {/* Meta 연동 */}
            <div className="border-t pt-4 mt-4">
              <h3 className="font-medium mb-3">Meta 광고 연동</h3>
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium mb-1">광고 계정 ID</label>
                  <Input
                    value={formData.metaAdAccountId}
                    onChange={(e) =>
                      setFormData((prev) => ({ ...prev, metaAdAccountId: e.target.value }))
                    }
                    placeholder="act_123456789"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium mb-1">Access Token</label>
                  <div className="flex gap-2">
                    <Input
                      type="password"
                      value={formData.metaAccessToken}
                      onChange={(e) =>
                        setFormData((prev) => ({ ...prev, metaAccessToken: e.target.value }))
                      }
                      placeholder={editingClient ? "변경 시에만 입력" : "토큰 입력"}
                    />
                    <Button
                      type="button"
                      variant="outline"
                      onClick={validateToken}
                      disabled={tokenValidating}
                    >
                      {tokenValidating ? (
                        <Loader2 className="w-4 h-4 animate-spin" />
                      ) : (
                        "검증"
                      )}
                    </Button>
                  </div>
                  {tokenValidation && (
                    <p
                      className={`text-sm mt-1 ${
                        tokenValidation.valid ? "text-green-600" : "text-red-600"
                      }`}
                    >
                      {tokenValidation.valid
                        ? `✓ ${tokenValidation.accountName}`
                        : `✗ ${tokenValidation.error}`}
                    </p>
                  )}
                </div>
              </div>
            </div>

            {/* 서비스 기간 */}
            <div className="border-t pt-4 mt-4">
              <h3 className="font-medium mb-3">서비스 설정</h3>
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium mb-1">서비스 시작일</label>
                  <Input
                    type="date"
                    value={formData.servicePeriodStart}
                    onChange={(e) =>
                      setFormData((prev) => ({ ...prev, servicePeriodStart: e.target.value }))
                    }
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium mb-1">서비스 종료일</label>
                  <Input
                    type="date"
                    value={formData.servicePeriodEnd}
                    onChange={(e) =>
                      setFormData((prev) => ({ ...prev, servicePeriodEnd: e.target.value }))
                    }
                    disabled={formData.unlimitedService}
                  />
                  <label className="flex items-center gap-2 mt-2 text-sm">
                    <input
                      type="checkbox"
                      checked={formData.unlimitedService}
                      onChange={(e) =>
                        setFormData((prev) => ({
                          ...prev,
                          unlimitedService: e.target.checked,
                          servicePeriodEnd: e.target.checked ? "" : prev.servicePeriodEnd,
                        }))
                      }
                    />
                    무제한
                  </label>
                </div>
              </div>

              <div className="grid grid-cols-2 gap-4 mt-4">
                <div>
                  <label className="block text-sm font-medium mb-1">텔레그램 Chat ID</label>
                  <Input
                    value={formData.telegramChatId}
                    onChange={(e) =>
                      setFormData((prev) => ({ ...prev, telegramChatId: e.target.value }))
                    }
                    placeholder="-100123456789"
                  />
                </div>
                <div className="flex items-end">
                  <label className="flex items-center gap-2 text-sm">
                    <input
                      type="checkbox"
                      checked={formData.telegramEnabled}
                      onChange={(e) =>
                        setFormData((prev) => ({ ...prev, telegramEnabled: e.target.checked }))
                      }
                    />
                    텔레그램 알림 활성화
                  </label>
                </div>
              </div>
            </div>

            {/* 목표 설정 */}
            <div className="border-t pt-4 mt-4">
              <h3 className="font-medium mb-3">목표 설정 (월간)</h3>
              <div className="grid grid-cols-3 gap-4">
                <div>
                  <label className="block text-sm font-medium mb-1">목표 리드</label>
                  <Input
                    type="number"
                    value={formData.targetLeads}
                    onChange={(e) =>
                      setFormData((prev) => ({ ...prev, targetLeads: e.target.value }))
                    }
                    placeholder="100"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium mb-1">목표 광고비</label>
                  <Input
                    type="number"
                    value={formData.targetSpend}
                    onChange={(e) =>
                      setFormData((prev) => ({ ...prev, targetSpend: e.target.value }))
                    }
                    placeholder="1000000"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium mb-1">목표 CPL</label>
                  <Input
                    type="number"
                    value={formData.targetCpl}
                    onChange={(e) =>
                      setFormData((prev) => ({ ...prev, targetCpl: e.target.value }))
                    }
                    placeholder="10000"
                  />
                </div>
              </div>
            </div>

            <DialogFooter className="mt-6">
              <Button type="button" variant="outline" onClick={() => setShowModal(false)}>
                취소
              </Button>
              <Button type="submit" disabled={submitting}>
                {submitting ? (
                  <Loader2 className="w-4 h-4 animate-spin mr-2" />
                ) : (
                  <Save className="w-4 h-4 mr-2" />
                )}
                저장
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>

      {/* 백필 모달 */}
      <Dialog open={showBackfillModal} onOpenChange={setShowBackfillModal}>
        <DialogContent className="max-w-lg">
          <DialogHeader>
            <DialogTitle>데이터 백필 - {backfillClient?.clientName}</DialogTitle>
          </DialogHeader>

          <div className="space-y-4 py-4">
            <div>
              <label className="block text-sm font-medium mb-2">기간 선택</label>
              <select
                value={backfillForm.preset}
                onChange={(e) =>
                  setBackfillForm((prev) => ({ ...prev, preset: e.target.value }))
                }
                className="w-full px-3 py-2 rounded-lg border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-800"
                disabled={backfillLoading}
              >
                <option value="last7">최근 7일</option>
                <option value="last30">최근 30일</option>
                <option value="last90">최근 90일</option>
                <option value="last180">최근 180일</option>
                <option value="last365">최근 365일</option>
                <option value="custom">직접 선택</option>
              </select>
            </div>

            {backfillForm.preset === "custom" && (
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium mb-1">시작일</label>
                  <Input
                    type="date"
                    value={backfillForm.startDate}
                    onChange={(e) =>
                      setBackfillForm((prev) => ({ ...prev, startDate: e.target.value }))
                    }
                    disabled={backfillLoading}
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium mb-1">종료일</label>
                  <Input
                    type="date"
                    value={backfillForm.endDate}
                    onChange={(e) =>
                      setBackfillForm((prev) => ({ ...prev, endDate: e.target.value }))
                    }
                    disabled={backfillLoading}
                  />
                </div>
              </div>
            )}

            {/* 로그 영역 */}
            {backfillLogs.length > 0 && (
              <div className="bg-gray-900 rounded-lg p-3 max-h-48 overflow-y-auto text-sm font-mono">
                {backfillLogs.map((log, i) => (
                  <div
                    key={i}
                    className={`${
                      log.type === "error"
                        ? "text-red-400"
                        : log.type === "warning"
                          ? "text-yellow-400"
                          : log.type === "success"
                            ? "text-green-400"
                            : "text-gray-300"
                    }`}
                  >
                    <span className="text-gray-500">[{log.time}]</span> {log.message}
                  </div>
                ))}
                <div ref={logsEndRef} />
              </div>
            )}

            {/* 결과 */}
            {backfillResult && (
              <div
                className={`p-3 rounded-lg ${
                  backfillResult.success
                    ? "bg-green-100 text-green-800"
                    : "bg-red-100 text-red-800"
                }`}
              >
                {backfillResult.success ? (
                  <>
                    <CheckCircle className="w-4 h-4 inline mr-2" />
                    백필 완료: {backfillResult.totalRecords?.toLocaleString()}건 수집,{" "}
                    {backfillResult.savedRecords?.toLocaleString()}건 저장
                  </>
                ) : (
                  <>
                    <AlertCircle className="w-4 h-4 inline mr-2" />
                    백필 실패
                  </>
                )}
              </div>
            )}
          </div>

          <DialogFooter>
            <Button
              variant="outline"
              onClick={() => setShowBackfillModal(false)}
              disabled={backfillLoading}
            >
              닫기
            </Button>
            <Button onClick={startBackfill} disabled={backfillLoading || !!backfillResult}>
              {backfillLoading ? (
                <>
                  <Loader2 className="w-4 h-4 animate-spin mr-2" />
                  진행 중...
                </>
              ) : (
                <>
                  <Play className="w-4 h-4 mr-2" />
                  백필 시작
                </>
              )}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* 결제 모달 */}
      <Dialog open={showPaymentModal} onOpenChange={setShowPaymentModal}>
        <DialogContent className="max-w-lg">
          <DialogHeader>
            <DialogTitle>결제 관리 - {paymentClient?.clientName}</DialogTitle>
          </DialogHeader>

          <div className="space-y-4 py-4">
            {/* 현재 서비스 기간 */}
            {paymentClient && (
              <div className="bg-gray-100 dark:bg-gray-800 rounded-lg p-3">
                <p className="text-sm text-muted-foreground">현재 서비스 기간</p>
                <p className="font-medium">
                  {paymentClient.servicePeriodStart
                    ? formatDate(paymentClient.servicePeriodStart)
                    : "-"}{" "}
                  ~{" "}
                  {paymentClient.servicePeriodEnd
                    ? formatDate(paymentClient.servicePeriodEnd)
                    : "무제한"}
                </p>
              </div>
            )}

            {/* 결제 등록 폼 */}
            <form onSubmit={submitPayment} className="space-y-3">
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-sm font-medium mb-1">결제일</label>
                  <Input
                    type="date"
                    value={paymentForm.paymentDate}
                    onChange={(e) =>
                      setPaymentForm((prev) => ({ ...prev, paymentDate: e.target.value }))
                    }
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium mb-1">금액</label>
                  <Input
                    type="number"
                    value={paymentForm.amount}
                    onChange={(e) =>
                      setPaymentForm((prev) => ({ ...prev, amount: e.target.value }))
                    }
                    placeholder="0"
                  />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-sm font-medium mb-1">결제 유형</label>
                  <select
                    value={paymentForm.paymentType}
                    onChange={(e) =>
                      setPaymentForm((prev) => ({ ...prev, paymentType: e.target.value }))
                    }
                    className="w-full px-3 py-2 rounded-lg border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-800"
                  >
                    <option value="monthly">월간</option>
                    <option value="quarterly">분기</option>
                  </select>
                </div>
                <div>
                  <label className="block text-sm font-medium mb-1">연장 개월</label>
                  <select
                    value={paymentForm.serviceMonths}
                    onChange={(e) =>
                      setPaymentForm((prev) => ({ ...prev, serviceMonths: e.target.value }))
                    }
                    className="w-full px-3 py-2 rounded-lg border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-800"
                  >
                    <option value="1">1개월</option>
                    <option value="3">3개월</option>
                    <option value="6">6개월</option>
                    <option value="12">12개월</option>
                  </select>
                </div>
              </div>

              <div>
                <label className="block text-sm font-medium mb-1">메모</label>
                <Input
                  value={paymentForm.memo}
                  onChange={(e) =>
                    setPaymentForm((prev) => ({ ...prev, memo: e.target.value }))
                  }
                  placeholder="메모"
                />
              </div>

              <Button type="submit" className="w-full" disabled={paymentLoading}>
                {paymentLoading ? (
                  <Loader2 className="w-4 h-4 animate-spin mr-2" />
                ) : (
                  <CreditCard className="w-4 h-4 mr-2" />
                )}
                결제 등록
              </Button>
            </form>

            {/* 결제 이력 */}
            <div className="border-t pt-4">
              <h4 className="font-medium mb-2">결제 이력</h4>
              {paymentLoading ? (
                <div className="text-center py-4">
                  <Loader2 className="w-5 h-5 animate-spin mx-auto" />
                </div>
              ) : payments.length === 0 ? (
                <p className="text-sm text-muted-foreground text-center py-4">
                  결제 이력이 없습니다.
                </p>
              ) : (
                <div className="space-y-2 max-h-48 overflow-y-auto">
                  {payments.map((payment) => (
                    <div
                      key={payment.id}
                      className="flex justify-between items-center text-sm p-2 bg-gray-50 dark:bg-gray-800 rounded"
                    >
                      <div>
                        <p className="font-medium">
                          {formatDate(payment.paymentDate)} ({payment.serviceMonths}개월)
                        </p>
                        {payment.memo && (
                          <p className="text-xs text-muted-foreground">{payment.memo}</p>
                        )}
                      </div>
                      <p className="font-medium">
                        {payment.amount
                          ? `₩${payment.amount.toLocaleString()}`
                          : "-"}
                      </p>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>

          <DialogFooter>
            <Button variant="outline" onClick={() => setShowPaymentModal(false)}>
              닫기
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
