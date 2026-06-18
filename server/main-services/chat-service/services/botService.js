import { GoogleGenerativeAI } from "@google/generative-ai";
import { HOTEL_SYSTEM_PROMPT, STAFF_SYSTEM_PROMPT } from "../config/botConfig.js";
import { CircuitBreaker } from "../../../shared/messaging/circuitBreaker.js";
import { BOOKING_EVENTS } from "../../../shared/events/bookingEvents.js";

/**
 * Tool registry. Each tool declares:
 *  - scope:     who may use it — "all" (everyone), "staff" (non-customer), "manager" (manager/admin)
 *  - transport: "http" (public), "http-auth" (forwards the caller's JWT), "event" (RabbitMQ eventBus)
 *  - serviceKey: circuit-breaker key (http/http-auth only)
 *  - declaration: the Gemini function declaration handed to the model
 *  - build(args): builds the request URL (http/http-auth)
 *  - handler(args, ctx): runs the call (event)
 *
 * Identity for staff tools is NEVER taken from tool args — it is carried implicitly by the
 * forwarded JWT, so a tool can only ever return the authenticated caller's own data.
 */
const TOOL_REGISTRY = {
    // ---- Public catalog (customers + staff) ----
    getRoomCategories: {
        scope: "all",
        transport: "http",
        serviceKey: "room",
        declaration: {
            name: "getRoomCategories",
            description: "Lấy danh sách các loại phòng tại SE Hotel kèm giá tiền, sức chứa tối đa, mô tả, điểm đánh giá trung bình (average_rating) và số lượt đánh giá (review_count). Dùng cho cả câu hỏi về loại phòng nào được đánh giá cao nhất / tốt nhất.",
            parameters: { type: "OBJECT", properties: {}, required: [] },
        },
        build: () => `${process.env.ROOM_SERVICE_URL}/categories?limit=50`,
    },

    getHotelServices: {
        scope: "all",
        transport: "http",
        serviceKey: "hotel-service",
        declaration: {
            name: "getHotelServices",
            description: "Lấy danh sách tất cả dịch vụ và tiện ích của SE Hotel như spa, gym, nhà hàng, giặt ủi, v.v.",
            parameters: { type: "OBJECT", properties: {}, required: [] },
        },
        build: () => `${process.env.SERVICE_SERVICE_URL}?limit=50&status=active`,
    },

    getAttractions: {
        scope: "all",
        transport: "http",
        serviceKey: "attraction",
        declaration: {
            name: "getAttractions",
            description: "Lấy danh sách các điểm tham quan và địa điểm du lịch gần SE Hotel tại TP.HCM",
            parameters: {
                type: "OBJECT",
                properties: {
                    category: {
                        type: "STRING",
                        description: "Lọc theo loại: cultural, natural, food, entertainment, sport, other",
                    },
                },
                required: [],
            },
        },
        build: (args = {}) => {
            const params = new URLSearchParams({ limit: "20", is_active: "true" });
            if (args.category) params.set("category", args.category);
            return `${process.env.ATTRACTION_SERVICE_URL}?${params}`;
        },
    },

    getAvailableRoomCategories: {
        scope: "all",
        transport: "http",
        serviceKey: "room",
        declaration: {
            name: "getAvailableRoomCategories",
            description: "Kiểm tra những loại phòng còn trống trong một khoảng thời gian nhận–trả phòng cụ thể. Dùng khi khách hỏi 'từ ngày A đến ngày B có những loại phòng nào phù hợp/còn trống'. Trả về số phòng trống (available_count) theo từng loại.",
            parameters: {
                type: "OBJECT",
                properties: {
                    checkin:  { type: "STRING", description: "Ngày nhận phòng, định dạng YYYY-MM-DD" },
                    checkout: { type: "STRING", description: "Ngày trả phòng, định dạng YYYY-MM-DD" },
                    adults:   { type: "NUMBER", description: "Số người lớn (tùy chọn)" },
                    children: { type: "NUMBER", description: "Số trẻ em (tùy chọn)" },
                    minPrice: { type: "NUMBER", description: "Giá tối thiểu mỗi đêm, VND (tùy chọn)" },
                    maxPrice: { type: "NUMBER", description: "Giá tối đa mỗi đêm, VND (tùy chọn)" },
                },
                required: ["checkin", "checkout"],
            },
        },
        build: (args = {}) => {
            const params = new URLSearchParams({ checkin: args.checkin, checkout: args.checkout });
            for (const key of ["adults", "children", "minPrice", "maxPrice"]) {
                if (args[key] != null) params.set(key, String(args[key]));
            }
            return `${process.env.ROOM_SERVICE_URL}/categories/available-by?${params}`;
        },
    },

    // ---- Aggregate stat over the eventBus (popular rooms; fine for customers too) ----
    getTopBookedRoomCategories: {
        scope: "all",
        transport: "event",
        declaration: {
            name: "getTopBookedRoomCategories",
            description: "Lấy danh sách các loại phòng được đặt nhiều nhất (phổ biến nhất) tại SE Hotel, kèm số lượt đặt (totalBooked). Dùng khi khách hỏi loại phòng nào được đặt nhiều nhất / phổ biến nhất.",
            parameters: {
                type: "OBJECT",
                properties: {
                    limit: { type: "NUMBER", description: "Số loại phòng muốn lấy, từ 1 đến 10 (mặc định 5)" },
                },
                required: [],
            },
        },
        handler: async (args, { eventBus }) => {
            if (!eventBus) return { error: "Internal data channel unavailable" };
            const limit = Math.min(Math.max(Number(args.limit) || 5, 1), 10);
            const reply = await eventBus.safeRequest(
                BOOKING_EVENTS.GET_TOP_BOOKED_ROOM_CATEGORIES, { limit }
            );
            if (!reply?.success) return { error: reply?.message || "Service unavailable" };
            return { data: reply.result ?? [] };
        },
    },

    // ---- Personal staff data (act-as-user: forwards the caller's JWT) ----
    getMySchedule: {
        scope: "staff",
        transport: "http-auth",
        serviceKey: "employee",
        declaration: {
            name: "getMySchedule",
            description: "Lấy lịch làm việc sắp tới của chính nhân viên đang đăng nhập (các ca theo từng tuần).",
            parameters: { type: "OBJECT", properties: {}, required: [] },
        },
        build: () => `${process.env.EMPLOYEE_SERVICE_URL}/schedules/my`,
    },

    getAvailableShifts: {
        scope: "staff",
        transport: "http-auth",
        serviceKey: "employee",
        declaration: {
            name: "getAvailableShifts",
            description: "Lấy danh sách các ca làm việc còn trống mà nhân viên đang đăng nhập có thể đăng ký thêm.",
            parameters: { type: "OBJECT", properties: {}, required: [] },
        },
        build: () => `${process.env.EMPLOYEE_SERVICE_URL}/schedules/available-shifts`,
    },

    getMyEarnings: {
        scope: "staff",
        transport: "http-auth",
        serviceKey: "employee",
        declaration: {
            name: "getMyEarnings",
            description: "Lấy thông tin thu nhập/lương của chính nhân viên đang đăng nhập, gồm tổng lương (summary.total_earned), số ca và chi tiết theo ngày. Có thể lọc theo khoảng thời gian.",
            parameters: {
                type: "OBJECT",
                properties: {
                    start_date: { type: "STRING", description: "Lọc từ ngày, định dạng YYYY-MM-DD (tùy chọn)" },
                    end_date:   { type: "STRING", description: "Lọc đến ngày, định dạng YYYY-MM-DD (tùy chọn)" },
                },
                required: [],
            },
        },
        build: (args = {}) => {
            const params = new URLSearchParams();
            if (args.start_date) params.set("start_date", args.start_date);
            if (args.end_date)   params.set("end_date", args.end_date);
            const qs = params.toString();
            return `${process.env.EMPLOYEE_SERVICE_URL}/earnings/my${qs ? `?${qs}` : ""}`;
        },
    },

    getMyAttendanceSummary: {
        scope: "staff",
        transport: "http-auth",
        serviceKey: "employee",
        declaration: {
            name: "getMyAttendanceSummary",
            description: "Lấy tổng quan chấm công của chính nhân viên đang đăng nhập: số ngày làm (total_work_days), số ngày nghỉ phép (days_off), số ngày vắng (absent_days), tổng số giờ làm và thống kê theo trạng thái. Có thể lọc theo khoảng thời gian.",
            parameters: {
                type: "OBJECT",
                properties: {
                    start_date: { type: "STRING", description: "Lọc từ ngày, định dạng YYYY-MM-DD (tùy chọn)" },
                    end_date:   { type: "STRING", description: "Lọc đến ngày, định dạng YYYY-MM-DD (tùy chọn)" },
                },
                required: [],
            },
        },
        build: (args = {}) => {
            const params = new URLSearchParams();
            if (args.start_date) params.set("start_date", args.start_date);
            if (args.end_date)   params.set("end_date", args.end_date);
            const qs = params.toString();
            return `${process.env.EMPLOYEE_SERVICE_URL}/attendances/my-summary${qs ? `?${qs}` : ""}`;
        },
    },
};

// Maps a JWT role to a capability bucket. Mirrors the auth middleware semantics:
// isEmployee = any non-customer; isManager = manager|admin.
function bucketOf(role) {
    if (role === "manager" || role === "admin") return "manager";
    if (!role || role === "customer") return "customer";
    return "staff";
}

function toolVisible(tool, bucket) {
    if (tool.scope === "all") return true;
    if (tool.scope === "staff") return bucket === "staff" || bucket === "manager";
    if (tool.scope === "manager") return bucket === "manager";
    return false;
}

function systemPromptFor(bucket) {
    return bucket === "customer"
        ? HOTEL_SYSTEM_PROMPT
        : `${HOTEL_SYSTEM_PROMPT}\n\n${STAFF_SYSTEM_PROMPT}`;
}

export class BotService {
    constructor({ eventBus } = {}) {
        this._genAI = null;
        this._models = {};   // cached per role bucket
        this._breakers = {};
        this.eventBus = eventBus;
    }

    _breakerFor(serviceKey) {
        if (!this._breakers[serviceKey]) {
            this._breakers[serviceKey] = new CircuitBreaker({
                failureThreshold: 3,
                recoveryTimeout: 30000,
                serviceKey,
            });
        }
        return this._breakers[serviceKey];
    }

    _getModel(bucket) {
        if (!this._models[bucket]) {
            if (!this._genAI) this._genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY);
            const declarations = Object.values(TOOL_REGISTRY)
                .filter(t => toolVisible(t, bucket))
                .map(t => t.declaration);

            this._models[bucket] = this._genAI.getGenerativeModel({
                model: "gemini-2.5-flash",
                systemInstruction: systemPromptFor(bucket),
                tools: [{ functionDeclarations: declarations }],
            });
        }
        return this._models[bucket];
    }

    // Gemini's functionResponse.response must be a JSON object (Struct), never a bare array.
    _wrap(data) {
        if (data && typeof data === "object" && "error" in data) return data;
        return Array.isArray(data) ? { data } : data;
    }

    async _executeFunction(name, args = {}, ctx) {
        const tool = TOOL_REGISTRY[name];
        if (!tool) return { error: `Unknown function: ${name}` };

        // Defense in depth: never run a tool outside the caller's bucket, even if the
        // model somehow requests it (it shouldn't — out-of-scope tools aren't declared).
        if (!toolVisible(tool, ctx.bucket)) {
            return { error: "Bạn không có quyền sử dụng chức năng này." };
        }

        if (tool.transport === "event") {
            try {
                return this._wrap(await tool.handler(args, { eventBus: this.eventBus }));
            } catch (err) {
                console.warn(`[CIRCUIT BREAKER] bot event tool ${name} failed: ${err.message}`);
                return { error: err.message };
            }
        }

        if (tool.transport === "http-auth" && !ctx.token) {
            return { error: "Bạn cần đăng nhập để dùng chức năng này." };
        }

        const breaker = this._breakerFor(tool.serviceKey);
        if (breaker.isOpen()) {
            console.warn(`[CIRCUIT OPEN] Fast-failing bot tool: ${name}`);
            return { error: `Service temporarily unavailable: ${tool.serviceKey}` };
        }

        try {
            const data = await this._httpCall(tool, args, ctx);
            breaker.onSuccess();
            return this._wrap(data);
        } catch (err) {
            breaker.onFailure();
            console.warn(`[CIRCUIT BREAKER] bot tool ${name} failed: ${err.message}`);
            return { error: err.message };
        }
    }

    async _httpCall(tool, args, ctx) {
        const headers = {};
        if (tool.transport === "http-auth") headers.Authorization = `Bearer ${ctx.token}`;

        const res = await fetch(tool.build(args), { headers, signal: AbortSignal.timeout(8000) });
        if (!res.ok) throw new Error(`HTTP ${res.status}`);
        return await res.json();
    }

    /**
     * @param {Array}  history     prior conversation messages
     * @param {string} userMessage the current user turn
     * @param {Object} caller      { role, token, userId } from the authenticated socket session
     */
    async generateReply(history, userMessage, caller = {}) {
        try {
            const bucket = bucketOf(caller.role);
            const ctx = { bucket, token: caller.token, userId: caller.userId };
            const model = this._getModel(bucket);

            const geminiHistory = history
                .filter(m => !m.is_deleted && m.content?.trim())
                .map(m => ({
                    role: m.sender_role === "bot" ? "model" : "user",
                    parts: [{ text: m.content }],
                }));

            const chat = model.startChat({ history: geminiHistory });
            let result = await chat.sendMessage(userMessage);

            // Function calling loop — Gemini may request up to 3 rounds of tool calls
            let rounds = 0;
            while (result.response.functionCalls()?.length > 0 && rounds < 3) {
                rounds++;
                const functionResponses = await Promise.all(
                    result.response.functionCalls().map(async (call) => ({
                        functionResponse: {
                            name: call.name,
                            response: await this._executeFunction(call.name, call.args, ctx),
                        },
                    }))
                );
                result = await chat.sendMessage(functionResponses);
            }

            return result.response.text();
        } catch (err) {
            console.error("[BotService] generateReply error:", err.message);
            return "Xin lỗi, trợ lý ảo đang gặp sự cố kỹ thuật. Vui lòng thử lại sau 10 phút hoặc liên hệ nhân viên qua số +84 948659057 để được hỗ trợ trực tiếp.";
        }
    }
}
