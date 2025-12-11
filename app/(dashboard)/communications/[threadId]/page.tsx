"use client";

import { useState, useEffect, useRef } from "react";
import { useParams, useRouter } from "next/navigation";
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
  Badge,
  Button,
  Input,
} from "@polarad/ui";
import {
  ArrowLeft,
  Send,
  Clock,
  CheckCircle,
  AlertCircle,
  User,
  Shield,
  Calendar,
  Loader2,
  Palette,
  Paperclip,
  X,
  ExternalLink,
} from "lucide-react";
import Link from "next/link";

interface Message {
  id: string;
  authorType: string;
  authorName: string;
  content: string;
  attachments?: string[];
  createdAt: string;
  expectedCompletionDate?: string;
}

interface Thread {
  id: string;
  title: string;
  category: string;
  status: "OPEN" | "IN_PROGRESS" | "RESOLVED";
  expectedCompletionDate?: string;
  createdAt: string;
  user: {
    id: string;
    name: string;
    clientName: string;
    email: string;
    phone: string;
  };
  messages: Message[];
}

const statusConfig = {
  OPEN: { label: "대기중", variant: "warning" as const, icon: AlertCircle },
  IN_PROGRESS: { label: "진행중", variant: "info" as const, icon: Clock },
  RESOLVED: { label: "완료", variant: "success" as const, icon: CheckCircle },
};

export default function ThreadDetailPage() {
  const params = useParams();
  const router = useRouter();
  const threadId = params.threadId as string;

  const [thread, setThread] = useState<Thread | null>(null);
  const [loading, setLoading] = useState(true);
  const [newMessage, setNewMessage] = useState("");
  const [attachments, setAttachments] = useState<{ name: string; url: string }[]>([]);
  const [uploading, setUploading] = useState(false);
  const [expectedDate, setExpectedDate] = useState("");
  const [changeStatus, setChangeStatus] = useState<string>("");
  const [sending, setSending] = useState(false);
  const [updating, setUpdating] = useState(false);
  const [creatingDesign, setCreatingDesign] = useState(false);
  const [showDesignModal, setShowDesignModal] = useState(false);
  const [selectedWorkflowType, setSelectedWorkflowType] = useState("");
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const WORKFLOW_TYPES = [
    { value: "NAMECARD", label: "명함" },
    { value: "NAMETAG", label: "명찰" },
    { value: "CONTRACT", label: "계약서" },
    { value: "ENVELOPE", label: "대봉투" },
    { value: "WEBSITE", label: "홈페이지" },
    { value: "BLOG", label: "블로그" },
    { value: "META_ADS", label: "메타광고" },
    { value: "NAVER_ADS", label: "네이버광고" },
  ];

  useEffect(() => {
    fetchThread();
  }, [threadId]);

  useEffect(() => {
    scrollToBottom();
  }, [thread?.messages]);

  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  };

  const fetchThread = async () => {
    try {
      const res = await fetch(`/api/admin/communications/${threadId}`);
      const data = await res.json();

      if (!res.ok) {
        throw new Error(data.error);
      }

      setThread(data.data);
    } catch (error) {
      console.error("Failed to fetch thread:", error);
      router.push("/communications");
    } finally {
      setLoading(false);
    }
  };

  const handleSend = async () => {
    if (!newMessage.trim() || sending) return;

    setSending(true);

    try {
      const res = await fetch(`/api/admin/communications/${threadId}/messages`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          content: newMessage,
          attachments: attachments.length > 0 ? attachments.map((a) => a.url) : undefined,
          expectedCompletionDate: expectedDate || undefined,
          changeStatus: changeStatus || undefined,
        }),
      });

      const data = await res.json();

      if (!res.ok) {
        throw new Error(data.error);
      }

      setNewMessage("");
      setAttachments([]);
      setExpectedDate("");
      setChangeStatus("");
      fetchThread();
    } catch (error) {
      console.error("Failed to send message:", error);
      alert("메시지 전송에 실패했습니다.");
    } finally {
      setSending(false);
    }
  };

  const handleFileUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = e.target.files;
    if (!files || files.length === 0) return;

    setUploading(true);

    try {
      for (const file of Array.from(files)) {
        // 파일 크기 체크 (10MB)
        if (file.size > 10 * 1024 * 1024) {
          alert(`${file.name}: 파일 크기는 10MB 이하만 가능합니다.`);
          continue;
        }

        // Presigned URL 요청
        const presignedRes = await fetch("/api/upload", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            fileName: file.name,
            contentType: file.type,
            category: "communications",
          }),
        });

        const presignedData = await presignedRes.json();

        if (!presignedRes.ok) {
          alert(`${file.name}: ${presignedData.error}`);
          continue;
        }

        // R2에 파일 업로드
        const uploadRes = await fetch(presignedData.uploadUrl, {
          method: "PUT",
          body: file,
          headers: {
            "Content-Type": file.type,
          },
        });

        if (!uploadRes.ok) {
          alert(`${file.name}: 파일 업로드에 실패했습니다.`);
          continue;
        }

        // 첨부파일 목록에 추가
        setAttachments((prev) => [...prev, { name: file.name, url: presignedData.publicUrl }]);
      }
    } catch (error) {
      console.error("File upload error:", error);
      alert("파일 업로드 중 오류가 발생했습니다.");
    } finally {
      setUploading(false);
      // 파일 입력 초기화
      if (fileInputRef.current) {
        fileInputRef.current.value = "";
      }
    }
  };

  const handleRemoveAttachment = (index: number) => {
    setAttachments(attachments.filter((_, i) => i !== index));
  };

  const handleCreateDesign = async () => {
    if (!thread || !selectedWorkflowType) {
      alert("시안 유형을 선택해주세요.");
      return;
    }

    setCreatingDesign(true);

    try {
      // 문의 내용 요약 생성
      const firstUserMessage = thread.messages.find((m) => m.authorType === "user");
      const initialContent = firstUserMessage?.content || thread.title;

      const res = await fetch("/api/admin/designs", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          userId: thread.user.id,
          workflowType: selectedWorkflowType,
          threadId: thread.id,
          initialContent,
        }),
      });

      const data = await res.json();

      if (!res.ok) {
        throw new Error(data.error);
      }

      setShowDesignModal(false);

      if (data.existing) {
        alert("이미 해당 유형의 시안이 존재합니다. 기존 시안으로 이동합니다.");
      } else {
        alert("시안이 생성되었습니다.");
        fetchThread(); // 스레드 새로고침 (자동 메시지 추가됨)
      }

      // 시안 상세 페이지로 이동
      router.push(`/designs/${data.data.id}`);
    } catch (error) {
      console.error("Failed to create design:", error);
      alert(error instanceof Error ? error.message : "시안 생성에 실패했습니다.");
    } finally {
      setCreatingDesign(false);
    }
  };

  const handleStatusChange = async (newStatus: string) => {
    setUpdating(true);
    try {
      const res = await fetch(`/api/admin/communications/${threadId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ status: newStatus }),
      });

      const data = await res.json();

      if (!res.ok) {
        throw new Error(data.error);
      }

      fetchThread();
    } catch (error) {
      console.error("Failed to update status:", error);
      alert("상태 변경에 실패했습니다.");
    } finally {
      setUpdating(false);
    }
  };

  const handleKeyPress = (e: React.KeyboardEvent) => {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      handleSend();
    }
  };

  const formatDate = (dateString: string) => {
    const date = new Date(dateString);
    return date.toLocaleDateString("ko-KR", {
      year: "numeric",
      month: "long",
      day: "numeric",
      hour: "2-digit",
      minute: "2-digit",
    });
  };

  const formatShortDate = (dateString: string) => {
    const date = new Date(dateString);
    return date.toLocaleDateString("ko-KR", {
      month: "short",
      day: "numeric",
    });
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <Loader2 className="h-8 w-8 animate-spin text-blue-600" />
      </div>
    );
  }

  if (!thread) {
    return (
      <div className="text-center py-12">
        <p className="text-muted-foreground">스레드를 찾을 수 없습니다</p>
        <Link href="/communications" className="text-blue-600 hover:underline mt-4 inline-block">
          목록으로 돌아가기
        </Link>
      </div>
    );
  }

  const StatusIcon = statusConfig[thread.status].icon;

  return (
    <div className="space-y-4 lg:space-y-6">
      {/* 헤더 */}
      <div className="flex items-start gap-4">
        <Link
          href="/communications"
          className="p-2 hover:bg-gray-100 dark:hover:bg-gray-800 rounded-lg transition-colors"
        >
          <ArrowLeft className="w-5 h-5" />
        </Link>
        <div className="flex-1">
          <div className="flex items-center gap-2 mb-1">
            <Badge variant={statusConfig[thread.status].variant} className="flex items-center gap-1">
              <StatusIcon className="h-3 w-3" />
              {statusConfig[thread.status].label}
            </Badge>
            <span className="text-sm text-muted-foreground">{thread.category}</span>
          </div>
          <h1 className="text-xl lg:text-2xl font-bold text-gray-900 dark:text-white">
            {thread.title}
          </h1>
          <div className="flex items-center gap-4 mt-2 text-sm text-muted-foreground">
            <span>{thread.user.clientName} · {thread.user.name}</span>
            <span>{thread.user.phone}</span>
          </div>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4 lg:gap-6">
        {/* 메시지 영역 */}
        <div className="lg:col-span-2 flex flex-col h-[calc(100vh-16rem)]">
          {/* 메시지 목록 */}
          <Card className="flex-1 overflow-hidden">
            <CardContent className="p-0 h-full overflow-y-auto">
              <div className="p-4 space-y-4">
                {thread.messages.map((msg) => {
                  const isAdmin = msg.authorType === "admin";
                  return (
                    <div
                      key={msg.id}
                      className={`flex ${isAdmin ? "justify-end" : "justify-start"}`}
                    >
                      <div
                        className={`max-w-[80%] ${
                          isAdmin
                            ? "bg-blue-600 text-white"
                            : "bg-gray-100 dark:bg-gray-800"
                        } rounded-2xl px-4 py-3`}
                      >
                        <div className="flex items-center gap-2 mb-1">
                          {isAdmin ? (
                            <Shield className="w-4 h-4" />
                          ) : (
                            <User className="w-4 h-4" />
                          )}
                          <span className="text-sm font-medium">{msg.authorName}</span>
                          <span className={`text-xs ${isAdmin ? "text-blue-100" : "text-muted-foreground"}`}>
                            {formatDate(msg.createdAt)}
                          </span>
                        </div>
                        <p className="whitespace-pre-wrap">{msg.content}</p>
                        {msg.attachments && msg.attachments.length > 0 && (
                          <div className={`mt-2 pt-2 border-t ${isAdmin ? "border-blue-500" : "border-gray-200 dark:border-gray-700"}`}>
                            <div className="text-xs mb-1 opacity-70">첨부파일:</div>
                            <div className="space-y-1">
                              {msg.attachments.map((url, i) => (
                                <a
                                  key={i}
                                  href={url}
                                  target="_blank"
                                  rel="noopener noreferrer"
                                  className={`flex items-center gap-1 text-xs ${isAdmin ? "text-blue-100 hover:text-white" : "text-blue-600 hover:text-blue-800"}`}
                                >
                                  <Paperclip className="w-3 h-3" />
                                  <span className="truncate max-w-[200px]">{url.split('/').pop() || url}</span>
                                  <ExternalLink className="w-3 h-3 flex-shrink-0" />
                                </a>
                              ))}
                            </div>
                          </div>
                        )}
                        {msg.expectedCompletionDate && (
                          <div className={`mt-2 pt-2 border-t ${isAdmin ? "border-blue-500" : "border-gray-200 dark:border-gray-700"} text-xs flex items-center gap-1`}>
                            <Calendar className="w-3 h-3" />
                            예상 완료일: {formatShortDate(msg.expectedCompletionDate)}
                          </div>
                        )}
                      </div>
                    </div>
                  );
                })}
                <div ref={messagesEndRef} />
              </div>
            </CardContent>
          </Card>

          {/* 입력 영역 */}
          <Card className="mt-4">
            <CardContent className="p-4">
              <div className="space-y-3">
                <div className="flex gap-2">
                  <div className="flex-1">
                    <label className="text-xs text-muted-foreground mb-1 block">예상 완료일 (선택)</label>
                    <Input
                      type="date"
                      value={expectedDate}
                      onChange={(e) => setExpectedDate(e.target.value)}
                      className="text-sm"
                    />
                  </div>
                  <div className="flex-1">
                    <label className="text-xs text-muted-foreground mb-1 block">상태 변경 (선택)</label>
                    <select
                      value={changeStatus}
                      onChange={(e) => setChangeStatus(e.target.value)}
                      className="w-full h-10 px-3 rounded-md border border-input bg-background text-sm"
                    >
                      <option value="">변경 안함</option>
                      <option value="IN_PROGRESS">진행중</option>
                      <option value="RESOLVED">완료</option>
                    </select>
                  </div>
                </div>

                {/* 첨부파일 영역 */}
                <div>
                  <label className="text-xs text-muted-foreground mb-1 block">
                    파일첨부 (선택) - jpg, png, pdf / 최대 10MB
                  </label>
                  <div className="flex gap-2">
                    <input
                      ref={fileInputRef}
                      type="file"
                      accept=".jpg,.jpeg,.png,.pdf"
                      multiple
                      onChange={handleFileUpload}
                      className="hidden"
                      id="file-upload"
                    />
                    <Button
                      type="button"
                      variant="outline"
                      size="sm"
                      onClick={() => fileInputRef.current?.click()}
                      disabled={uploading}
                      className="w-full justify-center"
                    >
                      {uploading ? (
                        <>
                          <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                          업로드 중...
                        </>
                      ) : (
                        <>
                          <Paperclip className="w-4 h-4 mr-2" />
                          파일 선택
                        </>
                      )}
                    </Button>
                  </div>
                  {attachments.length > 0 && (
                    <div className="flex flex-wrap gap-2 mt-2">
                      {attachments.map((file, index) => (
                        <div
                          key={index}
                          className="flex items-center gap-1 bg-blue-50 dark:bg-blue-900/20 border border-blue-200 dark:border-blue-800 px-2 py-1 rounded text-xs"
                        >
                          <Paperclip className="w-3 h-3 text-blue-600" />
                          <a
                            href={file.url}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="truncate max-w-[150px] text-blue-600 hover:underline"
                          >
                            {file.name}
                          </a>
                          <button
                            type="button"
                            onClick={() => handleRemoveAttachment(index)}
                            className="text-red-500 hover:text-red-700 ml-1"
                          >
                            <X className="w-3 h-3" />
                          </button>
                        </div>
                      ))}
                    </div>
                  )}
                </div>

                <div className="flex gap-3">
                  <textarea
                    value={newMessage}
                    onChange={(e) => setNewMessage(e.target.value)}
                    onKeyPress={handleKeyPress}
                    placeholder="답변을 입력하세요..."
                    rows={3}
                    className="flex-1 px-4 py-2 rounded-lg border border-input bg-background text-sm resize-none"
                  />
                  <Button
                    onClick={handleSend}
                    disabled={!newMessage.trim() || sending}
                    className="self-end"
                  >
                    {sending ? (
                      <Loader2 className="w-5 h-5 animate-spin" />
                    ) : (
                      <Send className="w-5 h-5" />
                    )}
                  </Button>
                </div>
              </div>
            </CardContent>
          </Card>
        </div>

        {/* 사이드바 */}
        <div className="space-y-4">
          {/* 고객 정보 */}
          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-sm font-medium">고객 정보</CardTitle>
            </CardHeader>
            <CardContent className="space-y-2 text-sm">
              <div>
                <span className="text-muted-foreground">업체명: </span>
                <span className="font-medium">{thread.user.clientName}</span>
              </div>
              <div>
                <span className="text-muted-foreground">담당자: </span>
                <span>{thread.user.name}</span>
              </div>
              <div>
                <span className="text-muted-foreground">연락처: </span>
                <span>{thread.user.phone}</span>
              </div>
              <div>
                <span className="text-muted-foreground">이메일: </span>
                <span>{thread.user.email}</span>
              </div>
            </CardContent>
          </Card>

          {/* 상태 관리 */}
          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-sm font-medium">상태 관리</CardTitle>
            </CardHeader>
            <CardContent className="space-y-3">
              <div className="flex flex-wrap gap-2">
                {(["OPEN", "IN_PROGRESS", "RESOLVED"] as const).map((status) => {
                  const config = statusConfig[status];
                  const isActive = thread.status === status;
                  return (
                    <Button
                      key={status}
                      variant={isActive ? "default" : "outline"}
                      size="sm"
                      onClick={() => handleStatusChange(status)}
                      disabled={updating || isActive}
                    >
                      {updating ? (
                        <Loader2 className="w-3 h-3 animate-spin mr-1" />
                      ) : (
                        <config.icon className="w-3 h-3 mr-1" />
                      )}
                      {config.label}
                    </Button>
                  );
                })}
              </div>
              {thread.expectedCompletionDate && (
                <div className="text-sm">
                  <span className="text-muted-foreground">예상 완료일: </span>
                  <span className="font-medium">{formatShortDate(thread.expectedCompletionDate)}</span>
                </div>
              )}
            </CardContent>
          </Card>

          {/* 문의 정보 */}
          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-sm font-medium">문의 정보</CardTitle>
            </CardHeader>
            <CardContent className="space-y-2 text-sm">
              <div>
                <span className="text-muted-foreground">카테고리: </span>
                <span>{thread.category}</span>
              </div>
              <div>
                <span className="text-muted-foreground">등록일: </span>
                <span>{formatShortDate(thread.createdAt)}</span>
              </div>
              <div>
                <span className="text-muted-foreground">메시지 수: </span>
                <span>{thread.messages.length}개</span>
              </div>
            </CardContent>
          </Card>

          {/* 시안 생성 */}
          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-sm font-medium flex items-center gap-2">
                <Palette className="w-4 h-4" />
                시안 관리
              </CardTitle>
            </CardHeader>
            <CardContent>
              <Button
                onClick={() => setShowDesignModal(true)}
                className="w-full"
                variant="outline"
              >
                <Palette className="w-4 h-4 mr-2" />
                시안 생성
              </Button>
              <p className="text-xs text-muted-foreground mt-2">
                이 문의를 기반으로 시안을 생성합니다.
              </p>
            </CardContent>
          </Card>
        </div>
      </div>

      {/* 시안 생성 모달 */}
      {showDesignModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50">
          <div className="bg-white dark:bg-gray-800 rounded-xl shadow-xl w-full max-w-md mx-4">
            <div className="flex items-center justify-between p-4 border-b dark:border-gray-700">
              <h2 className="text-lg font-semibold text-gray-900 dark:text-white flex items-center gap-2">
                <Palette className="w-5 h-5" />
                시안 생성
              </h2>
              <button
                onClick={() => setShowDesignModal(false)}
                className="p-2 text-gray-500 hover:bg-gray-100 dark:hover:bg-gray-700 rounded-lg"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="p-4 space-y-4">
              <div>
                <p className="text-sm text-muted-foreground mb-3">
                  <strong>{thread.user.clientName}</strong>님의 문의를 기반으로 시안을 생성합니다.
                </p>
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                  시안 유형 선택 <span className="text-red-500">*</span>
                </label>
                <div className="grid grid-cols-2 gap-2">
                  {WORKFLOW_TYPES.map((type) => (
                    <button
                      key={type.value}
                      onClick={() => setSelectedWorkflowType(type.value)}
                      className={`p-3 text-left border rounded-lg transition-colors ${
                        selectedWorkflowType === type.value
                          ? "border-blue-500 bg-blue-50 dark:bg-blue-900/20"
                          : "border-gray-300 dark:border-gray-600 hover:border-blue-300"
                      }`}
                    >
                      <span className="text-sm font-medium">{type.label}</span>
                    </button>
                  ))}
                </div>
              </div>

              <div className="bg-gray-50 dark:bg-gray-700/50 rounded-lg p-3">
                <p className="text-xs text-muted-foreground">
                  • 문의 내용이 시안 피드백에 자동으로 추가됩니다<br />
                  • 시안 생성 후 시안 관리 페이지로 이동합니다<br />
                  • 이미 해당 유형의 시안이 있으면 기존 시안으로 이동합니다
                </p>
              </div>
            </div>

            <div className="flex gap-3 p-4 border-t dark:border-gray-700">
              <Button
                variant="outline"
                onClick={() => setShowDesignModal(false)}
                className="flex-1"
              >
                취소
              </Button>
              <Button
                onClick={handleCreateDesign}
                disabled={!selectedWorkflowType || creatingDesign}
                className="flex-1"
              >
                {creatingDesign ? (
                  <Loader2 className="w-4 h-4 animate-spin mr-2" />
                ) : (
                  <Palette className="w-4 h-4 mr-2" />
                )}
                시안 생성
              </Button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
