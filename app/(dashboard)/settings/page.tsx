"use client";

import { useState, useEffect } from "react";
import { Card, CardContent, CardHeader, CardTitle, Button, Input, Label } from "@polarad/ui";
import {
  Settings,
  Bell,
  Key,
  Save,
  Loader2,
  CheckCircle,
  AlertCircle,
  Send,
} from "lucide-react";

interface NotificationSettings {
  telegramBotToken: string;
  defaultChatId: string;
  emailSenderAddress: string;
  emailSenderName: string;
}

export default function SettingsPage() {
  const [settings, setSettings] = useState<NotificationSettings>({
    telegramBotToken: "",
    defaultChatId: "",
    emailSenderAddress: "",
    emailSenderName: "Polarad",
  });
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [saveStatus, setSaveStatus] = useState<"idle" | "success" | "error">("idle");
  const [testStatus, setTestStatus] = useState<"idle" | "loading" | "success" | "error">("idle");
  const [testMessage, setTestMessage] = useState("");

  useEffect(() => {
    const fetchSettings = async () => {
      try {
        const response = await fetch("/api/admin/settings");
        const result = await response.json();
        if (result.success && result.data) {
          setSettings({
            telegramBotToken: result.data.telegram_bot_token || "",
            defaultChatId: result.data.telegram_default_chat_id || "",
            emailSenderAddress: result.data.email_sender_address || "",
            emailSenderName: result.data.email_sender_name || "Polarad",
          });
        }
      } catch (error) {
        console.error("Failed to fetch settings:", error);
      } finally {
        setLoading(false);
      }
    };
    fetchSettings();
  }, []);

  const handleSave = async () => {
    setSaving(true);
    setSaveStatus("idle");
    try {
      const response = await fetch("/api/admin/settings", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          settings: {
            telegram_bot_token: settings.telegramBotToken,
            telegram_default_chat_id: settings.defaultChatId,
            email_sender_address: settings.emailSenderAddress,
            email_sender_name: settings.emailSenderName,
          },
        }),
      });
      const result = await response.json();
      if (result.success) {
        setSaveStatus("success");
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
  };

  const handleTestTelegram = async () => {
    if (!settings.telegramBotToken || !settings.defaultChatId) {
      alert("텔레그램 Bot Token과 Chat ID를 입력해주세요.");
      return;
    }
    setTestStatus("loading");
    setTestMessage("");
    try {
      const response = await fetch(
        `https://api.telegram.org/bot${settings.telegramBotToken}/sendMessage`,
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            chat_id: settings.defaultChatId,
            text: "Polarad 텔레그램 연동 테스트 메시지입니다.",
            parse_mode: "HTML",
          }),
        }
      );
      const result = await response.json();
      if (result.ok) {
        setTestStatus("success");
        setTestMessage("테스트 메시지가 성공적으로 전송되었습니다.");
      } else {
        setTestStatus("error");
        setTestMessage(result.description || "전송에 실패했습니다.");
      }
    } catch (error) {
      setTestStatus("error");
      setTestMessage("네트워크 오류가 발생했습니다.");
      console.error("Telegram test error:", error);
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
      </div>
    );
  }

  return (
    <div className="space-y-4 lg:space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="text-xl lg:text-2xl font-bold text-gray-900 dark:text-white flex items-center gap-2">
          <Settings className="h-5 w-5 lg:h-6 lg:w-6" />
          설정
        </h1>
      </div>

      <Card>
        <CardHeader className="pb-3 lg:pb-6">
          <CardTitle className="flex items-center gap-2 text-base lg:text-lg">
            <Bell className="h-4 w-4 lg:h-5 lg:w-5" />
            텔레그램 알림 설정
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid grid-cols-1 gap-4">
            <div>
              <Label htmlFor="telegramBotToken" className="text-sm">Bot Token</Label>
              <Input
                id="telegramBotToken"
                type="password"
                value={settings.telegramBotToken}
                onChange={(e) => setSettings({ ...settings, telegramBotToken: e.target.value })}
                placeholder="1234567890:ABCdefGHIjklMNOpqrsTUVwxyz"
                className="mt-1"
              />
              <p className="text-xs text-muted-foreground mt-1">
                @BotFather에서 생성한 봇의 토큰
              </p>
            </div>
            <div>
              <Label htmlFor="defaultChatId" className="text-sm">기본 Chat ID</Label>
              <Input
                id="defaultChatId"
                value={settings.defaultChatId}
                onChange={(e) => setSettings({ ...settings, defaultChatId: e.target.value })}
                placeholder="-1001234567890"
                className="mt-1"
              />
              <p className="text-xs text-muted-foreground mt-1">알림을 받을 채팅방/그룹 ID</p>
            </div>
          </div>
          <div className="flex flex-col sm:flex-row sm:items-center gap-3">
            <Button
              variant="outline"
              onClick={handleTestTelegram}
              disabled={testStatus === "loading"}
              className="w-full sm:w-auto"
            >
              {testStatus === "loading" ? (
                <Loader2 className="h-4 w-4 animate-spin mr-2" />
              ) : (
                <Send className="h-4 w-4 mr-2" />
              )}
              테스트 메시지 전송
            </Button>
            {testStatus === "success" && (
              <div className="flex items-center gap-2 text-green-600">
                <CheckCircle className="h-4 w-4 flex-shrink-0" />
                <span className="text-sm">{testMessage}</span>
              </div>
            )}
            {testStatus === "error" && (
              <div className="flex items-center gap-2 text-red-600">
                <AlertCircle className="h-4 w-4 flex-shrink-0" />
                <span className="text-sm">{testMessage}</span>
              </div>
            )}
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader className="pb-3 lg:pb-6">
          <CardTitle className="flex items-center gap-2 text-base lg:text-lg">
            <Key className="h-4 w-4 lg:h-5 lg:w-5" />
            이메일 설정
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid grid-cols-1 gap-4">
            <div>
              <Label htmlFor="emailSenderAddress" className="text-sm">발신 이메일 주소</Label>
              <Input
                id="emailSenderAddress"
                type="email"
                value={settings.emailSenderAddress}
                onChange={(e) => setSettings({ ...settings, emailSenderAddress: e.target.value })}
                placeholder="noreply@polarad.kr"
                className="mt-1"
              />
            </div>
            <div>
              <Label htmlFor="emailSenderName" className="text-sm">발신자명</Label>
              <Input
                id="emailSenderName"
                value={settings.emailSenderName}
                onChange={(e) => setSettings({ ...settings, emailSenderName: e.target.value })}
                placeholder="Polarad"
                className="mt-1"
              />
            </div>
          </div>
          <p className="text-xs lg:text-sm text-muted-foreground">
            이메일 발송 기능은 SMTP 서버 또는 외부 서비스 연동이 필요합니다.
          </p>
        </CardContent>
      </Card>

      <Card>
        <CardHeader className="pb-3 lg:pb-6">
          <CardTitle className="text-base lg:text-lg">시스템 정보</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-2 gap-4 text-sm">
            <div>
              <p className="text-muted-foreground text-xs lg:text-sm">버전</p>
              <p className="font-medium">1.0.0</p>
            </div>
            <div>
              <p className="text-muted-foreground text-xs lg:text-sm">환경</p>
              <p className="font-medium">
                {process.env.NODE_ENV === "production" ? "운영" : "개발"}
              </p>
            </div>
            <div>
              <p className="text-muted-foreground text-xs lg:text-sm">데이터베이스</p>
              <p className="font-medium">PostgreSQL</p>
            </div>
            <div>
              <p className="text-muted-foreground text-xs lg:text-sm">프레임워크</p>
              <p className="font-medium">Next.js 15</p>
            </div>
          </div>
        </CardContent>
      </Card>

      <div className="flex flex-col-reverse sm:flex-row items-stretch sm:items-center justify-end gap-3">
        {saveStatus === "success" && (
          <div className="flex items-center justify-center gap-2 text-green-600">
            <CheckCircle className="h-4 w-4" />
            <span className="text-sm">설정이 저장되었습니다.</span>
          </div>
        )}
        {saveStatus === "error" && (
          <div className="flex items-center justify-center gap-2 text-red-600">
            <AlertCircle className="h-4 w-4" />
            <span className="text-sm">저장에 실패했습니다.</span>
          </div>
        )}
        <Button onClick={handleSave} disabled={saving} className="w-full sm:w-auto">
          {saving ? (
            <Loader2 className="h-4 w-4 animate-spin mr-2" />
          ) : (
            <Save className="h-4 w-4 mr-2" />
          )}
          설정 저장
        </Button>
      </div>
    </div>
  );
}
