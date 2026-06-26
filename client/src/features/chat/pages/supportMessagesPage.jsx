import { useEffect, useMemo, useRef, useState } from "react";
import { Navigate } from "react-router-dom";
import { io } from "socket.io-client";
import {
  Loader2,
  MessageSquare,
  RefreshCw,
  Send,
  Search,
  X,
} from "lucide-react";
import { useAuth } from "../../auth/hooks/authContext.jsx";
import { getAuthIdentity, getRoleRedirectPath, isAdminRole, isCustomerRole } from "../../auth/utils/roleRedirect.js";
import { chatApi } from "../api/chatApi.js";
import { CHAT_SOCKET_PATH, CHAT_SOCKET_URL } from "../../../config/socketConfig.js";

function canAccessSupportInbox(user) {
  if (!user) return false;
  const { role, position } = getAuthIdentity(user);
  return isAdminRole(role) || ["customer_service", "customer_support"].includes(position);
}

function formatTime(value) {
  if (!value) return "";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "";
  return date.toLocaleTimeString("vi-VN", { hour: "2-digit", minute: "2-digit" });
}

function formatDateTime(value) {
  if (!value) return "";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "";
  return date.toLocaleString("vi-VN", {
    day: "2-digit",
    month: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
  });
}

function getMessageKey(message) {
  return message?._id || `${message?.sender_id || "msg"}-${message?.created_at || ""}-${message?.content || ""}`;
}

function getSupportStatusMeta(conversation) {
  if (!conversation) {
    return { label: "Đang chờ", tone: "amber" };
  }

  if (String(conversation.status || "").toLowerCase() === "ended") {
    return { label: "Đã kết thúc", tone: "stone" };
  }

  if (Number(conversation.unread_count || 0) > 0) {
    return { label: "Đang chờ", tone: "amber" };
  }

  return { label: "Đang hỗ trợ", tone: "emerald" };
}

function getSupportConversationTitle(conversation, myId) {
  if (!conversation) return "Tin nhắn khách hàng";

  const otherParticipant = conversation.participants?.find(
    (participant) => participant?.user_id?.toString() !== myId?.toString()
  );

  if (conversation.name && conversation.type !== "support") return conversation.name;
  if (otherParticipant?.role === "guest") return "Khách vãng lai";
  if (otherParticipant?.role === "customer") {
    const suffix = otherParticipant?.user_id?.toString()?.slice(-6);
    return suffix ? `Khách hàng · ${suffix}` : "Khách hàng";
  }

  return conversation.name || "Khách hàng";
}

export default function SupportMessagesPage() {
  const { user } = useAuth();
  const role = user?.role || user?.system_role;
  const token = user?.token || localStorage.getItem("token");
  const myId = user?._id || user?.id || user?.userId;
  const canAccessInbox = canAccessSupportInbox(user);
  const shouldRedirectCustomer = isCustomerRole(role) && !canAccessInbox;

  const [conversations, setConversations] = useState([]);
  const [activeConversationId, setActiveConversationId] = useState(null);
  const [messages, setMessages] = useState([]);
  const [searchTerm, setSearchTerm] = useState("");
  const [draft, setDraft] = useState("");
  const [loadingList, setLoadingList] = useState(true);
  const [loadingMessages, setLoadingMessages] = useState(false);
  const [sending, setSending] = useState(false);
  const [error, setError] = useState("");
  const [socketStatus, setSocketStatus] = useState("connecting");
  const [refreshing, setRefreshing] = useState(false);
  const [statusFilter, setStatusFilter] = useState("all");

  const socketRef = useRef(null);
  const activeConversationRef = useRef(null);
  const bottomRef = useRef(null);

  useEffect(() => {
    activeConversationRef.current = activeConversationId;
  }, [activeConversationId]);

  const loadConversations = async (silent = false) => {
    if (!token || !canAccessInbox) return;
    if (!silent) setLoadingList(true);
    setRefreshing(true);
    try {
      const res = await chatApi.getSupportConversations();
      const supportConversations = (res.conversations ?? [])
        .filter((conversation) => conversation?.type === "support")
        .sort((a, b) => {
          const unreadDiff = Number(b?.unread_count || 0) - Number(a?.unread_count || 0);
          if (unreadDiff !== 0) return unreadDiff;
          const bTime = new Date(b?.last_message?.sent_at || b?.created_at || 0).getTime();
          const aTime = new Date(a?.last_message?.sent_at || a?.created_at || 0).getTime();
          return bTime - aTime;
        });
      setConversations(supportConversations);
      setError("");
      if (!activeConversationRef.current && supportConversations.length > 0) {
        setActiveConversationId(supportConversations[0]._id);
      }
    } catch (err) {
      setError(err?.response?.data?.message || err?.message || "Không thể tải tin nhắn khách hàng. Vui lòng thử lại.");
    } finally {
      if (!silent) setLoadingList(false);
      setRefreshing(false);
    }
  };

  useEffect(() => {
    if (!token || !canAccessInbox) {
      setLoadingList(false);
      setSocketStatus("disconnected");
      return undefined;
    }

    loadConversations();
  }, [token, canAccessInbox]);

  useEffect(() => {
    if (!token || !canAccessInbox) return undefined;

    const timer = window.setInterval(() => {
      loadConversations(true);
    }, 45000);

    const onFocus = () => loadConversations(true);
    window.addEventListener("focus", onFocus);

    return () => {
      window.clearInterval(timer);
      window.removeEventListener("focus", onFocus);
    };
  }, [token, canAccessInbox]);

  useEffect(() => {
    if (!token || !canAccessInbox) {
      setSocketStatus("disconnected");
      return undefined;
    }

    const socket = io(CHAT_SOCKET_URL, {
      path: CHAT_SOCKET_PATH,
      auth: { token },
      transports: ["polling"],
    });

    socketRef.current = socket;
    setSocketStatus("connecting");

    socket.on("connect", () => {
      setSocketStatus("connected");
    });

    socket.on("disconnect", (reason) => {
      setSocketStatus("disconnected");
      if (reason !== "io client disconnect") {
        console.warn("[SupportInbox] disconnected:", reason);
      }
    });

    socket.on("connect_error", (e) => {
      setSocketStatus("disconnected");
      console.error("[SupportInbox] connect error:", e.message);
    });

    socket.on("chat:support_inbox_message", ({ conversation_id, message }) => {
      if (!conversation_id || !message) return;

      let shouldRefresh = false;
      setConversations((prev) => {
        let matched = false;
        const next = prev.map((conversation) => {
          if (conversation._id !== conversation_id) return conversation;
          matched = true;
          const isMine = message?.sender_id?.toString() === myId?.toString();
          const isActive = activeConversationRef.current === conversation_id;
          const unread_count = isMine || isActive ? 0 : Number(conversation.unread_count || 0) + 1;
          return {
            ...conversation,
            last_message: {
              content: message.content,
              sender_id: message.sender_id,
              sender_name: message.sender_name,
              sent_at: message.created_at,
            },
            unread_count,
          };
        });

        if (!matched) {
          shouldRefresh = true;
        }
        return next;
      });

      if (shouldRefresh) {
        loadConversations(true);
      }

      if (activeConversationRef.current === conversation_id) {
        setMessages((prev) => {
          if (prev.some((item) => item._id === message._id)) return prev;
          return [...prev, message];
        });
        socket.emit("chat:mark_read", { conversation_id });
      }
    });

    socket.on("chat:message_deleted", ({ conversation_id, message_id }) => {
      if (activeConversationRef.current !== conversation_id) return;
      setMessages((prev) =>
        prev.map((message) =>
          message._id === message_id ? { ...message, is_deleted: true, content: "" } : message
        )
      );
    });

    socket.on("chat:message_updated", ({ conversation_id, message }) => {
      if (activeConversationRef.current !== conversation_id) return;
      setMessages((prev) => prev.map((item) => (item._id === message._id ? message : item)));
    });

    socket.on("chat:support_inbox_conversation_ended", ({ conversation_id, status, ended_at, ended_by }) => {
      setConversations((prev) =>
        prev.map((conversation) =>
          conversation._id === conversation_id
            ? {
                ...conversation,
                status,
                ended_at,
                ended_by,
              }
            : conversation
        )
      );
      if (activeConversationRef.current === conversation_id) {
        setLoadingMessages(false);
      }
    });

    return () => {
      socket.disconnect();
      socketRef.current = null;
    };
  }, [myId, token, canAccessInbox]);

  useEffect(() => {
    if (!activeConversationId || !token || !canAccessInbox) {
      setMessages([]);
      return;
    }

    const loadMessages = async () => {
      setLoadingMessages(true);
      setError("");

      try {
        const res = await chatApi.getSupportConversationMessages(activeConversationId);
        setMessages(res.messages ?? []);
        socketRef.current?.emit("chat:join_conversation", { conversation_id: activeConversationId });
        socketRef.current?.emit("chat:mark_read", { conversation_id: activeConversationId });
        setConversations((prev) =>
          prev.map((conversation) =>
            conversation._id === activeConversationId ? { ...conversation, unread_count: 0 } : conversation
          )
        );
      } catch (err) {
        setError(err?.response?.data?.message || err?.message || "Không thể tải cuộc trò chuyện.");
      } finally {
        setLoadingMessages(false);
      }
    };

    loadMessages();
  }, [activeConversationId, token, canAccessInbox]);

  useEffect(() => {
    if (!bottomRef.current) return;
    bottomRef.current.scrollIntoView({ behavior: "smooth", block: "end" });
  }, [messages, activeConversationId]);

  const filteredConversations = useMemo(() => {
    const query = searchTerm.trim().toLowerCase();
    return conversations.filter((conversation) => {
      const title = getSupportConversationTitle(conversation, myId).toLowerCase();
      const content = String(conversation?.last_message?.content || "").toLowerCase();
      const status = String(conversation?.status || "").toLowerCase();
      const unread = Number(conversation?.unread_count || 0);
      const isEnded = status === "ended";
      const isWaiting = !isEnded && unread > 0;
      const isSupporting = !isEnded && unread === 0;

      const matchesSearch = !query || title.includes(query) || content.includes(query) || status.includes(query);
      const matchesStatus =
        statusFilter === "all"
          ? true
          : statusFilter === "waiting"
          ? isWaiting
          : statusFilter === "supporting"
          ? isSupporting
          : statusFilter === "ended"
          ? isEnded
          : true;

      return matchesSearch && matchesStatus;
    });
  }, [conversations, myId, searchTerm, statusFilter]);

  const conversationCounts = useMemo(() => {
    return conversations.reduce(
      (acc, conversation) => {
        const status = String(conversation?.status || "").toLowerCase();
        const unread = Number(conversation?.unread_count || 0);
        const isEnded = status === "ended";
        const isWaiting = !isEnded && unread > 0;
        const isSupporting = !isEnded && unread === 0;

        acc.all += 1;
        if (isWaiting) acc.waiting += 1;
        if (isSupporting) acc.supporting += 1;
        if (isEnded) acc.ended += 1;
        return acc;
      },
      { all: 0, waiting: 0, supporting: 0, ended: 0 }
    );
  }, [conversations]);

  const activeConversation = conversations.find((conversation) => conversation._id === activeConversationId) || null;
  const activeStatusMeta = getSupportStatusMeta(activeConversation);
  const activeConversationTitle = getSupportConversationTitle(activeConversation, myId);
  const activeUnread = Number(activeConversation?.unread_count || 0);
  const handleSend = async () => {
    const content = draft.trim();
    if (!content || sending || !activeConversationId) return;

    if (String(activeConversation?.status || "").toLowerCase() === "ended") {
      setError("Cuộc trò chuyện này đã kết thúc.");
      return;
    }

    setSending(true);
    setError("");

    try {
      await chatApi.sendSupportReply({
        socket: socketRef.current,
        conversationId: activeConversationId,
        content,
      });
      setDraft("");
    } catch (err) {
      setError(err?.response?.data?.message || err?.message || "Không thể gửi tin nhắn.");
    } finally {
      setSending(false);
    }
  };

  const handleEndConversation = async () => {
    if (!activeConversationId || String(activeConversation?.status || "").toLowerCase() === "ended") {
      return;
    }

    try {
      await chatApi.endSupportConversation(activeConversationId);
    } catch (err) {
      setError(err?.response?.data?.message || err?.message || "Không thể kết thúc cuộc trò chuyện.");
    }
  };

  if (!token) {
    return <Navigate to="/login" replace />;
  }

  if (shouldRedirectCustomer) {
    return <Navigate to="/hotel" replace />;
  }

  if (!canAccessInbox) {
    return <Navigate to={getRoleRedirectPath(user)} replace />;
  }

  return (
    <div className="flex min-h-[calc(100vh-120px)] overflow-hidden rounded-[28px] border border-stone-200 bg-white shadow-sm">
      <aside className="flex w-[380px] flex-col border-r border-stone-200 bg-stone-50">
        <div className="flex items-start justify-between gap-3 border-b border-stone-200 px-5 py-4">
          <div>
            <p className="text-xs font-semibold uppercase tracking-[0.22em] text-stone-400">Tin nhắn khách hàng</p>
            <h1 className="mt-2 text-xl font-semibold tracking-tight text-stone-950">Hỗ trợ khách hàng</h1>
            <p className="mt-1 text-sm leading-6 text-stone-600">
              Xem và phản hồi các cuộc trò chuyện từ widget khách hàng.
            </p>
          </div>
          <button
            type="button"
            onClick={() => loadConversations(false)}
            className="inline-flex h-10 w-10 items-center justify-center rounded-2xl border border-stone-200 bg-white text-stone-700 transition hover:border-stone-300 hover:bg-stone-100"
            title="Làm mới"
          >
            {refreshing ? <Loader2 size={16} className="animate-spin" /> : <RefreshCw size={16} />}
          </button>
        </div>

        <div className="border-b border-stone-200 px-4 py-3">
          <label className="flex items-center gap-2 rounded-2xl border border-stone-200 bg-white px-3 py-2.5">
            <Search size={16} className="text-stone-400" />
            <input
              value={searchTerm}
              onChange={(event) => setSearchTerm(event.target.value)}
              placeholder="Tìm khách hàng, nội dung..."
              className="w-full bg-transparent text-sm outline-none placeholder:text-stone-400"
            />
          </label>

          <div className="mt-3 flex flex-wrap gap-2">
            {[
              { key: "all", label: `Tất cả (${conversationCounts.all})` },
              { key: "waiting", label: `Đang chờ (${conversationCounts.waiting})` },
              { key: "supporting", label: `Đang hỗ trợ (${conversationCounts.supporting})` },
              { key: "ended", label: `Đã kết thúc (${conversationCounts.ended})` },
            ].map((tab) => {
              const active = statusFilter === tab.key;
              return (
                <button
                  key={tab.key}
                  type="button"
                  onClick={() => setStatusFilter(tab.key)}
                  className={`rounded-full px-3 py-1.5 text-xs font-semibold transition ${
                    active
                      ? "bg-stone-950 text-white"
                      : "border border-stone-200 bg-white text-stone-600 hover:border-stone-300 hover:bg-stone-100"
                  }`}
                >
                  {tab.label}
                </button>
              );
            })}
          </div>
        </div>

        <div className="flex-1 overflow-y-auto">
          {loadingList ? (
            <div className="flex h-full items-center justify-center p-6 text-sm text-stone-500">
              Đang tải tin nhắn khách hàng...
            </div>
          ) : filteredConversations.length === 0 ? (
            <div className="flex h-full items-center justify-center px-8 py-10 text-center">
              <div>
                <MessageSquare size={40} className="mx-auto text-stone-300" />
                <p className="mt-4 text-sm font-semibold text-stone-900">Chưa có tin nhắn khách hàng đang chờ xử lý.</p>
                <p className="mt-2 text-sm leading-6 text-stone-500">
                  Khi khách nhắn từ widget, cuộc trò chuyện sẽ xuất hiện ở đây.
                </p>
              </div>
            </div>
          ) : (
            filteredConversations.map((conversation) => {
              const isActive = conversation._id === activeConversationId;
              const statusMeta = getSupportStatusMeta(conversation);
              const unread = Number(conversation.unread_count || 0);
              const title = getSupportConversationTitle(conversation, myId);
              const avatarLabel = title.trim().charAt(0).toUpperCase() || "K";

              return (
                <button
                  key={conversation._id}
                  type="button"
                  onClick={() => setActiveConversationId(conversation._id)}
                  className={`w-full border-b border-stone-200 px-4 py-4 text-left transition ${
                    isActive ? "bg-white" : "hover:bg-stone-100"
                  }`}
                >
                  <div className="flex items-start gap-3">
                    <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-2xl bg-stone-950 text-sm font-semibold text-white">
                      {avatarLabel}
                    </div>

                    <div className="min-w-0 flex-1">
                      <div className="flex items-center gap-2">
                        <p className={`truncate text-sm font-semibold ${isActive ? "text-stone-950" : "text-stone-800"}`}>
                          {title}
                        </p>
                        {unread > 0 ? (
                          <span className="rounded-full bg-amber-100 px-2 py-0.5 text-[11px] font-semibold text-amber-700">
                            {unread}
                          </span>
                        ) : null}
                      </div>
                      <p className="mt-1 line-clamp-2 text-sm leading-6 text-stone-500">
                        {conversation?.last_message?.content || "Chưa có tin nhắn"}
                      </p>
                      <p className="mt-2 text-[11px] uppercase tracking-[0.18em] text-stone-400">
                        {conversation?.status === "ended" ? "Đã kết thúc" : unread > 0 ? "Đang chờ phản hồi" : "Đang hỗ trợ"}
                      </p>
                    </div>

                    <div className="flex shrink-0 flex-col items-end gap-2">
                      <span
                        className={`rounded-full px-2.5 py-1 text-[11px] font-semibold ${
                          statusMeta.tone === "amber"
                            ? "bg-amber-100 text-amber-700"
                            : statusMeta.tone === "emerald"
                            ? "bg-emerald-100 text-emerald-700"
                            : "bg-stone-200 text-stone-700"
                        }`}
                      >
                        {statusMeta.label}
                      </span>
                      <span className="text-xs text-stone-400">
                        {formatDateTime(conversation?.last_message?.sent_at || conversation?.created_at)}
                      </span>
                    </div>
                  </div>
                </button>
              );
            })
          )}
        </div>

        <div className="border-t border-stone-200 px-5 py-3 text-xs text-stone-500">
          Badge sidebar hiện lấy từ số cuộc trò chuyện có tin chưa đọc.
        </div>
      </aside>

      <main className="flex min-w-0 flex-1 flex-col bg-white">
        {!activeConversation ? (
          <div className="flex flex-1 items-center justify-center px-6 text-center text-stone-400">
            <div>
              <MessageSquare size={44} className="mx-auto text-stone-300" />
              <p className="mt-4 text-base font-semibold text-stone-900">Chọn một cuộc trò chuyện từ khách hàng</p>
              <p className="mt-2 text-sm leading-6 text-stone-500">
                Khi khách nhắn từ widget, nội dung sẽ hiển thị ở đây để bạn phản hồi.
              </p>
            </div>
          </div>
        ) : (
          <>
            <header className="flex items-center justify-between gap-4 border-b border-stone-200 px-6 py-4">
              <div className="min-w-0">
                <p className="text-xs font-semibold uppercase tracking-[0.22em] text-stone-400">Cuộc trò chuyện</p>
                <h2 className="mt-2 truncate text-2xl font-semibold tracking-tight text-stone-950">
                  {activeConversationTitle}
                </h2>
                <div className="mt-2 flex flex-wrap items-center gap-2 text-sm text-stone-500">
                  <span>
                    {activeConversation?.status === "ended"
                      ? "Cuộc trò chuyện đã kết thúc."
                      : activeUnread > 0
                      ? "Khách đang chờ phản hồi."
                      : "Đang hỗ trợ khách hàng."}
                  </span>
                  <span className="text-stone-300">·</span>
                  <span>{activeConversation?.type === "support" ? "Kênh hỗ trợ khách hàng" : "Kênh trao đổi"}</span>
                </div>
              </div>

              <div className="flex items-center gap-2">
                <span
                  className={`rounded-full px-3 py-1.5 text-xs font-semibold ${
                    activeStatusMeta.tone === "amber"
                      ? "bg-amber-100 text-amber-700"
                      : activeStatusMeta.tone === "emerald"
                      ? "bg-emerald-100 text-emerald-700"
                      : "bg-stone-200 text-stone-700"
                  }`}
                >
                  {activeStatusMeta.label}
                </span>
                <button
                  type="button"
                  onClick={() => loadConversations(true)}
                  className="inline-flex items-center gap-2 rounded-full border border-stone-200 bg-white px-4 py-2 text-sm font-semibold text-stone-700 transition hover:bg-stone-100"
                >
                  {refreshing ? <Loader2 size={15} className="animate-spin" /> : <RefreshCw size={15} />}
                  Làm mới
                </button>
                {String(activeConversation?.status || "").toLowerCase() !== "ended" ? (
                  <button
                    type="button"
                    onClick={handleEndConversation}
                    className="inline-flex items-center gap-2 rounded-full border border-stone-200 bg-stone-50 px-4 py-2 text-sm font-semibold text-stone-700 transition hover:bg-stone-100"
                  >
                    <X size={15} />
                    Kết thúc cuộc trò chuyện
                  </button>
                ) : null}
              </div>
            </header>

            <section className="flex-1 overflow-y-auto bg-stone-50 px-6 py-5">
              {loadingMessages ? (
                <div className="flex h-full items-center justify-center text-sm text-stone-500">
                  Đang tải lịch sử tin nhắn...
                </div>
              ) : messages.length === 0 ? (
                <div className="flex h-full items-center justify-center text-center text-stone-500">
                  <div>
                    <MessageSquare size={36} className="mx-auto text-stone-300" />
                    <p className="mt-4 text-sm font-semibold text-stone-900">Chưa có tin nhắn nào trong cuộc trò chuyện này.</p>
                    <p className="mt-2 text-sm leading-6 text-stone-500">Khi khách gửi tin, nội dung sẽ hiện tại đây.</p>
                  </div>
                </div>
              ) : (
                <div className="space-y-3">
                  {messages.map((message) => {
                    const isMine = message?.sender_id?.toString() === myId?.toString();
                    const isDeleted = message?.is_deleted;

                    return (
                      <div key={getMessageKey(message)} className={`flex ${isMine ? "justify-end" : "justify-start"}`}>
                        <div className="max-w-[82%]">
                          {!isMine && !isDeleted ? (
                            <p className="mb-1 ml-1 text-[11px] font-medium text-stone-400">
                              {message?.sender_name || "Khách hàng"}
                            </p>
                          ) : null}
                          <div
                            className={`rounded-[20px] px-4 py-3 text-sm leading-6 shadow-sm ${
                              isMine
                                ? "bg-stone-950 text-white"
                                : "border border-stone-200 bg-white text-stone-800"
                            }`}
                          >
                            <p className="whitespace-pre-wrap break-words">
                              {isDeleted ? "Tin nhắn đã bị xóa" : message?.content}
                            </p>
                            <div className={`mt-1 text-[11px] ${isMine ? "text-white/70" : "text-stone-400"}`}>
                              {formatTime(message?.created_at)}
                              {message?.edited_at ? " · đã chỉnh sửa" : ""}
                            </div>
                          </div>
                        </div>
                      </div>
                    );
                  })}
                  <div ref={bottomRef} />
                </div>
              )}
            </section>

            <footer className="border-t border-stone-200 bg-white px-6 py-4">
              {activeConversation?.status === "ended" ? (
                <div className="rounded-[20px] border border-stone-200 bg-stone-50 px-4 py-3 text-sm text-stone-600">
                  Cuộc trò chuyện đã kết thúc. Khách vẫn có thể nhắn lại từ widget để mở đoạn trao đổi mới.
                </div>
              ) : (
                <div className="flex items-end gap-3">
                  <textarea
                    value={draft}
                    onChange={(event) => setDraft(event.target.value)}
                    onKeyDown={(event) => {
                      if (event.key === "Enter" && !event.shiftKey) {
                        event.preventDefault();
                        handleSend();
                      }
                    }}
                    rows={1}
                    placeholder="Nhập phản hồi cho khách..."
                    className="min-h-[52px] flex-1 resize-none rounded-[18px] border border-stone-200 bg-stone-50 px-4 py-3 text-sm outline-none transition focus:border-stone-400 focus:bg-white"
                  />
                  <button
                    type="button"
                    onClick={handleSend}
                    disabled={!draft.trim() || sending}
                    className="inline-flex h-[52px] items-center gap-2 rounded-[18px] bg-stone-950 px-5 text-sm font-semibold text-white transition hover:bg-stone-800 disabled:cursor-not-allowed disabled:opacity-50"
                  >
                    {sending ? <Loader2 size={16} className="animate-spin" /> : <Send size={16} />}
                    Gửi
                  </button>
                </div>
              )}

              {error ? (
                <div className="mt-3 rounded-2xl border border-rose-200 bg-rose-50 px-4 py-3 text-sm text-rose-700">
                  {error}
                  <button
                    type="button"
                    onClick={() => setError("")}
                    className="ml-2 inline-flex items-center justify-center rounded-full p-1 text-rose-700 transition hover:bg-rose-100"
                    aria-label="Đóng lỗi"
                  >
                    <X size={14} />
                  </button>
                </div>
              ) : null}
            </footer>
          </>
        )}
      </main>
    </div>
  );
}
