"use client";

import { useState, useEffect, useCallback } from "react";
import { Card, CardContent, Badge, Button, formatDate } from "@polarad/ui";
import {
  Package,
  ChevronLeft,
  ChevronRight,
  Clock,
  CheckCircle,
  Truck,
  FileImage,
  ShoppingCart,
  Loader2,
  Filter,
  Eye,
} from "lucide-react";
import Link from "next/link";

type WorkflowType =
  | "NAMECARD"
  | "NAMETAG"
  | "CONTRACT"
  | "ENVELOPE"
  | "WEBSITE"
  | "BLOG"
  | "META_ADS"
  | "NAVER_ADS";

type WorkflowStatus =
  | "PENDING"
  | "SUBMITTED"
  | "IN_PROGRESS"
  | "DESIGN_UPLOADED"
  | "ORDER_REQUESTED"
  | "ORDER_APPROVED"
  | "COMPLETED"
  | "SHIPPED"
  | "CANCELLED";

interface Workflow {
  id: string;
  type: WorkflowType;
  status: WorkflowStatus;
  designUrl: string | null;
  trackingNumber: string | null;
  courier: string | null;
  revisionCount: number;
  createdAt: string;
  updatedAt: string;
  user: {
    id: string;
    clientName: string;
    name: string;
    phone: string;
  };
}

interface Stats {
  total: number;
  pending: number;
  submitted: number;
  inProgress: number;
  designUploaded: number;
  orderRequested: number;
  completed: number;
  shipped: number;
}

interface Pagination {
  page: number;
  limit: number;
  total: number;
  totalPages: number;
}

const WORKFLOW_TYPE_LABELS: Record<WorkflowType, string> = {
  NAMECARD: "명함",
  NAMETAG: "명찰",
  CONTRACT: "계약서",
  ENVELOPE: "대봉투",
  WEBSITE: "홈페이지",
  BLOG: "블로그",
  META_ADS: "Meta 광고",
  NAVER_ADS: "네이버 광고",
};

const WORKFLOW_STATUS_LABELS: Record<WorkflowStatus, string> = {
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

const getStatusBadgeVariant = (status: WorkflowStatus) => {
  switch (status) {
    case "PENDING":
      return "secondary";
    case "SUBMITTED":
    case "IN_PROGRESS":
      return "info";
    case "DESIGN_UPLOADED":
    case "ORDER_REQUESTED":
      return "warning";
    case "ORDER_APPROVED":
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

const getStatusIcon = (status: WorkflowStatus) => {
  switch (status) {
    case "PENDING":
      return <Clock className="h-3 w-3 lg:h-4 lg:w-4" />;
    case "DESIGN_UPLOADED":
      return <FileImage className="h-3 w-3 lg:h-4 lg:w-4" />;
    case "ORDER_REQUESTED":
    case "ORDER_APPROVED":
      return <ShoppingCart className="h-3 w-3 lg:h-4 lg:w-4" />;
    case "COMPLETED":
      return <CheckCircle className="h-3 w-3 lg:h-4 lg:w-4" />;
    case "SHIPPED":
      return <Truck className="h-3 w-3 lg:h-4 lg:w-4" />;
    default:
      return <Package className="h-3 w-3 lg:h-4 lg:w-4" />;
  }
};

export default function WorkflowsPage() {
  const [workflows, setWorkflows] = useState<Workflow[]>([]);
  const [stats, setStats] = useState<Stats | null>(null);
  const [pagination, setPagination] = useState<Pagination | null>(null);
  const [loading, setLoading] = useState(true);
  const [typeFilter, setTypeFilter] = useState<WorkflowType | "">("");
  const [statusFilter, setStatusFilter] = useState<WorkflowStatus | "">("");
  const [currentPage, setCurrentPage] = useState(1);

  const fetchWorkflows = useCallback(async () => {
    setLoading(true);
    try {
      const params = new URLSearchParams({
        page: currentPage.toString(),
        limit: "20",
        ...(typeFilter && { type: typeFilter }),
        ...(statusFilter && { status: statusFilter }),
      });

      const res = await fetch(`/api/workflows?${params}`);
      const data = await res.json();

      if (data.success) {
        setWorkflows(data.data);
        setStats(data.stats);
        setPagination(data.pagination);
      }
    } catch (error) {
      console.error("Fetch workflows error:", error);
    } finally {
      setLoading(false);
    }
  }, [currentPage, typeFilter, statusFilter]);

  useEffect(() => {
    fetchWorkflows();
  }, [fetchWorkflows]);

  const handleStatusChange = async (workflowId: string, newStatus: WorkflowStatus) => {
    try {
      const res = await fetch(`/api/workflows/${workflowId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ status: newStatus }),
      });

      if (res.ok) {
        fetchWorkflows();
      }
    } catch (error) {
      console.error("Update workflow error:", error);
    }
  };

  return (
    <div className="space-y-4 lg:space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="text-xl lg:text-2xl font-bold text-gray-900 dark:text-white">워크플로우 관리</h1>
      </div>

      {/* 통계 카드 - 가로 스크롤 */}
      <div className="overflow-x-auto pb-2 -mx-4 px-4 lg:mx-0 lg:px-0">
        <div className="flex lg:grid lg:grid-cols-8 gap-2 lg:gap-3 min-w-max lg:min-w-0">
          <Card
            className="cursor-pointer hover:shadow-md transition-shadow flex-shrink-0 w-20 lg:w-auto"
            onClick={() => setStatusFilter("")}
          >
            <CardContent className="pt-2 pb-2 lg:pt-4 lg:pb-3 px-2 lg:px-4">
              <p className="text-[10px] lg:text-xs text-muted-foreground">전체</p>
              <p className="text-lg lg:text-xl font-bold">{stats?.total || 0}</p>
            </CardContent>
          </Card>
          <Card
            className="cursor-pointer hover:shadow-md transition-shadow flex-shrink-0 w-20 lg:w-auto"
            onClick={() => setStatusFilter("PENDING")}
          >
            <CardContent className="pt-2 pb-2 lg:pt-4 lg:pb-3 px-2 lg:px-4">
              <p className="text-[10px] lg:text-xs text-muted-foreground">대기</p>
              <p className="text-lg lg:text-xl font-bold text-gray-500">{stats?.pending || 0}</p>
            </CardContent>
          </Card>
          <Card
            className="cursor-pointer hover:shadow-md transition-shadow flex-shrink-0 w-20 lg:w-auto"
            onClick={() => setStatusFilter("SUBMITTED")}
          >
            <CardContent className="pt-2 pb-2 lg:pt-4 lg:pb-3 px-2 lg:px-4">
              <p className="text-[10px] lg:text-xs text-muted-foreground">제출</p>
              <p className="text-lg lg:text-xl font-bold text-blue-600">{stats?.submitted || 0}</p>
            </CardContent>
          </Card>
          <Card
            className="cursor-pointer hover:shadow-md transition-shadow flex-shrink-0 w-20 lg:w-auto"
            onClick={() => setStatusFilter("IN_PROGRESS")}
          >
            <CardContent className="pt-2 pb-2 lg:pt-4 lg:pb-3 px-2 lg:px-4">
              <p className="text-[10px] lg:text-xs text-muted-foreground">진행</p>
              <p className="text-lg lg:text-xl font-bold text-blue-600">{stats?.inProgress || 0}</p>
            </CardContent>
          </Card>
          <Card
            className="cursor-pointer hover:shadow-md transition-shadow flex-shrink-0 w-20 lg:w-auto"
            onClick={() => setStatusFilter("DESIGN_UPLOADED")}
          >
            <CardContent className="pt-2 pb-2 lg:pt-4 lg:pb-3 px-2 lg:px-4">
              <p className="text-[10px] lg:text-xs text-muted-foreground">시안</p>
              <p className="text-lg lg:text-xl font-bold text-yellow-600">{stats?.designUploaded || 0}</p>
            </CardContent>
          </Card>
          <Card
            className="cursor-pointer hover:shadow-md transition-shadow flex-shrink-0 w-20 lg:w-auto"
            onClick={() => setStatusFilter("ORDER_REQUESTED")}
          >
            <CardContent className="pt-2 pb-2 lg:pt-4 lg:pb-3 px-2 lg:px-4">
              <p className="text-[10px] lg:text-xs text-muted-foreground">발주</p>
              <p className="text-lg lg:text-xl font-bold text-orange-600">{stats?.orderRequested || 0}</p>
            </CardContent>
          </Card>
          <Card
            className="cursor-pointer hover:shadow-md transition-shadow flex-shrink-0 w-20 lg:w-auto"
            onClick={() => setStatusFilter("COMPLETED")}
          >
            <CardContent className="pt-2 pb-2 lg:pt-4 lg:pb-3 px-2 lg:px-4">
              <p className="text-[10px] lg:text-xs text-muted-foreground">완료</p>
              <p className="text-lg lg:text-xl font-bold text-green-600">{stats?.completed || 0}</p>
            </CardContent>
          </Card>
          <Card
            className="cursor-pointer hover:shadow-md transition-shadow flex-shrink-0 w-20 lg:w-auto"
            onClick={() => setStatusFilter("SHIPPED")}
          >
            <CardContent className="pt-2 pb-2 lg:pt-4 lg:pb-3 px-2 lg:px-4">
              <p className="text-[10px] lg:text-xs text-muted-foreground">발송</p>
              <p className="text-lg lg:text-xl font-bold text-green-600">{stats?.shipped || 0}</p>
            </CardContent>
          </Card>
        </div>
      </div>

      {/* 유형 필터 */}
      <Card>
        <CardContent className="p-3 lg:pt-6 lg:px-6 lg:pb-6">
          <div className="flex items-start gap-2">
            <Filter className="h-4 w-4 text-muted-foreground mt-1 flex-shrink-0" />
            <div className="flex flex-wrap gap-1.5">
              <Button
                variant={typeFilter === "" ? "default" : "outline"}
                size="sm"
                onClick={() => {
                  setTypeFilter("");
                  setCurrentPage(1);
                }}
                className="text-xs h-7 px-2"
              >
                전체
              </Button>
              {(Object.keys(WORKFLOW_TYPE_LABELS) as WorkflowType[]).map((type) => (
                <Button
                  key={type}
                  variant={typeFilter === type ? "default" : "outline"}
                  size="sm"
                  onClick={() => {
                    setTypeFilter(type);
                    setCurrentPage(1);
                  }}
                  className="text-xs h-7 px-2"
                >
                  {WORKFLOW_TYPE_LABELS[type]}
                </Button>
              ))}
            </div>
          </div>
        </CardContent>
      </Card>

      {/* 워크플로우 목록 */}
      <Card>
        <CardContent className="p-3 lg:pt-6 lg:px-6 lg:pb-6">
          {loading ? (
            <div className="flex items-center justify-center py-12">
              <Loader2 className="h-8 w-8 animate-spin text-blue-600" />
            </div>
          ) : workflows.length === 0 ? (
            <div className="text-center py-12 text-muted-foreground">워크플로우가 없습니다.</div>
          ) : (
            <>
              {/* 모바일 카드 뷰 */}
              <div className="lg:hidden space-y-3">
                {workflows.map((workflow) => (
                  <div
                    key={workflow.id}
                    className="p-3 bg-gray-50 dark:bg-gray-800 rounded-lg space-y-2"
                  >
                    <div className="flex items-start justify-between gap-2">
                      <div className="min-w-0 flex-1">
                        <p className="font-medium text-gray-900 dark:text-white truncate">
                          {workflow.user.clientName}
                        </p>
                        <p className="text-xs text-muted-foreground">
                          {workflow.user.name} • {workflow.user.phone}
                        </p>
                      </div>
                      <Badge variant="secondary" className="flex-shrink-0 text-xs">
                        {WORKFLOW_TYPE_LABELS[workflow.type]}
                      </Badge>
                    </div>

                    <div className="flex items-center justify-between">
                      <Badge variant={getStatusBadgeVariant(workflow.status)}>
                        <span className="flex items-center gap-1">
                          {getStatusIcon(workflow.status)}
                          {WORKFLOW_STATUS_LABELS[workflow.status]}
                        </span>
                      </Badge>
                      {workflow.revisionCount > 0 && (
                        <span className="text-xs text-orange-600">수정 {workflow.revisionCount}회</span>
                      )}
                    </div>

                    <div className="flex items-center justify-between pt-2 border-t border-gray-200 dark:border-gray-700">
                      <span className="text-xs text-muted-foreground">
                        {formatDate(workflow.updatedAt)}
                      </span>
                      <div className="flex items-center gap-2">
                        <select
                          value={workflow.status}
                          onChange={(e) =>
                            handleStatusChange(workflow.id, e.target.value as WorkflowStatus)
                          }
                          className="text-xs border rounded-md px-2 py-1 bg-white dark:bg-gray-800"
                        >
                          {(Object.keys(WORKFLOW_STATUS_LABELS) as WorkflowStatus[]).map(
                            (status) => (
                              <option key={status} value={status}>
                                {WORKFLOW_STATUS_LABELS[status]}
                              </option>
                            )
                          )}
                        </select>
                        <Link href={`/workflows/${workflow.id}`}>
                          <Button variant="ghost" size="sm" className="h-8 w-8 p-0">
                            <Eye className="h-4 w-4" />
                          </Button>
                        </Link>
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
                      <th className="text-left py-3 px-4 font-medium text-muted-foreground">유형</th>
                      <th className="text-left py-3 px-4 font-medium text-muted-foreground">상태</th>
                      <th className="text-left py-3 px-4 font-medium text-muted-foreground">
                        수정횟수
                      </th>
                      <th className="text-left py-3 px-4 font-medium text-muted-foreground">
                        업데이트
                      </th>
                      <th className="text-right py-3 px-4 font-medium text-muted-foreground">관리</th>
                    </tr>
                  </thead>
                  <tbody>
                    {workflows.map((workflow) => (
                      <tr
                        key={workflow.id}
                        className="border-b hover:bg-gray-50 dark:hover:bg-gray-800/50"
                      >
                        <td className="py-3 px-4">
                          <div>
                            <p className="font-medium text-gray-900 dark:text-white">
                              {workflow.user.clientName}
                            </p>
                            <p className="text-sm text-muted-foreground">
                              {workflow.user.name} • {workflow.user.phone}
                            </p>
                          </div>
                        </td>
                        <td className="py-3 px-4">
                          <Badge variant="secondary">{WORKFLOW_TYPE_LABELS[workflow.type]}</Badge>
                        </td>
                        <td className="py-3 px-4">
                          <Badge variant={getStatusBadgeVariant(workflow.status)}>
                            <span className="flex items-center gap-1">
                              {getStatusIcon(workflow.status)}
                              {WORKFLOW_STATUS_LABELS[workflow.status]}
                            </span>
                          </Badge>
                        </td>
                        <td className="py-3 px-4">
                          {workflow.revisionCount > 0 && (
                            <span className="text-sm text-orange-600">{workflow.revisionCount}회</span>
                          )}
                        </td>
                        <td className="py-3 px-4 text-sm text-muted-foreground">
                          {formatDate(workflow.updatedAt)}
                        </td>
                        <td className="py-3 px-4 text-right">
                          <div className="flex items-center justify-end gap-2">
                            <select
                              value={workflow.status}
                              onChange={(e) =>
                                handleStatusChange(workflow.id, e.target.value as WorkflowStatus)
                              }
                              className="text-sm border rounded-md px-2 py-1 bg-white dark:bg-gray-800"
                            >
                              {(Object.keys(WORKFLOW_STATUS_LABELS) as WorkflowStatus[]).map(
                                (status) => (
                                  <option key={status} value={status}>
                                    {WORKFLOW_STATUS_LABELS[status]}
                                  </option>
                                )
                              )}
                            </select>
                            <Link href={`/workflows/${workflow.id}`}>
                              <Button variant="ghost" size="sm">
                                <Eye className="h-4 w-4" />
                              </Button>
                            </Link>
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
                총 {pagination.total}개 중 {(pagination.page - 1) * pagination.limit + 1}-
                {Math.min(pagination.page * pagination.limit, pagination.total)}개
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
