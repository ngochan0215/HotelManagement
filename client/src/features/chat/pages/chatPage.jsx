import { useState, useEffect, useRef } from "react";
import { io } from "socket.io-client";
import { Send, Plus, X, MessageSquare, Pencil, Trash2, Check } from "lucide-react";
import { useAuth } from "../../auth/hooks/authContext.jsx";
import { chatApi } from "../api/chatApi.js";

const CHAT_SOCKET_URL = "http://localhost:3014";

function formatTime(dateStr) {
    if (!dateStr) return "";
    const d = new Date(dateStr);
    return d.toLocaleTimeString("vi-VN", { hour: "2-digit", minute: "2-digit" });
}

function formatDate(dateStr) {
    if (!dateStr) return "";
    const d = new Date(dateStr);
    return d.toLocaleDateString("vi-VN", { day: "2-digit", month: "2-digit" });
}

export default function ChatPage() {
    const { user } = useAuth();
    const [conversations, setConversations] = useState([]);
    const [activeConvId, setActiveConvId] = useState(null);
    const [messages, setMessages] = useState([]);
    const [input, setInput] = useState("");
    const [showNewConv, setShowNewConv] = useState(false);
    const [newTarget, setNewTarget] = useState("");
    const [error, setError] = useState("");

    // Edit state
    const [editingMsgId, setEditingMsgId] = useState(null);
    const [editContent, setEditContent] = useState("");

    const socketRef = useRef(null);
    const activeConvIdRef = useRef(null);
    const bottomRef = useRef(null);
    const inputRef = useRef(null);
    const editInputRef = useRef(null);

    // Keep ref in sync with state for use inside socket listeners
    useEffect(() => { activeConvIdRef.current = activeConvId; }, [activeConvId]);

    // Focus edit textarea when edit mode activates
    useEffect(() => {
        if (editingMsgId) editInputRef.current?.focus();
    }, [editingMsgId]);

    // Connect socket once on mount
    useEffect(() => {
        const socket = io(CHAT_SOCKET_URL, {
            auth: { token: localStorage.getItem("token") },
        });
        socketRef.current = socket;

        socket.on("connect", () => console.log("[CHAT] socket connected"));
        socket.on("connect_error", (err) => console.error("[CHAT] connect error:", err.message));

        socket.on("chat:new_message", ({ conversation_id, message }) => {
            const isActive = activeConvIdRef.current === conversation_id;
            if (isActive) {
                setMessages((prev) => [...prev, message]);
            }
            setConversations((prev) =>
                prev.map((c) =>
                    c._id === conversation_id
                        ? {
                              ...c,
                              last_message: { content: message.content, sender_name: message.sender_name, sent_at: message.created_at },
                              unread_count: isActive ? 0 : (c.unread_count ?? 0) + 1,
                          }
                        : c
                )
            );
        });

        socket.on("chat:message_deleted", ({ conversation_id, message_id }) => {
            if (activeConvIdRef.current === conversation_id) {
                setMessages((prev) =>
                    prev.map((m) =>
                        m._id === message_id
                            ? { ...m, is_deleted: true, content: "" }
                            : m
                    )
                );
            }
            // Clear last_message preview in sidebar if it was showing the deleted message
            setConversations((prev) =>
                prev.map((c) => {
                    if (c._id !== conversation_id) return c;
                    // We don't know which message is now last — just clear the preview text
                    // (backend already updated last_message; will reflect on next load)
                    return c;
                })
            );
        });

        socket.on("chat:message_updated", ({ conversation_id, message }) => {
            if (activeConvIdRef.current === conversation_id) {
                setMessages((prev) =>
                    prev.map((m) => (m._id === message._id ? message : m))
                );
            }
            // Update sidebar preview if this was the last message
            setConversations((prev) =>
                prev.map((c) =>
                    c._id === conversation_id &&
                    c.last_message?.sent_at === message.created_at
                        ? { ...c, last_message: { ...c.last_message, content: message.content } }
                        : c
                )
            );
        });

        socket.on("chat:error", ({ message }) => setError(message));

        return () => socket.disconnect();
    }, []);

    // Load conversation list
    useEffect(() => {
        chatApi.getConversations()
            .then((data) => setConversations(data.conversations ?? []))
            .catch((err) => setError(err.message));
    }, []);

    // Load messages when switching conversation + mark as read
    useEffect(() => {
        if (!activeConvId) return;
        setMessages([]);
        setEditingMsgId(null);
        chatApi.getMessages(activeConvId)
            .then((data) => setMessages(data.messages ?? []))
            .catch((err) => setError(err.message));

        socketRef.current?.emit("chat:mark_read", { conversation_id: activeConvId });
        setConversations((prev) =>
            prev.map((c) => c._id === activeConvId ? { ...c, unread_count: 0 } : c)
        );
    }, [activeConvId]);

    // Auto-scroll to bottom on new messages
    useEffect(() => {
        bottomRef.current?.scrollIntoView({ behavior: "smooth" });
    }, [messages]);

    const sendMessage = () => {
        const text = input.trim();
        if (!text || !activeConvId || !socketRef.current) return;
        socketRef.current.emit("chat:send_message", { conversation_id: activeConvId, content: text });
        setInput("");
        inputRef.current?.focus();
    };

    const handleKeyDown = (e) => {
        if (e.key === "Enter" && !e.shiftKey) {
            e.preventDefault();
            sendMessage();
        }
    };

    const handleDeleteMessage = (messageId) => {
        if (!activeConvId || !socketRef.current) return;
        socketRef.current.emit("chat:delete_message", {
            conversation_id: activeConvId,
            message_id: messageId,
        });
    };

    const startEdit = (msg) => {
        setEditingMsgId(msg._id);
        setEditContent(msg.content);
    };

    const cancelEdit = () => {
        setEditingMsgId(null);
        setEditContent("");
    };

    const saveEdit = () => {
        const text = editContent.trim();
        if (!text || !activeConvId || !socketRef.current) return;
        socketRef.current.emit("chat:edit_message", {
            conversation_id: activeConvId,
            message_id: editingMsgId,
            content: text,
        });
        setEditingMsgId(null);
        setEditContent("");
    };

    const handleEditKeyDown = (e) => {
        if (e.key === "Enter" && !e.shiftKey) { e.preventDefault(); saveEdit(); }
        if (e.key === "Escape") cancelEdit();
    };

    const startDirectConversation = async () => {
        const target = newTarget.trim();
        if (!target) return;
        setError("");
        try {
            const data = await chatApi.createConversation({ type: "direct", target_user_id: target });
            const conv = data.conversation;
            setConversations((prev) => [conv, ...prev.filter((c) => c._id !== conv._id)]);
            setActiveConvId(conv._id);
            socketRef.current?.emit("chat:join_conversation", { conversation_id: conv._id });
            setShowNewConv(false);
            setNewTarget("");
        } catch (err) {
            setError(err.response?.data?.message ?? err.message);
        }
    };

    const activeConv = conversations.find((c) => c._id === activeConvId);
    const myId = user?._id ?? user?.id ?? user?.userId;
    const isGroupCreator =
        activeConv?.type === "group" &&
        activeConv?.created_by?.toString() === myId?.toString();

    const getConvLabel = (conv) => {
        if (conv.type === "group") return conv.name ?? "Group";
        const other = conv.participants?.find((p) => p.user_id?.toString() !== myId?.toString());
        return other ? `${other.role} · ${other.user_id?.toString().slice(-6)}` : "Direct";
    };

    return (
        <div className="flex h-[calc(100vh-120px)] bg-white rounded-xl shadow overflow-hidden border border-gray-200">

            {/* ── Sidebar ── */}
            <div className="w-72 flex flex-col border-r border-gray-200 bg-gray-50">
                <div className="flex items-center justify-between px-4 py-3 border-b border-gray-200">
                    <span className="font-semibold text-gray-700 flex items-center gap-2">
                        <MessageSquare size={18} /> Chat
                    </span>
                    <button
                        onClick={() => { setShowNewConv(true); setError(""); }}
                        className="p-1 rounded-md hover:bg-gray-200 text-gray-500 hover:text-indigo-600 transition"
                        title="New conversation"
                    >
                        <Plus size={18} />
                    </button>
                </div>

                {showNewConv && (
                    <div className="px-3 py-2 border-b border-gray-200 bg-white">
                        <p className="text-xs text-gray-500 mb-1">Target User ID</p>
                        <div className="flex gap-1">
                            <input
                                autoFocus
                                value={newTarget}
                                onChange={(e) => setNewTarget(e.target.value)}
                                onKeyDown={(e) => e.key === "Enter" && startDirectConversation()}
                                placeholder="Paste user _id..."
                                className="flex-1 text-sm border border-gray-300 rounded px-2 py-1 focus:outline-none focus:ring-1 focus:ring-indigo-400"
                            />
                            <button onClick={startDirectConversation} className="px-2 py-1 bg-indigo-600 text-white rounded text-sm hover:bg-indigo-700">Go</button>
                            <button onClick={() => { setShowNewConv(false); setError(""); }} className="p-1 text-gray-400 hover:text-gray-600"><X size={16} /></button>
                        </div>
                    </div>
                )}

                <div className="flex-1 overflow-y-auto">
                    {conversations.length === 0 && (
                        <p className="text-center text-gray-400 text-sm mt-8">No conversations yet</p>
                    )}
                    {conversations.map((conv) => {
                        const hasUnread = (conv.unread_count ?? 0) > 0;
                        const isActive = activeConvId === conv._id;
                        return (
                            <button
                                key={conv._id}
                                onClick={() => setActiveConvId(conv._id)}
                                className={`w-full text-left px-4 py-3 border-b border-gray-100 hover:bg-white transition ${isActive ? "bg-white border-l-2 border-l-indigo-500" : hasUnread ? "bg-indigo-50" : ""}`}
                            >
                                <div className="flex justify-between items-center gap-1">
                                    <span className={`text-sm truncate max-w-[120px] ${hasUnread ? "font-semibold text-gray-900" : "font-medium text-gray-700"}`}>
                                        {getConvLabel(conv)}
                                    </span>
                                    <div className="flex items-center gap-1.5 flex-shrink-0">
                                        <span className="text-xs text-gray-400">
                                            {formatDate(conv.last_message?.sent_at ?? conv.created_at)}
                                        </span>
                                        {hasUnread && (
                                            <span className="bg-indigo-600 text-white text-xs font-semibold rounded-full min-w-[18px] h-[18px] flex items-center justify-center px-1">
                                                {conv.unread_count > 99 ? "99+" : conv.unread_count}
                                            </span>
                                        )}
                                    </div>
                                </div>
                                <p className={`text-xs truncate mt-0.5 ${hasUnread ? "text-gray-700 font-medium" : "text-gray-500"}`}>
                                    {conv.last_message?.content ?? "No messages yet"}
                                </p>
                            </button>
                        );
                    })}
                </div>
            </div>

            {/* ── Message thread ── */}
            <div className="flex-1 flex flex-col">
                {!activeConvId ? (
                    <div className="flex-1 flex items-center justify-center text-gray-400">
                        <div className="text-center">
                            <MessageSquare size={40} className="mx-auto mb-2 opacity-30" />
                            <p>Select a conversation or start a new one</p>
                        </div>
                    </div>
                ) : (
                    <>
                        <div className="px-5 py-3 border-b border-gray-200 bg-white">
                            <p className="font-semibold text-gray-700">{activeConv ? getConvLabel(activeConv) : ""}</p>
                            <p className="text-xs text-gray-400">{activeConv?.type === "group" ? "Group" : "Direct message"}</p>
                        </div>

                        <div className="flex-1 overflow-y-auto px-5 py-4 space-y-3 bg-gray-50">
                            {messages.map((msg) => {
                                const isMine = msg.sender_id?.toString() === myId?.toString();
                                const canEdit = isMine && !msg.is_deleted;
                                const canDelete = (isMine || isGroupCreator) && !msg.is_deleted;
                                const isEditing = editingMsgId === msg._id;

                                return (
                                    <div key={msg._id} className={`flex group ${isMine ? "justify-end" : "justify-start"}`}>

                                        {/* Action buttons — shown on hover, positioned opposite to bubble */}
                                        {(canEdit || canDelete) && !isEditing && (
                                            <div className={`flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity self-center ${isMine ? "order-first mr-2" : "order-last ml-2"}`}>
                                                {canEdit && (
                                                    <button
                                                        onClick={() => startEdit(msg)}
                                                        className="p-1 rounded-md bg-white border border-gray-200 text-gray-400 hover:text-indigo-600 hover:border-indigo-300 shadow-sm transition"
                                                        title="Edit"
                                                    >
                                                        <Pencil size={13} />
                                                    </button>
                                                )}
                                                {canDelete && (
                                                    <button
                                                        onClick={() => handleDeleteMessage(msg._id)}
                                                        className="p-1 rounded-md bg-white border border-gray-200 text-gray-400 hover:text-red-500 hover:border-red-300 shadow-sm transition"
                                                        title="Delete"
                                                    >
                                                        <Trash2 size={13} />
                                                    </button>
                                                )}
                                            </div>
                                        )}

                                        <div className={`max-w-[65%] flex flex-col ${isMine ? "items-end" : "items-start"}`}>
                                            {!isMine && !msg.is_deleted && (
                                                <span className="text-xs text-gray-400 mb-1 ml-1">{msg.sender_name}</span>
                                            )}

                                            {msg.is_deleted ? (
                                                /* Deleted message placeholder */
                                                <div className="px-4 py-2 rounded-2xl text-sm italic text-gray-400 bg-gray-100 border border-dashed border-gray-300">
                                                    Tin nhắn đã bị xóa
                                                </div>
                                            ) : isEditing ? (
                                                /* Inline edit UI */
                                                <div className="flex flex-col gap-1.5 w-full min-w-[200px]">
                                                    <textarea
                                                        ref={editInputRef}
                                                        value={editContent}
                                                        onChange={(e) => setEditContent(e.target.value)}
                                                        onKeyDown={handleEditKeyDown}
                                                        rows={2}
                                                        className="w-full resize-none border border-indigo-400 rounded-xl px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-400"
                                                    />
                                                    <div className="flex gap-1 justify-end">
                                                        <button
                                                            onClick={cancelEdit}
                                                            className="px-2 py-0.5 text-xs rounded-md border border-gray-300 text-gray-500 hover:bg-gray-100"
                                                        >
                                                            Cancel
                                                        </button>
                                                        <button
                                                            onClick={saveEdit}
                                                            disabled={!editContent.trim()}
                                                            className="px-2 py-0.5 text-xs rounded-md bg-indigo-600 text-white hover:bg-indigo-700 disabled:opacity-40 flex items-center gap-1"
                                                        >
                                                            <Check size={11} /> Save
                                                        </button>
                                                    </div>
                                                </div>
                                            ) : (
                                                /* Normal message bubble */
                                                <div className={`px-4 py-2 rounded-2xl text-sm leading-relaxed ${
                                                    isMine
                                                        ? "bg-indigo-600 text-white rounded-br-sm"
                                                        : "bg-white text-gray-800 border border-gray-200 rounded-bl-sm shadow-sm"
                                                }`}>
                                                    {msg.content}
                                                </div>
                                            )}

                                            {!msg.is_deleted && (
                                                <span className="text-xs text-gray-400 mt-1 mx-1 flex items-center gap-1">
                                                    {formatTime(msg.created_at)}
                                                    {msg.edited_at && <span className="italic">(đã chỉnh sửa)</span>}
                                                </span>
                                            )}
                                        </div>
                                    </div>
                                );
                            })}
                            <div ref={bottomRef} />
                        </div>

                        <div className="px-4 py-3 border-t border-gray-200 bg-white flex gap-2 items-end">
                            <textarea
                                ref={inputRef}
                                rows={1}
                                value={input}
                                onChange={(e) => setInput(e.target.value)}
                                onKeyDown={handleKeyDown}
                                placeholder="Type a message... (Enter to send)"
                                className="flex-1 resize-none border border-gray-300 rounded-xl px-4 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-400 max-h-32"
                            />
                            <button
                                onClick={sendMessage}
                                disabled={!input.trim()}
                                className="p-2.5 bg-indigo-600 text-white rounded-xl hover:bg-indigo-700 disabled:opacity-40 disabled:cursor-not-allowed transition"
                            >
                                <Send size={18} />
                            </button>
                        </div>
                    </>
                )}
            </div>

            {error && (
                <div className="absolute bottom-6 left-1/2 -translate-x-1/2 bg-red-500 text-white text-sm px-4 py-2 rounded-lg shadow-lg flex items-center gap-2">
                    {error}
                    <button onClick={() => setError("")}><X size={14} /></button>
                </div>
            )}
        </div>
    );
}
