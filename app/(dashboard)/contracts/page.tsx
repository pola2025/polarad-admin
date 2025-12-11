"use client";

import { useState, useEffect, useCallback } from "react";
import { Card, CardContent, CardHeader, CardTitle, Badge, formatDate } from "@polarad/ui";
import {
  FileSignature,
  Search,
  Filter,
  CheckCircle,
  XCircle,
  Download,
  Eye,
  ChevronDown,
  Loader2,
  Plus,
  X,
  Trash2,
} from "lucide-react";

interface Contract {
  id: string;
  contractNumber: string;
  companyName: string;
  ceoName: string;
  contactEmail: string;
  contactPhone: string;
  status: string;
  monthlyFee: number;
  contractPeriod: number;
  totalAmount: number;
  createdAt: string;
  approvedAt: string | null;
  package: {
    displayName: string;
  };
  user: {
    clientName: string;
  };
}

interface Stats {
  total: number;
  pending: number;
  submitted: number;
  approved: number;
  active: number;
  rejected: number;
}

interface User {
  id: string;
  clientName: string;
  name: string;
  email: string;
  phone: string;
  submission?: {
    contactEmail?: string;
    contactPhone?: string;
    brandName?: string;
  };
}

interface Package {
  id: string;
  name: string;
  displayName: string;
  price: number;
  description: string | null;
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

export default function AdminContractsPage() {
  const [contracts, setContracts] = useState<Contract[]>([]);
  const [stats, setStats] = useState<Stats | null>(null);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState("");
  const [statusFilter, setStatusFilter] = useState("");
  const [processingId, setProcessingId] = useState<string | null>(null);

  // 계약서 생성 모달 상태
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [allUsers, setAllUsers] = useState<User[]>([]);
  const [packages, setPackages] = useState<Package[]>([]);
  const [selectedUser, setSelectedUser] = useState<User | null>(null);
  const [selectedPackage, setSelectedPackage] = useState<Package | null>(null);
  const [contractPeriod, setContractPeriod] = useState(12);
  const [monthlyFee, setMonthlyFee] = useState<number | "">("");
  const [setupFee, setSetupFee] = useState<number | "">(0);
  const [additionalNotes, setAdditionalNotes] = useState("");
  const [isPromotion, setIsPromotion] = useState(false);
  const [creating, setCreating] = useState(false);
  const [loadingUsers, setLoadingUsers] = useState(false);
  const [userDropdownOpen, setUserDropdownOpen] = useState(false);

  const fetchContracts = useCallback(async () => {
    try {
      const params = new URLSearchParams();
      if (searchTerm) params.append("search", searchTerm);
      if (statusFilter) params.append("status", statusFilter);

      const res = await fetch(`/api/admin/contracts?${params}`);
      if (!res.ok) throw new Error("Failed to fetch");
      const data = await res.json();
      setContracts(data.contracts);
      setStats(data.stats);
    } catch (error) {
      console.error("계약 목록 조회 오류:", error);
    } finally {
      setLoading(false);
    }
  }, [searchTerm, statusFilter]);

  useEffect(() => {
    fetchContracts();
  }, [fetchContracts]);

  // 전체 사용자 목록 조회 (한글 가나다순 정렬)
  const fetchAllUsers = useCallback(async () => {
    setLoadingUsers(true);
    try {
      const res = await fetch("/api/users?limit=1000");
      if (!res.ok) return;
      const data = await res.json();
      // 브랜드 상호명(clientName) 기준 한글 가나다순 정렬
      const sortedUsers = (data.data || []).sort((a: User, b: User) =>
        a.clientName.localeCompare(b.clientName, 'ko-KR')
      );
      setAllUsers(sortedUsers);
    } catch (error) {
      console.error("사용자 목록 조회 오류:", error);
    } finally {
      setLoadingUsers(false);
    }
  }, []);

  // 패키지 목록 조회
  const fetchPackages = useCallback(async () => {
    try {
      const res = await fetch("/api/packages");
      if (!res.ok) return;
      const data = await res.json();
      setPackages(data.packages || []);
    } catch (error) {
      console.error("패키지 조회 오류:", error);
    }
  }, []);

  // 모달 열기
  const openCreateModal = () => {
    setShowCreateModal(true);
    fetchPackages();
    fetchAllUsers();
    setSelectedUser(null);
    setSelectedPackage(null);
    setContractPeriod(12);
    setMonthlyFee("");
    setSetupFee(0);
    setAdditionalNotes("");
    setIsPromotion(false);
    setUserDropdownOpen(false);
  };

  // 패키지 선택 시 금액 자동 설정
  const handlePackageSelect = (pkg: Package) => {
    setSelectedPackage(pkg);
    setMonthlyFee(pkg.price);
  };

  // 계약서 생성
  const handleCreateContract = async () => {
    if (!selectedUser || !selectedPackage) {
      alert("사용자와 패키지를 선택해주세요.");
      return;
    }

    setCreating(true);
    try {
      const res = await fetch("/api/admin/contracts", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          userId: selectedUser.id,
          packageId: selectedPackage.id,
          contractPeriod,
          monthlyFee: monthlyFee || selectedPackage.price,
          setupFee: setupFee || 0,
          additionalNotes,
          isPromotion,
        }),
      });

      const data = await res.json();

      if (!res.ok) {
        throw new Error(data.error || "계약서 생성 실패");
      }

      alert(data.message || "계약서가 생성되었습니다.");
      setShowCreateModal(false);
      fetchContracts();
    } catch (error) {
      alert(error instanceof Error ? error.message : "계약서 생성 중 오류가 발생했습니다");
    } finally {
      setCreating(false);
    }
  };


  const handleApprove = async (id: string) => {
    if (!confirm("이 계약을 승인하시겠습니까?")) return;

    setProcessingId(id);
    try {
      const res = await fetch(`/api/admin/contracts/${id}/approve`, {
        method: "POST",
      });

      if (!res.ok) {
        const error = await res.json();
        throw new Error(error.error || "승인 실패");
      }

      alert("계약이 승인되었습니다. 이메일로 계약서가 발송됩니다.");
      fetchContracts();
    } catch (error) {
      alert(error instanceof Error ? error.message : "승인 처리 중 오류가 발생했습니다");
    } finally {
      setProcessingId(null);
    }
  };

  const handleReject = async (id: string) => {
    const reason = prompt("거절 사유를 입력해주세요:");
    if (reason === null) return;

    setProcessingId(id);
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
      fetchContracts();
    } catch (error) {
      alert(error instanceof Error ? error.message : "거절 처리 중 오류가 발생했습니다");
    } finally {
      setProcessingId(null);
    }
  };

  const handleDelete = async (id: string, contractNumber: string) => {
    if (!confirm(`계약서 ${contractNumber}를 삭제하시겠습니까?\n이 작업은 되돌릴 수 없습니다.`)) return;

    setProcessingId(id);
    try {
      const res = await fetch(`/api/admin/contracts/${id}`, {
        method: "DELETE",
      });

      const data = await res.json();

      if (!res.ok) {
        throw new Error(data.error || "삭제 실패");
      }

      alert(data.message);
      fetchContracts();
    } catch (error) {
      alert(error instanceof Error ? error.message : "삭제 처리 중 오류가 발생했습니다");
    } finally {
      setProcessingId(null);
    }
  };

  const formatCurrency = (amount: number) => {
    return new Intl.NumberFormat("ko-KR").format(amount) + "원";
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600"></div>
      </div>
    );
  }

  return (
    <div className="space-y-4 lg:space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="text-xl lg:text-2xl font-bold text-gray-900 dark:text-white">계약 관리</h1>
        <button
          onClick={openCreateModal}
          className="flex items-center gap-2 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors text-sm font-medium"
        >
          <Plus className="w-4 h-4" />
          <span className="hidden sm:inline">계약서 생성</span>
        </button>
      </div>

      {/* 통계 카드 */}
      <div className="grid grid-cols-3 lg:grid-cols-6 gap-2 lg:gap-4">
        <Card>
          <CardHeader className="pb-1 lg:pb-2 px-2 lg:px-6 pt-2 lg:pt-6">
            <CardTitle className="text-xs lg:text-sm font-medium">전체</CardTitle>
          </CardHeader>
          <CardContent className="px-2 lg:px-6 pb-2 lg:pb-6">
            <div className="text-lg lg:text-2xl font-bold">{stats?.total || 0}</div>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-1 lg:pb-2 px-2 lg:px-6 pt-2 lg:pt-6">
            <CardTitle className="text-xs lg:text-sm font-medium text-yellow-600">대기</CardTitle>
          </CardHeader>
          <CardContent className="px-2 lg:px-6 pb-2 lg:pb-6">
            <div className="text-lg lg:text-2xl font-bold text-yellow-600">{stats?.submitted || 0}</div>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-1 lg:pb-2 px-2 lg:px-6 pt-2 lg:pt-6">
            <CardTitle className="text-xs lg:text-sm font-medium text-green-600">승인</CardTitle>
          </CardHeader>
          <CardContent className="px-2 lg:px-6 pb-2 lg:pb-6">
            <div className="text-lg lg:text-2xl font-bold text-green-600">{stats?.approved || 0}</div>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-1 lg:pb-2 px-2 lg:px-6 pt-2 lg:pt-6">
            <CardTitle className="text-xs lg:text-sm font-medium text-blue-600">진행</CardTitle>
          </CardHeader>
          <CardContent className="px-2 lg:px-6 pb-2 lg:pb-6">
            <div className="text-lg lg:text-2xl font-bold text-blue-600">{stats?.active || 0}</div>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-1 lg:pb-2 px-2 lg:px-6 pt-2 lg:pt-6">
            <CardTitle className="text-xs lg:text-sm font-medium text-red-600">거절</CardTitle>
          </CardHeader>
          <CardContent className="px-2 lg:px-6 pb-2 lg:pb-6">
            <div className="text-lg lg:text-2xl font-bold text-red-600">{stats?.rejected || 0}</div>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-1 lg:pb-2 px-2 lg:px-6 pt-2 lg:pt-6">
            <CardTitle className="text-xs lg:text-sm font-medium">미제출</CardTitle>
          </CardHeader>
          <CardContent className="px-2 lg:px-6 pb-2 lg:pb-6">
            <div className="text-lg lg:text-2xl font-bold">{stats?.pending || 0}</div>
          </CardContent>
        </Card>
      </div>

      {/* 검색 및 필터 */}
      <div className="flex flex-col gap-3">
        <div className="relative flex-1">
          <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400 w-4 h-4 lg:w-5 lg:h-5" />
          <input
            type="text"
            placeholder="회사명, 계약번호 검색..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="w-full pl-10 pr-4 py-2 text-sm border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-800 text-gray-900 dark:text-white"
          />
        </div>
        <div className="relative">
          <Filter className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400 w-4 h-4" />
          <select
            value={statusFilter}
            onChange={(e) => setStatusFilter(e.target.value)}
            className="w-full sm:w-auto pl-10 pr-8 py-2 text-sm border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-800 text-gray-900 dark:text-white appearance-none"
          >
            <option value="">전체 상태</option>
            <option value="SUBMITTED">승인 대기</option>
            <option value="APPROVED">승인됨</option>
            <option value="ACTIVE">진행중</option>
            <option value="REJECTED">거절됨</option>
            <option value="EXPIRED">만료</option>
          </select>
          <ChevronDown className="absolute right-3 top-1/2 transform -translate-y-1/2 text-gray-400 w-4 h-4" />
        </div>
      </div>

      {/* 계약 목록 */}
      <Card>
        <CardContent className="p-0">
          {contracts.length === 0 ? (
            <div className="p-8 text-center text-gray-500">
              <FileSignature className="w-12 h-12 mx-auto mb-4 text-gray-300" />
              <p>계약 내역이 없습니다.</p>
            </div>
          ) : (
            <>
              {/* 모바일 카드 뷰 */}
              <div className="lg:hidden divide-y divide-gray-200 dark:divide-gray-700">
                {contracts.map((contract) => (
                  <div key={contract.id} className="p-3 space-y-2">
                    <div className="flex items-start justify-between gap-2">
                      <div className="min-w-0 flex-1">
                        <p className="font-medium text-gray-900 dark:text-white truncate">
                          {contract.companyName}
                        </p>
                        <p className="text-xs text-gray-500">{contract.ceoName}</p>
                      </div>
                      <Badge variant={STATUS_COLORS[contract.status]} className="flex-shrink-0">
                        {STATUS_LABELS[contract.status]}
                      </Badge>
                    </div>

                    <div className="flex items-center justify-between text-xs text-gray-500">
                      <span className="font-mono">{contract.contractNumber}</span>
                      <span>{contract.package.displayName} · {contract.contractPeriod}개월</span>
                    </div>

                    <div className="flex items-center justify-between">
                      <div>
                        <p className="text-sm font-medium">{formatCurrency(contract.totalAmount)}</p>
                        <p className="text-xs text-gray-500">{formatDate(contract.createdAt)}</p>
                      </div>

                      <div className="flex items-center gap-1">
                        {contract.status === "SUBMITTED" && (
                          <>
                            <button
                              onClick={() => handleApprove(contract.id)}
                              disabled={processingId === contract.id}
                              className="p-2 text-green-600 hover:bg-green-50 rounded-lg transition-colors disabled:opacity-50"
                              title="승인"
                            >
                              {processingId === contract.id ? (
                                <Loader2 className="w-4 h-4 animate-spin" />
                              ) : (
                                <CheckCircle className="w-4 h-4" />
                              )}
                            </button>
                            <button
                              onClick={() => handleReject(contract.id)}
                              disabled={processingId === contract.id}
                              className="p-2 text-red-600 hover:bg-red-50 rounded-lg transition-colors disabled:opacity-50"
                              title="거절"
                            >
                              <XCircle className="w-4 h-4" />
                            </button>
                          </>
                        )}
                        {["APPROVED", "ACTIVE", "EXPIRED"].includes(contract.status) && (
                          <a
                            href={`/api/contracts/${contract.id}/pdf`}
                            className="p-2 text-blue-600 hover:bg-blue-50 rounded-lg transition-colors"
                            title="PDF 다운로드"
                          >
                            <Download className="w-4 h-4" />
                          </a>
                        )}
                        <a
                          href={`/contracts/${contract.id}`}
                          className="p-2 text-gray-600 hover:bg-gray-100 rounded-lg transition-colors"
                          title="상세보기"
                        >
                          <Eye className="w-4 h-4" />
                        </a>
                        {contract.status !== "ACTIVE" && (
                          <button
                            onClick={() => handleDelete(contract.id, contract.contractNumber)}
                            disabled={processingId === contract.id}
                            className="p-2 text-gray-400 hover:text-red-600 hover:bg-red-50 rounded-lg transition-colors disabled:opacity-50"
                            title="삭제"
                          >
                            <Trash2 className="w-4 h-4" />
                          </button>
                        )}
                      </div>
                    </div>
                  </div>
                ))}
              </div>

              {/* 데스크탑 테이블 뷰 */}
              <div className="hidden lg:block overflow-x-auto">
                <table className="w-full">
                  <thead className="bg-gray-50 dark:bg-gray-800 border-b border-gray-200 dark:border-gray-700">
                    <tr>
                      <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">계약번호</th>
                      <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">회사명</th>
                      <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">패키지</th>
                      <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">금액</th>
                      <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">상태</th>
                      <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">요청일</th>
                      <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">작업</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-gray-200 dark:divide-gray-700">
                    {contracts.map((contract) => (
                      <tr key={contract.id} className="hover:bg-gray-50 dark:hover:bg-gray-800/50">
                        <td className="px-4 py-4">
                          <span className="font-mono text-sm">{contract.contractNumber}</span>
                        </td>
                        <td className="px-4 py-4">
                          <div>
                            <p className="font-medium text-gray-900 dark:text-white">{contract.companyName}</p>
                            <p className="text-sm text-gray-500">{contract.ceoName}</p>
                          </div>
                        </td>
                        <td className="px-4 py-4">
                          <span className="text-sm">{contract.package.displayName}</span>
                          <p className="text-xs text-gray-500">{contract.contractPeriod}개월</p>
                        </td>
                        <td className="px-4 py-4">
                          <p className="font-medium">{formatCurrency(contract.totalAmount)}</p>
                        </td>
                        <td className="px-4 py-4">
                          <Badge variant={STATUS_COLORS[contract.status]}>
                            {STATUS_LABELS[contract.status]}
                          </Badge>
                        </td>
                        <td className="px-4 py-4">
                          <span className="text-sm text-gray-500">{formatDate(contract.createdAt)}</span>
                        </td>
                        <td className="px-4 py-4">
                          <div className="flex items-center gap-2">
                            {contract.status === "SUBMITTED" && (
                              <>
                                <button
                                  onClick={() => handleApprove(contract.id)}
                                  disabled={processingId === contract.id}
                                  className="p-2 text-green-600 hover:bg-green-50 rounded-lg transition-colors disabled:opacity-50"
                                  title="승인"
                                >
                                  {processingId === contract.id ? (
                                    <Loader2 className="w-4 h-4 animate-spin" />
                                  ) : (
                                    <CheckCircle className="w-4 h-4" />
                                  )}
                                </button>
                                <button
                                  onClick={() => handleReject(contract.id)}
                                  disabled={processingId === contract.id}
                                  className="p-2 text-red-600 hover:bg-red-50 rounded-lg transition-colors disabled:opacity-50"
                                  title="거절"
                                >
                                  <XCircle className="w-4 h-4" />
                                </button>
                              </>
                            )}
                            {["APPROVED", "ACTIVE", "EXPIRED"].includes(contract.status) && (
                              <a
                                href={`/api/contracts/${contract.id}/pdf`}
                                className="p-2 text-blue-600 hover:bg-blue-50 rounded-lg transition-colors"
                                title="PDF 다운로드"
                              >
                                <Download className="w-4 h-4" />
                              </a>
                            )}
                            <a
                              href={`/contracts/${contract.id}`}
                              className="p-2 text-gray-600 hover:bg-gray-100 rounded-lg transition-colors"
                              title="상세보기"
                            >
                              <Eye className="w-4 h-4" />
                            </a>
                            {contract.status !== "ACTIVE" && (
                              <button
                                onClick={() => handleDelete(contract.id, contract.contractNumber)}
                                disabled={processingId === contract.id}
                                className="p-2 text-gray-400 hover:text-red-600 hover:bg-red-50 rounded-lg transition-colors disabled:opacity-50"
                                title="삭제"
                              >
                                <Trash2 className="w-4 h-4" />
                              </button>
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
        </CardContent>
      </Card>

      {/* 계약서 생성 모달 */}
      {showCreateModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50">
          <div className="bg-white dark:bg-gray-800 rounded-xl shadow-xl w-full max-w-lg mx-4 max-h-[90vh] overflow-y-auto">
            <div className="flex items-center justify-between p-4 border-b dark:border-gray-700">
              <h2 className="text-lg font-semibold text-gray-900 dark:text-white">계약서 생성</h2>
              <button
                onClick={() => setShowCreateModal(false)}
                className="p-2 text-gray-500 hover:bg-gray-100 dark:hover:bg-gray-700 rounded-lg"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="p-4 space-y-4">
              {/* 사용자 선택 (드롭다운) */}
              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                  브랜드 상호명 선택 <span className="text-red-500">*</span>
                </label>
                {selectedUser ? (
                  <div className="flex items-center justify-between p-3 bg-blue-50 dark:bg-blue-900/20 border border-blue-200 dark:border-blue-800 rounded-lg">
                    <div>
                      <p className="font-medium text-gray-900 dark:text-white">{selectedUser.clientName}</p>
                      <p className="text-sm text-gray-500">{selectedUser.name} · {selectedUser.email}</p>
                    </div>
                    <button
                      onClick={() => setSelectedUser(null)}
                      className="text-gray-500 hover:text-gray-700"
                    >
                      <X className="w-4 h-4" />
                    </button>
                  </div>
                ) : (
                  <div className="relative">
                    <button
                      type="button"
                      onClick={() => setUserDropdownOpen(!userDropdownOpen)}
                      className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-white text-left flex items-center justify-between"
                    >
                      <span className="text-gray-500">
                        {loadingUsers ? "사용자 목록 로딩 중..." : "브랜드 상호명을 선택하세요"}
                      </span>
                      <ChevronDown className={`w-4 h-4 text-gray-400 transition-transform ${userDropdownOpen ? 'rotate-180' : ''}`} />
                    </button>
                    {userDropdownOpen && !loadingUsers && (
                      <div className="absolute z-10 w-full mt-1 bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-lg shadow-lg max-h-60 overflow-y-auto">
                        {allUsers.length === 0 ? (
                          <div className="px-3 py-4 text-center text-gray-500">
                            가입된 사용자가 없습니다.
                          </div>
                        ) : (
                          allUsers.map((user) => (
                            <button
                              key={user.id}
                              onClick={() => {
                                setSelectedUser(user);
                                setUserDropdownOpen(false);
                              }}
                              className="w-full text-left px-3 py-2 hover:bg-gray-100 dark:hover:bg-gray-700 border-b border-gray-100 dark:border-gray-700 last:border-b-0"
                            >
                              <p className="font-medium text-gray-900 dark:text-white">{user.clientName}</p>
                              <p className="text-sm text-gray-500">{user.name} · {user.email}</p>
                            </button>
                          ))
                        )}
                      </div>
                    )}
                  </div>
                )}
              </div>

              {/* 패키지 선택 */}
              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                  패키지 선택 <span className="text-red-500">*</span>
                </label>
                <div className="grid grid-cols-2 gap-2">
                  {packages.map((pkg) => (
                    <button
                      key={pkg.id}
                      onClick={() => handlePackageSelect(pkg)}
                      className={`p-3 text-left border rounded-lg transition-colors ${
                        selectedPackage?.id === pkg.id
                          ? "border-blue-500 bg-blue-50 dark:bg-blue-900/20"
                          : "border-gray-300 dark:border-gray-600 hover:border-blue-300"
                      }`}
                    >
                      <p className="font-medium text-gray-900 dark:text-white">{pkg.displayName}</p>
                      <p className="text-sm text-gray-500">{formatCurrency(pkg.price)}/월</p>
                    </button>
                  ))}
                </div>
              </div>

              {/* 계약 기간 */}
              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                  계약 기간
                </label>
                <select
                  value={contractPeriod}
                  onChange={(e) => setContractPeriod(Number(e.target.value))}
                  className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-white"
                >
                  <option value={6}>6개월</option>
                  <option value={12}>12개월</option>
                  <option value={24}>24개월</option>
                </select>
              </div>

              {/* 월 요금 */}
              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                  월 요금 (원)
                </label>
                <input
                  type="number"
                  value={monthlyFee}
                  onChange={(e) => setMonthlyFee(e.target.value ? Number(e.target.value) : "")}
                  placeholder={selectedPackage ? String(selectedPackage.price) : "패키지 선택 시 자동 입력"}
                  className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-white"
                />
              </div>

              {/* 셋업 비용 */}
              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                  셋업 비용 (원)
                </label>
                <input
                  type="number"
                  value={setupFee}
                  onChange={(e) => setSetupFee(e.target.value ? Number(e.target.value) : "")}
                  placeholder="0"
                  className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-white"
                />
              </div>

              {/* 추가 메모 */}
              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                  추가 메모
                </label>
                <textarea
                  value={additionalNotes}
                  onChange={(e) => setAdditionalNotes(e.target.value)}
                  rows={3}
                  placeholder="특이사항이나 추가 조건을 입력하세요..."
                  className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-white resize-none"
                />
              </div>

              {/* 프로모션 */}
              <div className="p-3 border-2 border-red-300 bg-red-50 dark:bg-red-900/20 rounded-lg">
                <label className="flex items-start gap-3 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={isPromotion}
                    onChange={(e) => setIsPromotion(e.target.checked)}
                    className="mt-1 w-4 h-4 text-red-600 border-red-300 rounded focus:ring-red-500"
                  />
                  <div>
                    <span className="font-medium text-red-600 dark:text-red-400">
                      🎁 최초 10개 프로모션 기업
                    </span>
                    <p className="text-xs text-red-500 dark:text-red-400 mt-1">
                      2년간 Meta 광고 연동 및 자동화 제공 (한정 프로모션)
                    </p>
                  </div>
                </label>
              </div>

              {/* 요약 */}
              {selectedUser && selectedPackage && (
                <div className="p-3 bg-gray-50 dark:bg-gray-700/50 rounded-lg">
                  <p className="text-sm text-gray-600 dark:text-gray-400">
                    <strong>{selectedUser.clientName}</strong>에게{" "}
                    <strong>{selectedPackage.displayName}</strong> 패키지로{" "}
                    <strong>{contractPeriod}개월</strong> 계약서를 발송합니다.
                  </p>
                  <p className="text-sm text-gray-600 dark:text-gray-400 mt-1">
                    계약 금액:{" "}
                    <strong>
                      {formatCurrency(
                        (Number(monthlyFee) || selectedPackage.price) * contractPeriod + (Number(setupFee) || 0)
                      )}
                    </strong>
                    {Number(setupFee) > 0 && <span className="text-gray-400"> (셋업비 포함)</span>}
                  </p>
                </div>
              )}
            </div>

            <div className="flex gap-3 p-4 border-t dark:border-gray-700">
              <button
                onClick={() => setShowCreateModal(false)}
                className="flex-1 px-4 py-2 border border-gray-300 dark:border-gray-600 rounded-lg text-gray-700 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-700"
              >
                취소
              </button>
              <button
                onClick={handleCreateContract}
                disabled={!selectedUser || !selectedPackage || creating}
                className="flex-1 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:bg-gray-400 disabled:cursor-not-allowed flex items-center justify-center gap-2"
              >
                {creating && <Loader2 className="w-4 h-4 animate-spin" />}
                계약서 생성
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
