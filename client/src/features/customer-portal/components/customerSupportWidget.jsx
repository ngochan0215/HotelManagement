import { createPortal } from "react-dom";
import { useEffect, useMemo, useRef, useState } from "react";
import { Link } from "react-router-dom";
import { io } from "socket.io-client";
import { Bot, CheckCircle2, Loader2, LogIn, MessageCircle, MoreHorizontal, Send, Users, X } from "lucide-react";
import { useAuth } from "../../auth/hooks/authContext.jsx";
import { isCustomerRole } from "../../auth/utils/roleRedirect.js";
import { chatApi } from "../../chat/api/chatApi.js";
import { CHAT_SOCKET_PATH, CHAT_SOCKET_URL } from "../../../config/socketConfig.js";

const CHANNELS = [
  {
    key: "support",
    label: "Nhân viên hỗ trợ",
    icon: Users,
    accent: "emerald",
    intro: "Hãy để lại tin nhắn. Nhân viên khách sạn sẽ phản hồi bạn sớm nhất có thể.",
    loadingText: "Đang chuẩn bị kênh hỗ trợ...",
    emptyTitle: "Hãy để lại tin nhắn",
    emptyText: "Nhân viên khách sạn sẽ phản hồi bạn sớm nhất có thể.",
    fallbackHint: "Khách sạn sẽ phản hồi bạn sớm nhất có thể.",
  },
  {
    key: "bot",
    label: "Bot SE Hotel",
    icon: Bot,
    accent: "sky",
    intro: "Xin chào 👋 Tôi là Bot SE Hotel. Bạn cần hỗ trợ gì về phòng, đặt phòng hay dịch vụ?",
    loadingText: "Đang gọi Bot SE Hotel...",
    emptyTitle: "Xin chào 👋",
    emptyText: "Tôi là Bot SE Hotel. Bạn cần hỗ trợ gì về phòng, đặt phòng hay dịch vụ?",
    fallbackHint: "Bot hiện chưa phản hồi được. Bạn có thể chuyển sang tab Nhân viên hỗ trợ.",
  },
];

const LAST_ACTIVE_CHANNEL_KEY = "customer_support_widget_active_channel";

function createChannelState() {
  return {
    conversation: null,
    messages: [],
    loading: false,
    sending: false,
    error: "",
    notice: "",
    unreadCount: 0,
    typing: false,
    typingLabel: "",
    initialized: false,
    ending: false,
    conversationEnded: false,
  };
}

function formatTime(value) {
  if (!value) return "";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "";
  return date.toLocaleTimeString("vi-VN", { hour: "2-digit", minute: "2-digit" });
}

function getMessageKey(message) {
  return message?._id || `${message?.sender_id || "msg"}-${message?.created_at || ""}-${message?.content || ""}`;
}

function normalizeChatError(err, fallback) {
  const status = err?.response?.status;
  const message = err?.response?.data?.message || err?.message || fallback;

  if (status === 504) {
    return "Dịch vụ hỗ trợ phản hồi quá lâu. Vui lòng thử lại.";
  }

  if (status === 404) {
    return "Chưa thể kết nối kênh hỗ trợ. Vui lòng thử lại.";
  }

  if (String(message).toLowerCase().includes("network error")) {
    return "Không thể kết nối dịch vụ hỗ trợ. Vui lòng thử lại.";
  }

  return String(message || fallback);
}

export default function CustomerSupportWidget() {
  const { user } = useAuth();
  const role = user?.role || user?.system_role;
  const canShowWidget = !user || isCustomerRole(role);
  const canChat = Boolean(user?.token || localStorage.getItem("token")) && isCustomerRole(role);

  const myId = user?._id || user?.id || user?.userId;
  const token = user?.token || localStorage.getItem("token");

  const [open, setOpen] = useState(false);
  const [activeChannel, setActiveChannel] = useState(() => {
    const saved = localStorage.getItem(LAST_ACTIVE_CHANNEL_KEY);
    return saved === "bot" ? "bot" : "support";
  });
  const [draft, setDraft] = useState("");
  const [socketStatus, setSocketStatus] = useState("disconnected");
  const [showActionMenu, setShowActionMenu] = useState(false);
  const [showEndConfirm, setShowEndConfirm] = useState(false);
  const [channels, setChannels] = useState(() => ({
    support: createChannelState(),
    bot: createChannelState(),
  }));

  const socketRef = useRef(null);
  const channelsRef = useRef(channels);
  const activeChannelRef = useRef(activeChannel);
  const openRef = useRef(open);
  const messagesContainerRef = useRef(null);
  const actionMenuRef = useRef(null);
  const fallbackTimersRef = useRef({ support: null, bot: null });

  useEffect(() => {
    channelsRef.current = channels;
  }, [channels]);

  useEffect(() => {
    activeChannelRef.current = activeChannel;
  }, [activeChannel]);

  useEffect(() => {
    localStorage.setItem(LAST_ACTIVE_CHANNEL_KEY, activeChannel);
  }, [activeChannel]);

  useEffect(() => {
    openRef.current = open;
  }, [open]);

  const activeMeta = CHANNELS.find((item) => item.key === activeChannel) ?? CHANNELS[0];
  const totalUnread = channels.support.unreadCount + channels.bot.unreadCount;

  const socketStatusLabel = useMemo(() => {
    if (!canChat) return "Đăng nhập để chat";
    if (socketStatus === "connected") return "Đã kết nối";
    if (socketStatus === "connecting") return "Đang kết nối...";
    return "Mất kết nối";
  }, [canChat, socketStatus]);

  const clearFallbackTimer = (channelKey) => {
    const timer = fallbackTimersRef.current[channelKey];
    if (timer) {
      window.clearTimeout(timer);
      fallbackTimersRef.current[channelKey] = null;
    }
  };

  const markRead = (channelKey) => {
    if (!socketRef.current) return;
    const channel = channelsRef.current[channelKey];
    const conversationId = channel?.conversation?._id;
    if (!conversationId) return;
    socketRef.current.emit("chat:mark_read", { conversation_id: conversationId });
  };

  const joinConversation = (conversationId) => {
    if (!conversationId || !socketRef.current) return;
    socketRef.current.emit("chat:join_conversation", { conversation_id: conversationId });
  };

  const getChannelKeyByConversationId = (conversationId) => {
    const supportId = channelsRef.current.support.conversation?._id;
    const botId = channelsRef.current.bot.conversation?._id;
    if (conversationId === supportId) return "support";
    if (conversationId === botId) return "bot";
    return null;
  };

  const setChannelState = (channelKey, updater) => {
    setChannels((prev) => {
      const current = prev[channelKey];
      const nextChannel = typeof updater === "function" ? updater(current) : updater;
      return { ...prev, [channelKey]: nextChannel };
    });
  };

  const resetChannelState = (channelKey, extra = {}) => {
    const nextChannel = { ...createChannelState(), ...extra };
    channelsRef.current = { ...channelsRef.current, [channelKey]: nextChannel };
    setChannelState(channelKey, nextChannel);
  };

  const ensureChannel = async (channelKey, options = {}) => {
    const { forceNewConversation = false } = options;
    if (!canChat) return null;
    const meta = CHANNELS.find((item) => item.key === channelKey);
    if (!meta) return null;

    const current = channelsRef.current[channelKey];
    if (!current.loading) {
      setChannelState(channelKey, { ...current, loading: true, error: "" });
    }

    try {
      const baseChannelState = forceNewConversation ? createChannelState() : current;
      let conversation = baseChannelState.conversation;
      if (forceNewConversation || current.conversationEnded) {
        conversation = null;
      }

      if (!conversation?._id) {
        const data =
          channelKey === "support"
            ? await chatApi.getOrCreateSupportConversation()
            : await chatApi.getOrCreateBotConversation();
        conversation = data?.conversation ?? null;
        if (!conversation?._id) {
          throw new Error("Không thể mở kênh chat này.");
        }
      }

      const shouldReloadMessages = !current.initialized || current.messages.length === 0;
      const messages = shouldReloadMessages
        ? (await chatApi.getMessages(conversation._id))?.messages ?? []
        : baseChannelState.messages;

      setChannelState(channelKey, {
        ...baseChannelState,
        conversation,
        messages,
        loading: false,
        error: "",
        initialized: true,
        conversationEnded: false,
        ending: false,
        unreadCount: openRef.current && activeChannelRef.current === channelKey ? 0 : baseChannelState.unreadCount,
      });

      joinConversation(conversation._id);
      if (openRef.current && activeChannelRef.current === channelKey) {
        markRead(channelKey);
      }

      return conversation;
    } catch (err) {
      setChannelState(channelKey, {
        ...current,
        loading: false,
        error: normalizeChatError(err, "Không thể mở kênh chat."),
      });
      return null;
    }
  };

  useEffect(() => {
    if (!canChat) {
      setSocketStatus("disconnected");
      setOpen(false);
      setDraft("");
      setChannels({
        support: createChannelState(),
        bot: createChannelState(),
      });
      socketRef.current?.disconnect();
      socketRef.current = null;
      return undefined;
    }

    setSocketStatus("connecting");
    const socket = io(CHAT_SOCKET_URL, {
      path: CHAT_SOCKET_PATH,
      auth: { token },
      transports: ["polling"],
    });
    socketRef.current = socket;

    socket.on("connect", () => {
      setSocketStatus("connected");
      const supportId = channelsRef.current.support.conversation?._id;
      const botId = channelsRef.current.bot.conversation?._id;
      if (supportId) joinConversation(supportId);
      if (botId) joinConversation(botId);
      if (openRef.current) markRead(activeChannelRef.current);
    });

    socket.on("disconnect", (reason) => {
      setSocketStatus("disconnected");
      if (reason !== "io client disconnect") {
        console.warn("[SupportWidget] disconnected:", reason);
      }
    });

    socket.on("connect_error", (e) => {
      setSocketStatus("disconnected");
      console.error("[SupportWidget] connect error:", e.message);
    });

    socket.on("chat:new_message", ({ conversation_id, message }) => {
      const channelKey = getChannelKeyByConversationId(conversation_id);
      if (!channelKey) return;

      clearFallbackTimer(channelKey);
      const isMine = message?.sender_id?.toString() === myId?.toString();
      const isActive = openRef.current && activeChannelRef.current === channelKey;

      setChannels((prev) => {
        const channel = prev[channelKey];
        if (channel.messages.some((item) => item._id === message._id)) return prev;

        return {
          ...prev,
          [channelKey]: {
            ...channel,
            messages: [...channel.messages, message],
            unreadCount: isMine || isActive ? 0 : channel.unreadCount + 1,
            sending: isMine ? false : channel.sending,
            typing: false,
            typingLabel: "",
            notice: isMine ? channel.notice : channel.notice,
          },
        };
      });
    });

    socket.on("chat:error", ({ message }) => {
      const channelKey = activeChannelRef.current;
      setChannelState(channelKey, (channel) => ({
        ...channel,
        error: message,
        sending: false,
        typing: false,
      }));
    });

    socket.on("chat:typing", ({ conversation_id, user_id }) => {
      const channelKey = getChannelKeyByConversationId(conversation_id);
      if (!channelKey || user_id?.toString() === myId?.toString()) return;

      const typingLabel =
        channelKey === "bot" ? "Bot đang trả lời..." : "Nhân viên đang phản hồi...";

      setChannelState(channelKey, (channel) => ({
        ...channel,
        typing: true,
        typingLabel,
      }));
    });

    socket.on("chat:stop_typing", ({ conversation_id, user_id }) => {
      const channelKey = getChannelKeyByConversationId(conversation_id);
      if (!channelKey || user_id?.toString() === myId?.toString()) return;

      setChannelState(channelKey, (channel) => ({
        ...channel,
        typing: false,
        typingLabel: "",
      }));
    });

    socket.on("chat:conversation_ended", ({ conversation_id }) => {
      const channelKey = getChannelKeyByConversationId(conversation_id);
      if (!channelKey) return;

      clearFallbackTimer(channelKey);
      setShowActionMenu(false);
      setShowEndConfirm(false);
      setDraft("");
      setChannelState(channelKey, (channel) => ({
        ...createChannelState(),
        conversationEnded: true,
        loading: false,
        initialized: true,
      }));
    });

    return () => {
      socket.disconnect();
      socketRef.current = null;
    };
  }, [canChat, myId, token]);

  useEffect(() => {
    if (!open || !canChat) return;

    const load = async () => {
      const current = channelsRef.current[activeChannel];
      if (current.conversationEnded) return;

      if (!current.conversation?._id) {
        await ensureChannel(activeChannel);
        return;
      }

      if (!current.initialized || current.messages.length === 0) {
        setChannelState(activeChannel, (channel) => ({ ...channel, loading: true, error: "" }));
        try {
          const history = await chatApi.getMessages(current.conversation._id);
          setChannelState(activeChannel, (channel) => ({
            ...channel,
            messages: history?.messages ?? [],
            loading: false,
            error: "",
            initialized: true,
          }));
          joinConversation(current.conversation._id);
        } catch (err) {
          setChannelState(activeChannel, (channel) => ({
            ...channel,
            loading: false,
            error: normalizeChatError(err, "Không thể tải tin nhắn."),
          }));
        }
      } else {
        markRead(activeChannel);
      }
    };

    load();
  }, [activeChannel, canChat, open]);

  useEffect(() => {
    if (!open) return undefined;

    const frame = window.requestAnimationFrame(() => {
      const container = messagesContainerRef.current;
      if (!container) return;
      container.scrollTop = container.scrollHeight;
    });

    return () => window.cancelAnimationFrame(frame);
  }, [channels, activeChannel, open]);

  useEffect(() => {
    return () => {
      Object.values(fallbackTimersRef.current).forEach((timer) => timer && window.clearTimeout(timer));
    };
  }, []);

  useEffect(() => {
    if (!showActionMenu) return undefined;

    const handleClickOutside = (event) => {
      if (actionMenuRef.current && !actionMenuRef.current.contains(event.target)) {
        setShowActionMenu(false);
      }
    };

    const handleEscape = (event) => {
      if (event.key === "Escape") {
        setShowActionMenu(false);
        setShowEndConfirm(false);
      }
    };

    document.addEventListener("mousedown", handleClickOutside);
    document.addEventListener("keydown", handleEscape);

    return () => {
      document.removeEventListener("mousedown", handleClickOutside);
      document.removeEventListener("keydown", handleEscape);
    };
  }, [showActionMenu]);

  const openChannel = async (channelKey) => {
    setShowActionMenu(false);
    setShowEndConfirm(false);
    setActiveChannel(channelKey);
    setOpen(true);
    const current = channelsRef.current[channelKey];
    if (canChat && !current?.conversationEnded) {
      await ensureChannel(channelKey);
    }
  };

  const handleSend = async () => {
    const text = draft.trim();
    if (!text || !canChat || !socketRef.current) return;

    const current = channelsRef.current[activeChannel];
    let conversationId = current?.conversation?._id;
    if (!conversationId) {
      const conversation = await ensureChannel(activeChannel);
      conversationId = conversation?._id;
      if (!conversationId) return;
    }

    clearFallbackTimer(activeChannel);
    setChannelState(activeChannel, (channel) => ({
      ...channel,
      sending: true,
      error: "",
      notice: activeChannel === "bot" ? "" : channel.notice,
    }));

    socketRef.current.emit("chat:send_message", {
      conversation_id: conversationId,
      content: text,
    });
    setDraft("");

    if (activeChannel === "bot") {
      fallbackTimersRef.current.bot = window.setTimeout(() => {
        setChannelState("bot", (channel) => ({
          ...channel,
          sending: false,
          notice: CHANNELS.find((item) => item.key === "bot")?.fallbackHint || "",
        }));
      }, 18000);
    }
  };

  const handleEndChat = async () => {
    const current = channelsRef.current[activeChannel];
    const conversationId = current?.conversation?._id;
    if (!conversationId || current?.ending) {
      setShowEndConfirm(false);
      setShowActionMenu(false);
      return;
    }

    setChannelState(activeChannel, (channel) => ({
      ...channel,
      ending: true,
      error: "",
    }));

    try {
      await chatApi.endConversation(conversationId);
      socketRef.current?.emit("chat:leave_conversation", { conversation_id: conversationId });
      clearFallbackTimer(activeChannel);
      setDraft("");
      setShowEndConfirm(false);
      setShowActionMenu(false);
      setChannelState(activeChannel, {
        ...createChannelState(),
        conversationEnded: true,
        loading: false,
        initialized: true,
      });
    } catch (err) {
      setChannelState(activeChannel, (channel) => ({
        ...channel,
        ending: false,
        error: normalizeChatError(err, "Chưa thể kết thúc cuộc trò chuyện. Vui lòng thử lại."),
      }));
    }
  };

  const handleStartNewChat = async () => {
    clearFallbackTimer(activeChannel);
    setDraft("");
    setShowEndConfirm(false);
    setShowActionMenu(false);
    resetChannelState(activeChannel, { initialized: false });

    if (!canChat) {
      return;
    }

    // Conversation mới sẽ được tạo khi khách gửi tin đầu tiên.
    const conversation = channelsRef.current[activeChannel]?.conversation;
    if (conversation?._id) {
      socketRef.current?.emit("chat:leave_conversation", { conversation_id: conversation._id });
    }
  };

  const activeChannelState = channels[activeChannel];
  const activeChannelMeta = CHANNELS.find((item) => item.key === activeChannel) ?? CHANNELS[0];
  const showEndPrompt =
    open &&
    !activeChannelState.loading &&
    !activeChannelState.conversationEnded &&
    Boolean(activeChannelState.conversation?._id) &&
    activeChannelState.messages.length > 0;
  const activeStatusText =
    activeChannel === "bot" && activeChannelState.typing
      ? "Bot đang trả lời..."
      : activeChannel === "support" && activeChannelState.typing
      ? "Nhân viên đang phản hồi..."
      : socketStatusLabel;

  const renderMessageBubble = (message) => {
    const isMine = message?.sender_id?.toString() === myId?.toString();

    const bubbleClass = isMine
      ? "bg-[#8fbfb3] text-white"
      : activeChannel === "bot"
      ? "bg-white text-stone-800 border border-[#e3dccf]"
      : "bg-[#f3f8f7] text-stone-800 border border-[#dce8e4]";

    const accent = isMine
      ? "text-white/70"
      : activeChannel === "bot"
      ? "text-sky-500"
      : "text-emerald-500";

    const senderName =
      !isMine && !message?.is_deleted
        ? activeChannel === "bot"
          ? "Bot SE Hotel"
          : message?.sender_name || "Nhân viên hỗ trợ"
        : "";

    return (
      <div key={getMessageKey(message)} className={`flex ${isMine ? "justify-end" : "justify-start"}`}>
        <div className="max-w-[84%]">
          {senderName ? <p className="mb-1 ml-1 text-[11px] font-medium text-stone-400">{senderName}</p> : null}
          <div className={`rounded-[20px] px-4 py-2.5 text-sm leading-6 shadow-sm ${bubbleClass}`}>
            <p className="whitespace-pre-wrap break-words">
              {message?.is_deleted ? "Tin nhắn đã bị xóa" : message?.content}
            </p>
            <div className={`mt-1 text-[11px] ${accent}`}>
              {formatTime(message?.created_at)}
              {message?.edited_at ? " · đã chỉnh sửa" : ""}
            </div>
          </div>
        </div>
      </div>
    );
  };

  const renderTab = (item) => {
    const Icon = item.icon;
    const channelState = channels[item.key];
    const isActive = activeChannel === item.key;
    const unread = channelState.unreadCount;

    return (
      <button
        key={item.key}
        type="button"
        onClick={() => openChannel(item.key)}
        className={`relative flex-1 rounded-2xl border px-3 py-2.5 text-left transition ${
          isActive
            ? item.accent === "emerald"
              ? "border-emerald-200 bg-white text-emerald-900 shadow-sm"
              : "border-sky-200 bg-white text-sky-900 shadow-sm"
            : "border-transparent bg-[#f8f3eb] text-stone-600 hover:bg-white"
        }`}
      >
        <div className="flex items-center gap-2">
          <span
            className={`inline-flex h-8 w-8 items-center justify-center rounded-xl ${
              item.accent === "emerald" ? "bg-emerald-100 text-emerald-700" : "bg-sky-100 text-sky-700"
            }`}
          >
            <Icon size={16} />
          </span>
          <div className="min-w-0 flex-1">
            <p className="truncate text-sm font-semibold">{item.label}</p>
            <p className="truncate text-[11px] leading-4 text-stone-500">
              {item.key === "bot" ? "Tự động trả lời nhanh" : "Phản hồi từ khách sạn"}
            </p>
          </div>
        </div>
        {unread > 0 ? (
          <span className="absolute right-3 top-3 inline-flex min-w-5 items-center justify-center rounded-full bg-amber-300 px-1.5 py-0.5 text-[10px] font-bold text-stone-900">
            {unread > 99 ? "99+" : unread}
          </span>
        ) : null}
      </button>
    );
  };

  const renderThankYouState = () => (
    <div className="flex h-full flex-col items-center justify-center px-6 text-center">
      <div className="max-w-[320px] rounded-[28px] border border-[#dbe8e2] bg-white px-5 py-6 shadow-sm">
        <p className="text-lg font-semibold text-stone-900">Cuộc trò chuyện đã kết thúc</p>
        <p className="mt-2 text-sm leading-6 text-stone-600">
          SE Hotel cảm ơn anh/chị đã liên hệ. Khi cần thêm thông tin về phòng, đặt phòng hoặc dịch vụ, anh/chị có thể bắt đầu đoạn chat mới bất cứ lúc nào.
        </p>
      </div>
      <div className="mt-5 flex w-full max-w-[320px] flex-col gap-2">
        <button
          type="button"
          onClick={handleStartNewChat}
          disabled={!canChat || activeChannelState.ending}
          className="inline-flex items-center justify-center gap-2 rounded-full bg-[#8fbfb3] px-4 py-2.5 text-sm font-semibold text-white transition hover:bg-[#7ba89c] disabled:cursor-not-allowed disabled:opacity-60"
        >
          <CheckCircle2 size={16} />
          {activeChannelState.ending ? "Đang khởi tạo..." : "Bắt đầu chat mới"}
        </button>
        <button
          type="button"
          onClick={() => setOpen(false)}
          className="inline-flex items-center justify-center rounded-full border border-[#dbe8e2] bg-white px-4 py-2.5 text-sm font-semibold text-stone-700 transition hover:bg-stone-50"
        >
          Đóng cửa sổ
        </button>
      </div>
    </div>
  );

  const renderEmptyState = () => {
    const current = activeChannelState;
    if (current.conversationEnded) {
      return renderThankYouState();
    }
    if (current.loading && !current.conversation?._id) {
      return (
        <div className="flex h-full flex-col items-center justify-center px-6 text-center">
          <Loader2 size={32} className={`animate-spin ${activeChannel === "bot" ? "text-sky-500" : "text-emerald-500"}`} />
          <p className="mt-4 text-sm font-medium text-stone-700">{activeChannelMeta.loadingText}</p>
        </div>
      );
    }

    if (!canChat) {
      return (
        <div className="flex h-full flex-col items-center justify-center px-6 text-center">
          <MessageCircle size={42} className="text-stone-300" />
          <h3 className="mt-4 text-lg font-semibold text-stone-900">Vui lòng đăng nhập để chat với khách sạn.</h3>
          <p className="mt-2 text-sm leading-6 text-stone-600">
            Sau khi đăng nhập, bạn có thể chọn Bot SE Hotel hoặc Nhân viên hỗ trợ ngay trong cửa sổ này.
          </p>
          <div className="mt-5 flex flex-wrap items-center justify-center gap-3">
            <Link
              to="/login"
              className="inline-flex items-center gap-2 rounded-full bg-[#8fbfb3] px-4 py-2.5 text-sm font-semibold text-white transition hover:bg-[#7ba89c]"
            >
              <LogIn size={16} />
              Đăng nhập
            </Link>
          </div>
        </div>
      );
    }

    if (current.error && !current.messages.length) {
      return (
        <div className="flex h-full flex-col items-center justify-center px-6 text-center">
          <MessageCircle size={38} className="text-stone-300" />
          <h3 className="mt-4 text-lg font-semibold text-stone-900">Chưa thể tải lịch sử trò chuyện.</h3>
          <p className="mt-2 text-sm leading-6 text-stone-600">{current.error}</p>
          <button
            type="button"
            onClick={() => ensureChannel(activeChannel)}
            className="mt-5 inline-flex items-center gap-2 rounded-full bg-[#8fbfb3] px-4 py-2.5 text-sm font-semibold text-white transition hover:bg-[#7ba89c]"
          >
            Thử lại
          </button>
        </div>
      );
    }

    if (current.messages.length === 0) {
      return (
        <div className="flex h-full flex-col justify-center px-4 py-4">
          <div
            className={`max-w-[92%] rounded-[24px] px-4 py-3 shadow-sm ${
              activeChannel === "bot"
                ? "border border-sky-200 bg-white"
                : "border border-emerald-100 bg-[#f4fbf8]"
            }`}
          >
            <div className="mb-2 flex items-center gap-2 text-[11px] font-semibold uppercase tracking-[0.18em] text-stone-400">
              <span className={`h-2 w-2 rounded-full ${activeChannel === "bot" ? "bg-sky-400" : "bg-emerald-400"}`} />
              {activeChannelMeta.label}
            </div>
            <p className="text-sm leading-6 text-stone-700">{activeChannelMeta.intro}</p>
          </div>
          <p className="mt-3 px-2 text-xs leading-5 text-stone-500">
            {activeChannel === "bot"
              ? "Bạn có thể hỏi về phòng, đặt phòng hoặc dịch vụ khách sạn."
              : "Nhân viên khách sạn sẽ phản hồi sớm nhất có thể."}
          </p>
        </div>
      );
    }

    return (
      <div className="space-y-3">
        {current.messages.map(renderMessageBubble)}
      </div>
    );
  };

  if (!canShowWidget) return null;

  const widget = (
    <>
      <style>{`
        @keyframes supportWidgetPop {
          from { opacity: 0; transform: translateY(12px) scale(0.98); }
          to { opacity: 1; transform: translateY(0) scale(1); }
        }
      `}</style>

      {!open ? (
        <button
          type="button"
          onClick={() => setOpen(true)}
          className="fixed bottom-4 right-4 z-[9999] inline-flex items-center gap-2 rounded-full border border-[#d9e6df] bg-[#f6f2ea] px-4 py-3 text-sm font-semibold text-stone-800 shadow-[0_16px_40px_rgba(142,128,108,0.18)] transition hover:-translate-y-0.5 hover:bg-white sm:bottom-6 sm:right-6"
          aria-label="Mở trung tâm hỗ trợ"
        >
          <MessageCircle size={18} className="text-emerald-600" />
          <span>Hỗ trợ</span>
          {totalUnread > 0 ? (
            <span className="ml-1 inline-flex min-w-6 items-center justify-center rounded-full bg-emerald-100 px-2 py-0.5 text-xs font-bold text-emerald-700">
              {totalUnread > 99 ? "99+" : totalUnread}
            </span>
          ) : null}
        </button>
      ) : (
        <div
          className="fixed bottom-3 right-3 z-[9999] flex h-[72vh] w-[calc(100vw-1rem)] max-w-[430px] flex-col overflow-hidden rounded-[28px] border border-[#e8dfd2] bg-[#fbf8f2] shadow-[0_30px_80px_rgba(130,116,94,0.18)] sm:bottom-6 sm:right-6 sm:h-[580px] sm:w-[410px]"
          style={{ animation: "supportWidgetPop 180ms ease-out" }}
        >
          <div className="flex items-start justify-between gap-3 border-b border-[#e7dfd2] bg-gradient-to-r from-[#f6f1e6] via-[#f3f7f0] to-[#eef5fb] px-4 py-4">
            <div className="min-w-0">
              <p className="text-sm font-semibold tracking-[0.08em] text-stone-900">Trung tâm hỗ trợ</p>
              <p className="mt-1 text-xs leading-5 text-stone-600">
                Chọn chat với bot hoặc nhân viên để được hỗ trợ nhanh.
              </p>
            </div>
            <div className="flex items-center gap-1">
              <div className="relative">
                <button
                  type="button"
                  onClick={() => setShowActionMenu((prev) => !prev)}
                  className="rounded-full p-2 text-stone-500 transition hover:bg-white/70 hover:text-stone-900"
                  aria-label="Mở menu chat"
                >
                  <MoreHorizontal size={18} />
                </button>

                {showActionMenu && activeChannelState.conversation?._id && !activeChannelState.conversationEnded ? (
                  <div className="absolute right-0 top-full z-50 mt-2 w-48 overflow-hidden rounded-2xl border border-stone-200 bg-white p-1 shadow-[0_18px_45px_rgba(28,25,23,0.14)]">
                    <button
                      type="button"
                      onClick={() => {
                        setShowActionMenu(false);
                        setShowEndConfirm(true);
                      }}
                      className="flex w-full items-center gap-2 rounded-xl px-3 py-2.5 text-left text-sm font-medium text-stone-700 transition hover:bg-amber-50 hover:text-stone-950"
                    >
                      <X size={14} />
                      Kết thúc chat
                    </button>
                  </div>
                ) : null}
              </div>

              <button
                type="button"
                onClick={() => {
                  setShowActionMenu(false);
                  setOpen(false);
                }}
                className="rounded-full p-2 text-stone-500 transition hover:bg-white/70 hover:text-stone-900"
                aria-label="Đóng trung tâm hỗ trợ"
              >
                <X size={18} />
              </button>
            </div>
          </div>

          <div className="flex items-center justify-between gap-3 border-b border-[#e7dfd2] bg-white/70 px-4 py-2.5 text-xs text-stone-600">
            <span className="inline-flex items-center gap-2 font-medium">
              <span
                className={`h-2 w-2 rounded-full ${
                  socketStatus === "connected" ? "bg-emerald-500" : socketStatus === "connecting" ? "bg-amber-400" : "bg-sky-300"
                }`}
              />
              {activeStatusText}
            </span>
            <span className="truncate font-semibold text-stone-700">{activeMeta.label}</span>
          </div>

          <div className="border-b border-[#e7dfd2] bg-[#fbf8f2] px-3 py-3">
            <div className="grid grid-cols-2 gap-2">
              {CHANNELS.map(renderTab)}
            </div>
          </div>

          <div ref={messagesContainerRef} className="flex-1 overflow-y-auto bg-[#fcfbf7] px-3 py-4">
            {renderEmptyState()}
            {activeChannelState.typing ? (
              <div className="mt-4 flex items-center gap-2 px-4">
                <Loader2 size={14} className="animate-spin text-emerald-500" />
                <span className="text-xs font-medium text-stone-500">{activeChannelState.typingLabel}</span>
              </div>
            ) : null}
          </div>

          {activeChannelState.conversationEnded ? null : (
          <div className="border-t border-[#e7dfd2] bg-white/80 px-3 py-3">
            {showEndPrompt ? (
              <button
                type="button"
                onClick={() => setShowEndConfirm(true)}
                className="mb-3 inline-flex w-fit items-center gap-2 rounded-full border border-[#dbe8e2] bg-[#f4fbf8] px-4 py-2.5 text-left text-sm font-semibold text-stone-800 transition hover:border-[#bfd7ce] hover:bg-[#eef8f3]"
              >
                <span className="inline-flex items-center gap-2">
                  <CheckCircle2 size={16} className="text-emerald-600" />
                  Tôi đã được hỗ trợ xong
                </span>
              </button>
            ) : null}

            <div className="mb-2 flex items-center justify-between gap-2">
              <p className="text-[11px] font-medium text-stone-500">
                {activeChannel === "bot"
                  ? "Bot trả lời ngay các câu hỏi phổ biến."
                  : "Khách sạn sẽ phản hồi sớm nhất có thể."}
                </p>
                {activeChannelState.notice ? (
                  <p className="text-[11px] font-medium text-amber-700">{activeChannelState.notice}</p>
                ) : null}
              </div>

              {activeChannelState.error ? (
                <div className="mb-2 rounded-2xl border border-rose-200 bg-rose-50 px-3 py-2 text-xs leading-5 text-rose-700">
                  {activeChannelState.error}
                </div>
              ) : null}

              <div className="flex items-end gap-2">
                <textarea
                  rows={1}
                  value={draft}
                  onChange={(e) => setDraft(e.target.value)}
                  onKeyDown={(e) => {
                    if (e.key === "Enter" && !e.shiftKey) {
                      e.preventDefault();
                      handleSend();
                    }
                  }}
                  disabled={!canChat || activeChannelState.sending}
                  placeholder="Nhập tin nhắn..."
                  className="min-h-[52px] flex-1 resize-none rounded-2xl border border-[#dfd6c9] bg-white px-4 py-3 text-sm text-stone-800 outline-none transition placeholder:text-stone-400 focus:border-[#9cc8bf] focus:ring-4 focus:ring-[#dff0ea] disabled:bg-stone-50 disabled:text-stone-400"
                />
                <button
                  type="button"
                  onClick={handleSend}
                  disabled={!canChat || !draft.trim() || activeChannelState.sending}
                  className="inline-flex h-[52px] w-[52px] shrink-0 items-center justify-center rounded-2xl bg-[#8fbfb3] text-white shadow-sm transition hover:bg-[#7ca99c] disabled:cursor-not-allowed disabled:opacity-50"
                  aria-label="Gửi tin nhắn"
                >
                  {activeChannelState.sending ? <Loader2 size={18} className="animate-spin" /> : <Send size={18} />}
                </button>
              </div>
            </div>
          )}

          {showEndConfirm ? (
            <div className="absolute inset-0 z-50 flex items-center justify-center bg-stone-950/20 px-4 backdrop-blur-[1px]">
              <div className="w-full max-w-sm rounded-[28px] border border-stone-200 bg-white p-5 shadow-[0_24px_60px_rgba(28,25,23,0.18)]">
                <p className="text-base font-semibold text-stone-950">Bạn muốn kết thúc cuộc trò chuyện?</p>
                <p className="mt-2 text-sm leading-6 text-stone-600">
                  Nếu vấn đề đã được hỗ trợ xong, anh/chị có thể kết thúc cuộc trò chuyện tại đây. Khi cần hỗ trợ thêm, anh/chị vẫn có thể bắt đầu đoạn chat mới bất cứ lúc nào.
                </p>
                {activeChannelState.error ? (
                  <div className="mt-3 rounded-2xl border border-rose-200 bg-rose-50 px-3 py-2 text-xs leading-5 text-rose-700">
                    {activeChannelState.error}
                  </div>
                ) : null}
                <div className="mt-5 flex items-center justify-end gap-3">
                  <button
                    type="button"
                    onClick={() => setShowEndConfirm(false)}
                    className="rounded-full px-4 py-2.5 text-sm font-semibold text-stone-600 transition hover:bg-stone-100"
                    disabled={activeChannelState.ending}
                  >
                    Tiếp tục chat
                  </button>
                  <button
                    type="button"
                    onClick={handleEndChat}
                    disabled={activeChannelState.ending}
                    className="rounded-full bg-[#8fbfb3] px-4 py-2.5 text-sm font-semibold text-white transition hover:bg-[#7ba89c] disabled:cursor-not-allowed disabled:opacity-70"
                  >
                    {activeChannelState.ending ? "Đang kết thúc..." : "Kết thúc cuộc trò chuyện"}
                  </button>
                </div>
              </div>
            </div>
          ) : null}
        </div>
      )}
    </>
  );

  return typeof document !== "undefined" ? createPortal(widget, document.body) : widget;
}
