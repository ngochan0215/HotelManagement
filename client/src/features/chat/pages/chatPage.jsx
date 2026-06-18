import { useState, useEffect, useRef } from "react";
import { io } from "socket.io-client";
import { Send, Plus, X, MessageSquare, Pencil, Trash2, Check, Users, MessageCircle, Search, Bot } from "lucide-react";
import { useAuth } from "../../auth/hooks/authContext.jsx";
import { chatApi } from "../api/chatApi.js";
import { employeeApi } from "../../api/employeeApi.js";

const CHAT_SOCKET_URL = "http://localhost:3014";
const BOT_USER_ID = "000000000000000000000001";

function formatTime(dateStr) {
    if (!dateStr) return "";
    return new Date(dateStr).toLocaleTimeString("vi-VN", { hour: "2-digit", minute: "2-digit" });
}
function formatDate(dateStr) {
    if (!dateStr) return "";
    return new Date(dateStr).toLocaleDateString("vi-VN", { day: "2-digit", month: "2-digit" });
}

// ── position badge colour ──────────────────────────────────────────
const POSITION_COLORS = {
    receptionist: "bg-blue-100 text-blue-700",
    technician:   "bg-orange-100 text-orange-700",
    housekeeper:  "bg-green-100 text-green-700",
    accountant:   "bg-purple-100 text-purple-700",
    customer_service: "bg-pink-100 text-pink-700",
    manager:      "bg-indigo-100 text-indigo-700",
};
function PositionBadge({ position }) {
    const cls = POSITION_COLORS[position] ?? "bg-gray-100 text-gray-600";
    return <span className={`text-[10px] px-1.5 py-0.5 rounded font-medium ${cls}`}>{position}</span>;
}

export default function ChatPage() {
    const { user } = useAuth();
    const myId   = user?._id ?? user?.id ?? user?.userId;
    const isManagerOrAdmin = user?.role === "manager" || user?.role === "admin";

    // ── core state ──────────────────────────────────────────────────
    const [conversations,  setConversations]  = useState([]);
    const [activeConvId,   setActiveConvId]   = useState(null);
    const [messages,       setMessages]       = useState([]);
    const [input,          setInput]          = useState("");
    const [error,          setError]          = useState("");

    // ── new-conversation menu ────────────────────────────────────────
    const [showNewMenu,    setShowNewMenu]    = useState(false);
    const newMenuRef = useRef(null);

    // ── direct conversation panel ────────────────────────────────────
    const [showDirectPanel, setShowDirectPanel] = useState(false);
    const [newTarget,        setNewTarget]       = useState("");

    // ── group creation panel ─────────────────────────────────────────
    const [showGroupPanel,   setShowGroupPanel]   = useState(false);
    const [groupEmployees,   setGroupEmployees]   = useState([]);  // all employees
    const [empSearch,        setEmpSearch]         = useState("");
    const [selectedUserIds,  setSelectedUserIds]  = useState([]);
    const [groupName,        setGroupName]        = useState("");
    const [groupLoading,     setGroupLoading]     = useState(false);

    // ── edit / delete message state ─────────────────────────────────
    const [editingMsgId, setEditingMsgId] = useState(null);
    const [editContent,  setEditContent]  = useState("");

    // ── group rename state ───────────────────────────────────────────
    const [renamingGroup, setRenamingGroup] = useState(false);
    const [renameInput,   setRenameInput]   = useState("");

    // ── bot typing indicator ─────────────────────────────────────────
    const [botTyping, setBotTyping] = useState(false);

    // ── refs ─────────────────────────────────────────────────────────
    const socketRef       = useRef(null);
    const activeConvIdRef = useRef(null);
    const bottomRef       = useRef(null);
    const inputRef        = useRef(null);
    const editInputRef    = useRef(null);
    const renameInputRef  = useRef(null);

    // ── sync refs ────────────────────────────────────────────────────
    useEffect(() => { activeConvIdRef.current = activeConvId; }, [activeConvId]);
    useEffect(() => { if (editingMsgId)  editInputRef.current?.focus();  }, [editingMsgId]);
    useEffect(() => { if (renamingGroup) renameInputRef.current?.focus(); }, [renamingGroup]);

    // ── close "+" menu when clicking outside ────────────────────────
    useEffect(() => {
        if (!showNewMenu) return;
        const handler = (e) => { if (!newMenuRef.current?.contains(e.target)) setShowNewMenu(false); };
        document.addEventListener("mousedown", handler);
        return () => document.removeEventListener("mousedown", handler);
    }, [showNewMenu]);

    // ── auto-generate group name when selection changes ──────────────
    useEffect(() => {
        if (selectedUserIds.length === 0) { setGroupName(""); return; }
        const names = groupEmployees
            .filter(e => selectedUserIds.includes(e.user_id?.toString()))
            .map(e => e.full_name.split(" ").at(-1));   // last word (given name)
        setGroupName(names.join(", "));
    }, [selectedUserIds, groupEmployees]);

    // ── socket ───────────────────────────────────────────────────────
    useEffect(() => {
        const socket = io(CHAT_SOCKET_URL, { auth: { token: localStorage.getItem("token") } });
        socketRef.current = socket;

        socket.on("connect",       () => console.log("[CHAT] connected"));
        socket.on("connect_error", (e) => console.error("[CHAT] error:", e.message));

        socket.on("chat:new_message", ({ conversation_id, message }) => {
            const isActive = activeConvIdRef.current === conversation_id;
            if (isActive) setMessages(p => [...p, message]);
            setConversations(p => p.map(c =>
                c._id === conversation_id
                    ? { ...c,
                        last_message: { content: message.content, sender_name: message.sender_name, sent_at: message.created_at },
                        unread_count: isActive ? 0 : (c.unread_count ?? 0) + 1 }
                    : c
            ));
        });

        socket.on("chat:message_deleted", ({ conversation_id, message_id }) => {
            if (activeConvIdRef.current === conversation_id)
                setMessages(p => p.map(m => m._id === message_id ? { ...m, is_deleted: true, content: "" } : m));
        });

        socket.on("chat:message_updated", ({ conversation_id, message }) => {
            if (activeConvIdRef.current === conversation_id)
                setMessages(p => p.map(m => m._id === message._id ? message : m));
            setConversations(p => p.map(c =>
                c._id === conversation_id && c.last_message?.sent_at === message.created_at
                    ? { ...c, last_message: { ...c.last_message, content: message.content } }
                    : c
            ));
        });

        socket.on("chat:conversation_renamed", ({ conversation_id, name }) => {
            setConversations(p => p.map(c => c._id === conversation_id ? { ...c, name } : c));
        });

        socket.on("chat:typing", ({ conversation_id, user_id }) => {
            if (user_id === BOT_USER_ID && activeConvIdRef.current === conversation_id)
                setBotTyping(true);
        });

        socket.on("chat:stop_typing", ({ conversation_id, user_id }) => {
            if (user_id === BOT_USER_ID && activeConvIdRef.current === conversation_id)
                setBotTyping(false);
        });

        socket.on("chat:error", ({ message }) => setError(message));

        return () => socket.disconnect();
    }, []);

    // ── load conversations ───────────────────────────────────────────
    useEffect(() => {
        chatApi.getConversations()
            .then(d => setConversations(d.conversations ?? []))
            .catch(e => setError(e.message));
    }, []);

    // ── load messages + mark read on conversation switch ─────────────
    useEffect(() => {
        if (!activeConvId) return;
        setMessages([]);
        setEditingMsgId(null);
        setBotTyping(false);
        chatApi.getMessages(activeConvId)
            .then(d => setMessages(d.messages ?? []))
            .catch(e => setError(e.message));
        socketRef.current?.emit("chat:mark_read", { conversation_id: activeConvId });
        setConversations(p => p.map(c => c._id === activeConvId ? { ...c, unread_count: 0 } : c));
    }, [activeConvId]);

    // ── scroll to bottom ─────────────────────────────────────────────
    useEffect(() => { bottomRef.current?.scrollIntoView({ behavior: "smooth" }); }, [messages]);

    // ── send message ─────────────────────────────────────────────────
    const sendMessage = () => {
        const text = input.trim();
        if (!text || !activeConvId || !socketRef.current) return;
        socketRef.current.emit("chat:send_message", { conversation_id: activeConvId, content: text });
        setInput("");
        inputRef.current?.focus();
    };
    const handleKeyDown = (e) => { if (e.key === "Enter" && !e.shiftKey) { e.preventDefault(); sendMessage(); } };

    // ── delete / edit message ────────────────────────────────────────
    const handleDeleteMessage = (msgId) => {
        socketRef.current?.emit("chat:delete_message", { conversation_id: activeConvId, message_id: msgId });
    };
    const startEdit  = (msg) => { setEditingMsgId(msg._id); setEditContent(msg.content); };
    const cancelEdit = () => { setEditingMsgId(null); setEditContent(""); };
    const saveEdit   = () => {
        if (!editContent.trim()) return;
        socketRef.current?.emit("chat:edit_message", { conversation_id: activeConvId, message_id: editingMsgId, content: editContent });
        cancelEdit();
    };
    const handleEditKeyDown = (e) => {
        if (e.key === "Enter" && !e.shiftKey) { e.preventDefault(); saveEdit(); }
        if (e.key === "Escape") cancelEdit();
    };

    // ── start direct conversation ────────────────────────────────────
    const startDirect = async () => {
        const target = newTarget.trim();
        if (!target) return;
        setError("");
        try {
            const data = await chatApi.createConversation({ type: "direct", target_user_id: target });
            const conv = data.conversation;
            setConversations(p => [conv, ...p.filter(c => c._id !== conv._id)]);
            setActiveConvId(conv._id);
            socketRef.current?.emit("chat:join_conversation", { conversation_id: conv._id });
            setShowDirectPanel(false);
            setNewTarget("");
        } catch (err) { setError(err.response?.data?.message ?? err.message); }
    };

    // ── open group panel ─────────────────────────────────────────────
    const openGroupPanel = async () => {
        setShowGroupPanel(true);
        setSelectedUserIds([]);
        setGroupName("");
        setEmpSearch("");
        if (groupEmployees.length > 0) return;        // already loaded
        try {
            const data = await employeeApi.getBriefEmployees();
            const list = (data.employees ?? []).filter(e => e.user_id?.toString() !== myId?.toString());
            setGroupEmployees(list);
        } catch (e) { setError(e.message); }
    };

    const toggleEmployee = (userId) => {
        const id = userId.toString();
        setSelectedUserIds(p => p.includes(id) ? p.filter(x => x !== id) : [...p, id]);
    };

    // ── create group conversation ─────────────────────────────────────
    const createGroup = async () => {
        if (selectedUserIds.length < 1) { setError("Select at least one other member."); return; }
        if (!groupName.trim()) { setError("Group name cannot be empty."); return; }
        setGroupLoading(true);
        setError("");
        try {
            const data = await chatApi.createConversation({
                type: "group",
                participant_ids: selectedUserIds,
                name: groupName.trim(),
            });
            const conv = data.conversation;
            setConversations(p => [conv, ...p.filter(c => c._id !== conv._id)]);
            setActiveConvId(conv._id);
            socketRef.current?.emit("chat:join_conversation", { conversation_id: conv._id });
            setShowGroupPanel(false);
        } catch (err) { setError(err.response?.data?.message ?? err.message); }
        finally { setGroupLoading(false); }
    };

    // ── start bot conversation ───────────────────────────────────────
    const startBotChat = async () => {
        setShowNewMenu(false);
        setError("");
        try {
            const data = await chatApi.createConversation({ type: "bot" });
            const conv = data.conversation;
            setConversations(p => [conv, ...p.filter(c => c._id !== conv._id)]);
            setActiveConvId(conv._id);
            socketRef.current?.emit("chat:join_conversation", { conversation_id: conv._id });
        } catch (err) { setError(err.response?.data?.message ?? err.message); }
    };

    // ── rename group ─────────────────────────────────────────────────
    const startRename = () => { setRenameInput(activeConv?.name ?? ""); setRenamingGroup(true); };
    const cancelRename = () => setRenamingGroup(false);
    const saveRename = async () => {
        if (!renameInput.trim()) return;
        try {
            await chatApi.renameGroup(activeConvId, renameInput.trim());
            // socket event will update conversations state for everyone including us
        } catch (err) { setError(err.response?.data?.message ?? err.message); }
        setRenamingGroup(false);
    };
    const handleRenameKeyDown = (e) => {
        if (e.key === "Enter") { e.preventDefault(); saveRename(); }
        if (e.key === "Escape") cancelRename();
    };

    // ── derived ──────────────────────────────────────────────────────
    const activeConv    = conversations.find(c => c._id === activeConvId);
    const isGroupCreator = activeConv?.type === "group" && activeConv?.created_by?.toString() === myId?.toString();

    const getConvLabel = (conv) => {
        if (conv.type === "bot")   return "SE Hotel Assistant";
        if (conv.type === "group") return conv.name ?? "Group";
        const other = conv.participants?.find(p => p.user_id?.toString() !== myId?.toString());
        return other ? `${other.role} · ${other.user_id?.toString().slice(-6)}` : "Direct";
    };

    const filteredEmployees = groupEmployees.filter(e =>
        e.full_name.toLowerCase().includes(empSearch.toLowerCase()) ||
        (e.position ?? "").toLowerCase().includes(empSearch.toLowerCase())
    );

    // ── render ───────────────────────────────────────────────────────
    return (
        <div className="flex h-[calc(100vh-120px)] bg-white rounded-xl shadow overflow-hidden border border-gray-200">

            {/* ════════════════════════════════ SIDEBAR ════════════════ */}
            <div className="w-72 flex flex-col border-r border-gray-200 bg-gray-50">

                {/* Header */}
                <div className="flex items-center justify-between px-4 py-3 border-b border-gray-200">
                    <span className="font-semibold text-gray-700 flex items-center gap-2">
                        <MessageSquare size={18} /> Chat
                    </span>

                    {/* "+" with dropdown */}
                    <div className="relative" ref={newMenuRef}>
                        <button
                            onClick={() => setShowNewMenu(v => !v)}
                            className="p-1 rounded-md hover:bg-gray-200 text-gray-500 hover:text-indigo-600 transition"
                            title="New conversation"
                        >
                            <Plus size={18} />
                        </button>

                        {showNewMenu && (
                            <div className="absolute right-0 top-8 z-20 bg-white border border-gray-200 rounded-lg shadow-lg py-1 w-44">
                                <button
                                    onClick={() => { setShowNewMenu(false); setShowDirectPanel(true); setShowGroupPanel(false); }}
                                    className="w-full flex items-center gap-2 px-3 py-2 text-sm text-gray-700 hover:bg-gray-50"
                                >
                                    <MessageCircle size={15} className="text-indigo-500" /> Direct message
                                </button>
                                {isManagerOrAdmin && (
                                    <button
                                        onClick={() => { setShowNewMenu(false); setShowDirectPanel(false); openGroupPanel(); }}
                                        className="w-full flex items-center gap-2 px-3 py-2 text-sm text-gray-700 hover:bg-gray-50"
                                    >
                                        <Users size={15} className="text-indigo-500" /> Group conversation
                                    </button>
                                )}
                                <button
                                    onClick={startBotChat}
                                    className="w-full flex items-center gap-2 px-3 py-2 text-sm text-gray-700 hover:bg-gray-50"
                                >
                                    <Bot size={15} className="text-emerald-500" /> Chat with Bot
                                </button>
                            </div>
                        )}
                    </div>
                </div>

                {/* Direct conversation input */}
                {showDirectPanel && (
                    <div className="px-3 py-2 border-b border-gray-200 bg-white">
                        <p className="text-xs text-gray-500 mb-1">Target User ID</p>
                        <div className="flex gap-1">
                            <input
                                autoFocus
                                value={newTarget}
                                onChange={e => setNewTarget(e.target.value)}
                                onKeyDown={e => e.key === "Enter" && startDirect()}
                                placeholder="Paste user _id..."
                                className="flex-1 text-sm border border-gray-300 rounded px-2 py-1 focus:outline-none focus:ring-1 focus:ring-indigo-400"
                            />
                            <button onClick={startDirect} className="px-2 py-1 bg-indigo-600 text-white rounded text-sm hover:bg-indigo-700">Go</button>
                            <button onClick={() => { setShowDirectPanel(false); setNewTarget(""); setError(""); }} className="p-1 text-gray-400 hover:text-gray-600"><X size={16} /></button>
                        </div>
                    </div>
                )}

                {/* Group creation panel — fills the list area */}
                {showGroupPanel ? (
                    <div className="flex flex-col flex-1 overflow-hidden">
                        {/* Panel header */}
                        <div className="flex items-center justify-between px-3 py-2 border-b border-gray-200 bg-white">
                            <span className="text-sm font-semibold text-gray-700">New Group</span>
                            <button onClick={() => setShowGroupPanel(false)} className="p-1 text-gray-400 hover:text-gray-600"><X size={15} /></button>
                        </div>

                        {/* Search */}
                        <div className="px-3 py-2 border-b border-gray-100 bg-white">
                            <div className="flex items-center gap-1.5 border border-gray-300 rounded-lg px-2 py-1">
                                <Search size={13} className="text-gray-400 flex-shrink-0" />
                                <input
                                    value={empSearch}
                                    onChange={e => setEmpSearch(e.target.value)}
                                    placeholder="Search employee..."
                                    className="flex-1 text-sm bg-transparent focus:outline-none"
                                />
                            </div>
                        </div>

                        {/* Employee list */}
                        <div className="flex-1 overflow-y-auto">
                            {filteredEmployees.length === 0 && (
                                <p className="text-center text-gray-400 text-xs mt-6">No employees found</p>
                            )}
                            {filteredEmployees.map(emp => {
                                const uid = emp.user_id?.toString();
                                const checked = selectedUserIds.includes(uid);
                                return (
                                    <label
                                        key={emp._id}
                                        className={`flex items-center gap-2.5 px-3 py-2.5 cursor-pointer border-b border-gray-100 hover:bg-gray-50 transition ${checked ? "bg-indigo-50" : ""}`}
                                    >
                                        <input
                                            type="checkbox"
                                            checked={checked}
                                            onChange={() => toggleEmployee(uid)}
                                            className="accent-indigo-600 w-3.5 h-3.5 flex-shrink-0"
                                        />
                                        <div className="min-w-0">
                                            <p className="text-sm font-medium text-gray-800 truncate">{emp.full_name}</p>
                                            <PositionBadge position={emp.position} />
                                        </div>
                                    </label>
                                );
                            })}
                        </div>

                        {/* Footer: group name + create */}
                        <div className="px-3 py-2.5 border-t border-gray-200 bg-white space-y-2">
                            <p className="text-xs text-gray-500">
                                {selectedUserIds.length} member{selectedUserIds.length !== 1 ? "s" : ""} selected
                            </p>
                            <input
                                value={groupName}
                                onChange={e => setGroupName(e.target.value)}
                                placeholder="Group name..."
                                className="w-full text-sm border border-gray-300 rounded-lg px-3 py-1.5 focus:outline-none focus:ring-2 focus:ring-indigo-400"
                            />
                            <button
                                onClick={createGroup}
                                disabled={groupLoading || selectedUserIds.length === 0 || !groupName.trim()}
                                className="w-full py-1.5 bg-indigo-600 text-white text-sm font-medium rounded-lg hover:bg-indigo-700 disabled:opacity-40 disabled:cursor-not-allowed transition"
                            >
                                {groupLoading ? "Creating..." : "Create Group"}
                            </button>
                        </div>
                    </div>
                ) : (
                    /* Conversation list */
                    <div className="flex-1 overflow-y-auto">
                        {conversations.length === 0 && (
                            <p className="text-center text-gray-400 text-sm mt-8">No conversations yet</p>
                        )}
                        {conversations.map(conv => {
                            const hasUnread = (conv.unread_count ?? 0) > 0;
                            const isActive  = activeConvId === conv._id;
                            return (
                                <button
                                    key={conv._id}
                                    onClick={() => setActiveConvId(conv._id)}
                                    className={`w-full text-left px-4 py-3 border-b border-gray-100 hover:bg-white transition
                                        ${isActive   ? "bg-white border-l-2 border-l-indigo-500" :
                                          hasUnread  ? "bg-indigo-50" : ""}`}
                                >
                                    <div className="flex justify-between items-center gap-1">
                                        <div className="flex items-center gap-1.5 min-w-0">
                                            {conv.type === "group" && <Users size={12} className="text-gray-400 flex-shrink-0" />}
                                            {conv.type === "bot"   && <Bot   size={12} className="text-emerald-500 flex-shrink-0" />}
                                            <span className={`text-sm truncate max-w-[110px] ${hasUnread ? "font-semibold text-gray-900" : "font-medium text-gray-700"}`}>
                                                {getConvLabel(conv)}
                                            </span>
                                        </div>
                                        <div className="flex items-center gap-1.5 flex-shrink-0">
                                            <span className="text-xs text-gray-400">{formatDate(conv.last_message?.sent_at ?? conv.created_at)}</span>
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
                )}
            </div>

            {/* ════════════════════════════ MESSAGE THREAD ═════════════ */}
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
                        {/* Thread header */}
                        <div className="px-5 py-3 border-b border-gray-200 bg-white flex items-center gap-2">
                            {activeConv?.type === "group" && <Users size={16} className="text-gray-400 flex-shrink-0" />}
                            {activeConv?.type === "bot"   && <Bot   size={16} className="text-emerald-500 flex-shrink-0" />}
                            <div className="flex-1 min-w-0">
                                {renamingGroup ? (
                                    <div className="flex items-center gap-2">
                                        <input
                                            ref={renameInputRef}
                                            value={renameInput}
                                            onChange={e => setRenameInput(e.target.value)}
                                            onKeyDown={handleRenameKeyDown}
                                            className="text-sm font-semibold border-b border-indigo-400 bg-transparent focus:outline-none w-48"
                                        />
                                        <button onClick={saveRename} className="text-indigo-600 hover:text-indigo-800"><Check size={15} /></button>
                                        <button onClick={cancelRename} className="text-gray-400 hover:text-gray-600"><X size={15} /></button>
                                    </div>
                                ) : (
                                    <div className="flex items-center gap-1.5">
                                        <p className="font-semibold text-gray-700 truncate">
                                            {activeConv ? getConvLabel(activeConv) : ""}
                                        </p>
                                        {isGroupCreator && (
                                            <button onClick={startRename} className="text-gray-400 hover:text-indigo-500 transition flex-shrink-0" title="Rename group">
                                                <Pencil size={13} />
                                            </button>
                                        )}
                                    </div>
                                )}
                                <p className="text-xs text-gray-400">
                                    {activeConv?.type === "group"
                                        ? `Group · ${activeConv?.participants?.length ?? 0} members`
                                        : activeConv?.type === "bot"
                                        ? "Trợ lý ảo khách sạn · Luôn sẵn sàng hỗ trợ"
                                        : "Direct message"}
                                </p>
                            </div>
                        </div>

                        {/* Messages */}
                        <div className="flex-1 overflow-y-auto px-5 py-4 space-y-3 bg-gray-50">
                            {messages.map(msg => {
                                const isMine    = msg.sender_id?.toString() === myId?.toString();
                                const isBot     = msg.sender_role === "bot";
                                const canEdit   = isMine && !msg.is_deleted;
                                const canDelete = (isMine || isGroupCreator) && !msg.is_deleted;
                                const isEditing = editingMsgId === msg._id;

                                return (
                                    <div key={msg._id} className={`flex group ${isMine ? "justify-end" : "justify-start"}`}>

                                        {/* Hover action buttons */}
                                        {(canEdit || canDelete) && !isEditing && (
                                            <div className={`flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity self-center ${isMine ? "order-first mr-2" : "order-last ml-2"}`}>
                                                {canEdit && (
                                                    <button onClick={() => startEdit(msg)}
                                                        className="p-1 rounded-md bg-white border border-gray-200 text-gray-400 hover:text-indigo-600 hover:border-indigo-300 shadow-sm transition"
                                                        title="Edit">
                                                        <Pencil size={13} />
                                                    </button>
                                                )}
                                                {canDelete && (
                                                    <button onClick={() => handleDeleteMessage(msg._id)}
                                                        className="p-1 rounded-md bg-white border border-gray-200 text-gray-400 hover:text-red-500 hover:border-red-300 shadow-sm transition"
                                                        title="Delete">
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
                                                <div className="px-4 py-2 rounded-2xl text-sm italic text-gray-400 bg-gray-100 border border-dashed border-gray-300">
                                                    Tin nhắn đã bị xóa
                                                </div>
                                            ) : isEditing ? (
                                                <div className="flex flex-col gap-1.5 w-full min-w-[200px]">
                                                    <textarea
                                                        ref={editInputRef}
                                                        value={editContent}
                                                        onChange={e => setEditContent(e.target.value)}
                                                        onKeyDown={handleEditKeyDown}
                                                        rows={2}
                                                        className="w-full resize-none border border-indigo-400 rounded-xl px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-400"
                                                    />
                                                    <div className="flex gap-1 justify-end">
                                                        <button onClick={cancelEdit} className="px-2 py-0.5 text-xs rounded-md border border-gray-300 text-gray-500 hover:bg-gray-100">Cancel</button>
                                                        <button onClick={saveEdit} disabled={!editContent.trim()}
                                                            className="px-2 py-0.5 text-xs rounded-md bg-indigo-600 text-white hover:bg-indigo-700 disabled:opacity-40 flex items-center gap-1">
                                                            <Check size={11} /> Save
                                                        </button>
                                                    </div>
                                                </div>
                                            ) : (
                                                <div className={`px-4 py-2 rounded-2xl text-sm leading-relaxed whitespace-pre-wrap ${
                                                    isMine
                                                        ? "bg-indigo-600 text-white rounded-br-sm"
                                                        : isBot
                                                        ? "bg-emerald-50 text-gray-800 border border-emerald-200 rounded-bl-sm shadow-sm"
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
                            {botTyping && (
                                <div className="flex justify-start">
                                    <div className="flex items-center gap-2 px-4 py-2 rounded-2xl rounded-bl-sm text-sm bg-emerald-50 border border-emerald-200 text-emerald-600">
                                        <Bot size={13} className="flex-shrink-0" />
                                        <span className="italic">SE Hotel Assistant đang trả lời...</span>
                                        <span className="flex gap-0.5">
                                            <span className="w-1.5 h-1.5 bg-emerald-400 rounded-full animate-bounce" style={{ animationDelay: "0ms" }} />
                                            <span className="w-1.5 h-1.5 bg-emerald-400 rounded-full animate-bounce" style={{ animationDelay: "150ms" }} />
                                            <span className="w-1.5 h-1.5 bg-emerald-400 rounded-full animate-bounce" style={{ animationDelay: "300ms" }} />
                                        </span>
                                    </div>
                                </div>
                            )}
                            <div ref={bottomRef} />
                        </div>

                        {/* Input bar */}
                        <div className="px-4 py-3 border-t border-gray-200 bg-white flex gap-2 items-end">
                            <textarea
                                ref={inputRef}
                                rows={1}
                                value={input}
                                onChange={e => setInput(e.target.value)}
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

            {/* Error toast */}
            {error && (
                <div className="absolute bottom-6 left-1/2 -translate-x-1/2 bg-red-500 text-white text-sm px-4 py-2 rounded-lg shadow-lg flex items-center gap-2 z-30">
                    {error}
                    <button onClick={() => setError("")}><X size={14} /></button>
                </div>
            )}
        </div>
    );
}
