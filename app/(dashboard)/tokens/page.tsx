"use client";

import { useState, useEffect } from "react";
import {
  Button,
  Badge,
  Card,
  CardContent,
  CardHeader,
  CardTitle,
  CardDescription,
  formatDate,
  getDaysUntilExpiry,
} from "@polarad/ui";
import { RefreshCw, AlertTriangle, Clock, XCircle } from "lucide-react";

interface TokenClient {
  id: string;
  clientId: string;
  clientName: string;
  email: string;
  tokenExpiresAt: string | null;
  authStatus: string;
  telegramEnabled: boolean;
}

interface TokenData {
  expiring: TokenClient[];
  expired: TokenClient[];
  authRequired: TokenClient[];
}

interface TokenStats {
  expiring: number;
  expired: number;
  authRequired: number;
  critical: number;
}

export default function TokensPage() {
  const [data, setData] = useState<TokenData | null>(null);
  const [stats, setStats] = useState<TokenStats | null>(null);
  const [loading, setLoading] = useState(true);
  const [activeTab, setActiveTab] = useState<"expiring" | "expired" | "authRequired">("expiring");

  async function fetchTokens() {
    setLoading(true);
    try {
      const res = await fetch("/api/tokens");
      const result = await res.json();

      if (result.success) {
        setData(result.data);
        setStats(result.stats);
      }
    } catch (error) {
      console.error("Tokens fetch error:", error);
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    fetchTokens();
  }, []);

  function getClients(): TokenClient[] {
    if (!data) return [];
    return data[activeTab] || [];
  }

  return (
    <div className="space-y-4 lg:space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
        <h1 className="text-xl lg:text-2xl font-bold text-gray-900 dark:text-white">토큰/인증 관리</h1>
        <Button variant="outline" onClick={fetchTokens} className="w-full sm:w-auto">
          <RefreshCw className="w-4 h-4 mr-2" />
          새로고침
        </Button>
      </div>

      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 lg:gap-4">
        <Card
          className={`cursor-pointer transition-colors ${
            activeTab === "expiring" ? "ring-2 ring-yellow-500" : ""
          }`}
          onClick={() => setActiveTab("expiring")}
        >
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2 p-3 lg:p-6 lg:pb-2">
            <CardTitle className="text-xs lg:text-sm font-medium">만료 임박</CardTitle>
            <Clock className="h-4 w-4 text-yellow-500" />
          </CardHeader>
          <CardContent className="p-3 pt-0 lg:p-6 lg:pt-0">
            <div className="text-xl lg:text-2xl font-bold text-yellow-600">{stats?.expiring || 0}</div>
            <p className="text-xs text-muted-foreground hidden sm:block">14일 이내 만료</p>
          </CardContent>
        </Card>

        <Card className="bg-red-50 dark:bg-red-900/20">
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2 p-3 lg:p-6 lg:pb-2">
            <CardTitle className="text-xs lg:text-sm font-medium">긴급</CardTitle>
            <AlertTriangle className="h-4 w-4 text-red-500" />
          </CardHeader>
          <CardContent className="p-3 pt-0 lg:p-6 lg:pt-0">
            <div className="text-xl lg:text-2xl font-bold text-red-600">{stats?.critical || 0}</div>
            <p className="text-xs text-muted-foreground hidden sm:block">3일 이내</p>
          </CardContent>
        </Card>

        <Card
          className={`cursor-pointer transition-colors ${
            activeTab === "expired" ? "ring-2 ring-red-500" : ""
          }`}
          onClick={() => setActiveTab("expired")}
        >
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2 p-3 lg:p-6 lg:pb-2">
            <CardTitle className="text-xs lg:text-sm font-medium">만료됨</CardTitle>
            <XCircle className="h-4 w-4 text-red-500" />
          </CardHeader>
          <CardContent className="p-3 pt-0 lg:p-6 lg:pt-0">
            <div className="text-xl lg:text-2xl font-bold text-red-600">{stats?.expired || 0}</div>
            <p className="text-xs text-muted-foreground hidden sm:block">갱신 필요</p>
          </CardContent>
        </Card>

        <Card
          className={`cursor-pointer transition-colors ${
            activeTab === "authRequired" ? "ring-2 ring-orange-500" : ""
          }`}
          onClick={() => setActiveTab("authRequired")}
        >
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2 p-3 lg:p-6 lg:pb-2">
            <CardTitle className="text-xs lg:text-sm font-medium">재인증</CardTitle>
            <AlertTriangle className="h-4 w-4 text-orange-500" />
          </CardHeader>
          <CardContent className="p-3 pt-0 lg:p-6 lg:pt-0">
            <div className="text-xl lg:text-2xl font-bold text-orange-600">{stats?.authRequired || 0}</div>
            <p className="text-xs text-muted-foreground hidden sm:block">Meta 재연동</p>
          </CardContent>
        </Card>
      </div>

      <Card>
        <CardHeader className="pb-3 lg:pb-6">
          <CardTitle className="text-base lg:text-lg">
            {activeTab === "expiring" && "토큰 만료 임박 클라이언트"}
            {activeTab === "expired" && "토큰 만료된 클라이언트"}
            {activeTab === "authRequired" && "재인증 필요 클라이언트"}
          </CardTitle>
          <CardDescription className="text-xs lg:text-sm">
            {activeTab === "expiring" && "14일 이내 토큰이 만료되는 클라이언트 목록입니다."}
            {activeTab === "expired" && "토큰이 이미 만료된 클라이언트 목록입니다."}
            {activeTab === "authRequired" && "Meta 재인증이 필요한 클라이언트 목록입니다."}
          </CardDescription>
        </CardHeader>
        <CardContent>
          {loading ? (
            <div className="flex items-center justify-center h-32">
              <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600"></div>
            </div>
          ) : getClients().length === 0 ? (
            <p className="text-center text-muted-foreground py-8">해당 클라이언트가 없습니다.</p>
          ) : (
            <div className="space-y-3">
              {getClients().map((client) => {
                const days = getDaysUntilExpiry(client.tokenExpiresAt);
                return (
                  <div
                    key={client.id}
                    className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 p-3 lg:p-4 bg-gray-50 dark:bg-gray-800 rounded-lg"
                  >
                    <div className="min-w-0 flex-1">
                      <p className="font-medium text-gray-900 dark:text-white">{client.clientName}</p>
                      <p className="text-sm text-muted-foreground truncate">
                        {client.clientId} | {client.email}
                      </p>
                    </div>
                    <div className="flex items-center justify-between sm:justify-end gap-3 sm:gap-4">
                      <div className="text-left sm:text-right">
                        <Badge
                          variant={
                            days === null
                              ? "secondary"
                              : days <= 0
                              ? "error"
                              : days <= 3
                              ? "error"
                              : days <= 7
                              ? "warning"
                              : "info"
                          }
                        >
                          {days === null ? "날짜 없음" : days <= 0 ? "만료됨" : `${days}일 남음`}
                        </Badge>
                        <p className="text-xs text-muted-foreground mt-1">
                          {formatDate(client.tokenExpiresAt)}
                        </p>
                      </div>
                      <Button size="sm" variant="outline">
                        상세
                      </Button>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
