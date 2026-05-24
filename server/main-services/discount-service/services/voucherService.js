import mongoose from 'mongoose';
import { CUSTOMER_EVENTS } from '../../../shared/events/customerEvents.js';
import { cache, makeCacheKey } from '../../../shared/utils/cache.js';

export class VoucherService {
    constructor({ Voucher, eventBus }) {
        this.Voucher = Voucher;
        this.eventBus = eventBus;
    }

    async createVoucher(data) {
        try {
            const { code, name, description, discount, conditions, 
                begin_date, end_date, priority, max_uses } = data;

            if (!code || !name || !discount || !discount.type || discount.value == null) {
                throw new Error("Thiếu thông tin bắt buộc (mã, tên, thể lệ voucher)");
            }

            if (!max_uses || max_uses < 1) {
                throw new Error("Số lượt sử dụng tối đa phải >= 1");
            }

            const [existingCode, existingName] = await Promise.all([
                this.Voucher.findOne({ code: code.toUpperCase() }),
                this.Voucher.findOne({ name }),
            ]);
            if (existingCode) throw new Error("Mã voucher đã tồn tại.");
            if (existingName) throw new Error("Tên voucher đã tồn tại.");

            this.validateDiscount(discount);
            this.validateConditions(conditions);

            const { begin, end } = this.validateDates(begin_date, end_date);
            const now = new Date();

            let is_active = false;
            let status = "upcoming";
            if (now >= begin && now <= end) {
                is_active = true;
                status = "ongoing";
            } else if (now > end) {
                status = "finished";
            }

            const newVoucher = await this.Voucher.create({
                code: code.toUpperCase(),
                name,
                description,
                discount,
                conditions: conditions && Object.keys(conditions).length > 0 ? conditions : undefined,
                begin_date: begin,
                end_date: end,
                priority: priority || 1,
                max_uses,
                used_count: 0,
                used_by: [],
                is_active,
                status
            });

            await cache.delByPattern("voucher:list:*");
            return newVoucher;

        } catch (err) {
            console.log("Error creating voucher:", err);
            throw err;
        }
    }

    async getAllVouchers(query = {}) {
        try {
            const cacheKey = makeCacheKey("voucher:list", query);
            const cached = await cache.get(cacheKey);
            if (cached) return cached;

            const { status, type, code, name, min_order_value,
                customer_tier, date, day, hour } = query;

            const filter = {};

            if (status) filter.status = status;
            if (type) filter["discount.type"] = type;
            if (code) filter.code = code.toUpperCase();
            if (name) filter.name = name;

            if (date) {
                const d = new Date(date);
                filter.begin_date = { $lte: d };
                filter.end_date = { $gte: d };
            }

            if (min_order_value != null) {
                filter["conditions.min_order_value"] = { $lte: Number(min_order_value) };
            }

            if (customer_tier) {
                filter["conditions.customer_tiers"] = customer_tier;
            }

            if (day !== undefined) {
                filter["conditions.days_of_week"] = Number(day);
            }

            if (hour !== undefined) {
                filter["conditions.hours_range.from"] = { $lte: Number(hour) };
                filter["conditions.hours_range.to"] = { $gte: Number(hour) };
            }

            const vouchers = await this.Voucher
                .find(filter)
                .select("-__v -updated_at -used_by") // exclude used_by for list view — it can be large
                .sort({ priority: -1, created_at: -1 })
                .lean();

            await cache.set(cacheKey, vouchers, 180);
            return vouchers;

        } catch (err) {
            console.log("Error fetching vouchers:", err);
            throw err;
        }
    }

    async getVoucherById(voucherId) {
        try {
            const cacheKey = `voucher:one:${voucherId}`;
            const cached = await cache.get(cacheKey);
            if (cached) return cached;

            const voucher = await this.Voucher.findById(voucherId)
                .select("-__v -created_at -updated_at");

            if (!voucher) throw new Error("Không tìm thấy voucher");

            await cache.set(cacheKey, voucher, 180);
            return voucher;

        } catch (err) {
            console.log("Error fetching voucher by ID:", err);
            throw err;
        }
    }

    async updateVoucher(voucherId, payload) {
        try {
            const voucher = await this.Voucher.findById(voucherId);
            if (!voucher) throw new Error("Không tìm thấy voucher");

            const now = new Date();

            const [existingCode, existingName] = await Promise.all([
                payload.code
                    ? this.Voucher.findOne({ code: payload.code.toUpperCase(), _id: { $ne: voucherId } })
                    : Promise.resolve(null),
                payload.name
                    ? this.Voucher.findOne({ name: payload.name, _id: { $ne: voucherId } })
                    : Promise.resolve(null),
            ]);
            if (existingCode) throw new Error("Mã voucher đã tồn tại.");
            if (payload.code) voucher.code = payload.code.toUpperCase();
            if (existingName) throw new Error("Tên voucher đã tồn tại.");
            if (payload.name) voucher.name = payload.name;

            if (payload.description !== undefined) {
                voucher.description = payload.description;
            }

            if (payload.max_uses !== undefined) {
                if (payload.max_uses < 1) 
                    throw new Error("Số lượt sử dụng tối đa phải >= 1");
                
                const effectiveUsed = voucher.used_count + voucher.pending_use.length;
                if (payload.max_uses < effectiveUsed) {
                    throw new Error(`Số lượt tối đa không thể nhỏ hơn số lượt đã dùng và đang chờ (${effectiveUsed})`);
                }

                voucher.max_uses = payload.max_uses;
            }

            if (payload.begin_date || payload.end_date) {
                const begin = payload.begin_date ? new Date(payload.begin_date) : voucher.begin_date;
                const end = payload.end_date ? new Date(payload.end_date) : voucher.end_date;

                this.validateDates(begin, end);

                voucher.begin_date = begin;
                voucher.end_date = end;

                if (now >= begin && now <= end) {
                    voucher.is_active = true;
                    voucher.status = "ongoing";
                } else if (now < begin) {
                    voucher.is_active = false;
                    voucher.status = "upcoming";
                } else {
                    voucher.is_active = false;
                    voucher.status = "finished";
                }
            }

            if (payload.priority !== undefined) {
                if (typeof payload.priority !== "number" || payload.priority < 1)
                    throw new Error("Độ ưu tiên phải là số >= 1");
                voucher.priority = payload.priority;
            }

            if (payload.discount) {
                this.validateDiscount(payload.discount);
                voucher.discount = payload.discount;
            }

            if (payload.conditions !== undefined) {
                this.validateConditions(payload.conditions);
                voucher.conditions = payload.conditions;
            }

            await voucher.save();
            await Promise.all([
                cache.del(`voucher:one:${voucherId}`),
                cache.delByPattern("voucher:list:*"),
            ]);
            return voucher;

        } catch (err) {
            console.log("Error updating voucher:", err);
            throw err;
        }
    }

    async deleteVoucher(voucherId) {
        try {
            const voucher = await this.Voucher.findById(voucherId);
            if (!voucher) throw new Error("Không tìm thấy voucher!");

            const now = new Date();
            if (now >= voucher.begin_date || voucher.is_active || voucher.status === "ongoing") {
                throw new Error("Không thể xóa vì voucher đã bắt đầu!");
            }

            await this.Voucher.findByIdAndDelete(voucherId);
            await Promise.all([
                cache.del(`voucher:one:${voucherId}`),
                cache.delByPattern("voucher:list:*"),
            ]);
            return { success: true };

        } catch (err) {
            console.log("Error deleting voucher:", err);
            throw err;
        }
    }

    async unactivateVoucher(voucherId) {
        try {
            const voucher = await this.Voucher.findById(voucherId);
            if (!voucher) throw new Error("Không tìm thấy voucher");

            voucher.is_active = false;
            voucher.status = "finished";
            await voucher.save();
            await Promise.all([
                cache.del(`voucher:one:${voucherId}`),
                cache.delByPattern("voucher:list:*"),
            ]);

            return { success: true };

        } catch (err) {
            console.log("Error unactivating voucher:", err);
            throw err;
        }
    }

    // available vouchers for a customer — used for UI display before payment selection and booking confirmed
    async getAvailableVouchers(customerId, orderValue = 0) {
        try {
            if (!customerId) throw new Error("Thiếu customer_id");

            const now = new Date();

            const vouchers = await this.Voucher.find({
                is_active: true,
                begin_date: { $lte: now },
                end_date: { $gte: now },
                status: "ongoing",
                $expr: { $lt: ["$used_count", "$max_uses"] } // not exhausted
            })
                .select("-__v -used_by -pending_use")
                .lean();

            // fetch customer once for tier check
            const customer = await this.getCustomerById(customerId);

            const eligible = [];
            for (const voucher of vouchers) {
                const check = await this.checkVoucherConditions(voucher, customerId, orderValue, customer);
                if (!check.available) continue;

                eligible.push({
                    ...voucher,
                    savings: this.calculateSavings(voucher.discount, orderValue)
                });
            }

            eligible.sort((a, b) => b.savings - a.savings);

            return eligible.map(v => this.formatVoucherResponse(v));

        } catch (err) {
            console.error("Error suggesting vouchers:", err);
            throw err;
        }
    }

    // validate customer's final voucher selection (called before booking is confirmed)
    async validateVouchers(voucherCodes = [], customerId, orderValue = 0) {
        try {
            if (!customerId) throw new Error("Thiếu customer_id");

            if (voucherCodes.length > 2) {
                throw new Error("Chỉ được áp dụng tối đa 2 voucher mỗi đơn hàng");
            }

            if (voucherCodes.length === 0) return [];

            // deduplicate codes
            const uniqueCodes = [...new Set(voucherCodes.map(c => c.toUpperCase()))];
            if (uniqueCodes.length !== voucherCodes.length) {
                throw new Error("Không thể dùng cùng một voucher 2 lần");
            }

            const customer = await this.getCustomerById(customerId);

            const validated = [];
            for (const code of uniqueCodes) {
                const voucher = await this.Voucher.findOne({ code }).lean();
                if (!voucher) throw new Error(`Voucher "${code}" không tồn tại`);

                this.checkUsability(voucher, code, customerId);

                const check = await this.checkVoucherConditions(voucher, customerId, orderValue, customer);
                if (!check.available) {
                    throw new Error(`Voucher "${code}": ${check.reason}`);
                }

                validated.push({
                    ...voucher,
                    savings: this.calculateSavings(voucher.discount, orderValue)
                });
            }

            return validated.map(v => this.formatVoucherResponse(v));

        } catch (err) {
            console.log("Error validating vouchers:", err);
            throw err;
        }
    }

    // called when booking status → confirmed (deposit paid)
    // soft-locks the voucher for this customer+booking
    async redeemVouchers(voucherCodes = [], customerId, bookingId) {
        try {
            if (!customerId) 
                throw new Error("Thiếu customer_id");
            if (!bookingId) 
                throw new Error("Thiếu booking_id");
            
            if (voucherCodes.length === 0)
                return { success: true, redeemed: [] };

            const uniqueCodes = [...new Set(voucherCodes.map(c => c.toUpperCase()))];
            const redeemed = [];
            const affectedIds = [];

            for (const code of uniqueCodes) {
                const voucher = await this.Voucher.findOne({ code });
                if (!voucher) throw new Error(`Voucher "${code}" không tồn tại`);

                this.checkUsability(voucher, code, customerId);

                voucher.pending_use.push({
                    customer_id: customerId,
                    booking_id:  bookingId,
                    locked_at:   new Date()
                });

                // effective usage = confirmed (pending) + completed (used)
                const effectiveUsed = voucher.used_count + voucher.pending_use.length;
                if (effectiveUsed >= voucher.max_uses) {
                    voucher.is_active = false;
                    voucher.status = "exhausted";
                }

                await voucher.save();
                redeemed.push(code);
                affectedIds.push(voucher._id.toString());
            }

            await Promise.all([
                ...affectedIds.map(id => cache.del(`voucher:one:${id}`)),
                cache.delByPattern("voucher:list:*"),
            ]);

            return { success: true, redeemed };

        } catch (err) {
            console.log("Error redeeming vouchers:", err);
            throw err;
        }
    }

    // called when booking status → completed (customer checked out)
    // moves pending → used_by, increments used_count
    async finalizeVouchers(voucherCodes = [], customerId, bookingId) {
        try {
            if (!customerId) throw new Error("Thiếu customer_id");
            if (!bookingId)  throw new Error("Thiếu booking_id");
            if (voucherCodes.length === 0) return { success: true, finalized: [] };

            const uniqueCodes = [...new Set(voucherCodes.map(c => c.toUpperCase()))];
            const finalized = [];
            const affectedIds = [];

            for (const code of uniqueCodes) {
                const voucher = await this.Voucher.findOne({ code });
                if (!voucher) throw new Error(`Voucher "${code}" không tồn tại`);

                // remove from pending
                const pendingIndex = voucher.pending_use.findIndex(
                    u => u.customer_id.toString() === customerId.toString()
                    && u.booking_id.toString()  === bookingId.toString()
                );

                if (pendingIndex === -1) {
                    // not in pending — might already be finalized or was never redeemed
                    console.warn(`Voucher "${code}" không tìm thấy trong pending_use cho booking ${bookingId}`);
                    continue;
                }

                voucher.pending_use.splice(pendingIndex, 1);

                // move to used_by
                voucher.used_by.push({
                    customer_id: customerId,
                    booking_id:  bookingId,
                    used_at:     new Date()
                });

                voucher.used_count += 1;

                // re-evaluate exhausted (pending shrank, used_count grew — net same, keep exhausted if was)
                const effectiveUsed = voucher.used_count + voucher.pending_use.length;
                if (effectiveUsed >= voucher.max_uses) {
                    voucher.is_active = false;
                    voucher.status = "exhausted";
                }

                await voucher.save();
                finalized.push(code);
                affectedIds.push(voucher._id.toString());
            }

            await Promise.all([
                ...affectedIds.map(id => cache.del(`voucher:one:${id}`)),
                cache.delByPattern("voucher:list:*"),
            ]);

            return { success: true, finalized };

        } catch (err) {
            console.log("Error finalizing vouchers:", err);
            throw err;
        }
    }

    // called when booking status → cancelled or expired
    // fully releases the soft-lock, restores availability
    async releaseVouchers(voucherCodes = [], customerId, bookingId) {
        try {
            if (!customerId) throw new Error("Thiếu customer_id");
            if (!bookingId)  throw new Error("Thiếu booking_id");
            if (voucherCodes.length === 0) return { success: true, released: [] };

            const uniqueCodes = [...new Set(voucherCodes.map(c => c.toUpperCase()))];
            const released = [];
            const affectedIds = [];

            for (const code of uniqueCodes) {
                const voucher = await this.Voucher.findOne({ code });
                if (!voucher) {
                    console.warn(`Voucher "${code}" không tìm thấy khi release`);
                    continue;
                }

                const pendingIndex = voucher.pending_use.findIndex(
                    u => u.customer_id.toString() === customerId.toString()
                    && u.booking_id.toString()  === bookingId.toString()
                );

                if (pendingIndex === -1) {
                    console.warn(`Voucher "${code}" không có trong pending_use cho booking ${bookingId}`);
                    continue;
                }

                voucher.pending_use.splice(pendingIndex, 1);

                // restore to ongoing if it was exhausted and now has capacity again
                const effectiveUsed = voucher.used_count + voucher.pending_use.length;
                const now = new Date();

                if (
                    voucher.status === "exhausted" &&
                    effectiveUsed < voucher.max_uses &&
                    now >= voucher.begin_date &&
                    now <= voucher.end_date
                ) {
                    voucher.is_active = true;
                    voucher.status = "ongoing";
                }

                await voucher.save();
                released.push(code);
                affectedIds.push(voucher._id.toString());
            }

            await Promise.all([
                ...affectedIds.map(id => cache.del(`voucher:one:${id}`)),
                cache.delByPattern("voucher:list:*"),
            ]);

            return { success: true, released };

        } catch (err) {
            console.log("Error releasing vouchers:", err);
            throw err;
        }
    }

    // helpers 

    async checkVoucherConditions(voucher, customerId, orderValue, customer = null) {
        const now = new Date();

        if (!voucher.is_active)
            return { available: false, reason: "Voucher chưa được kích hoạt" };

        if (now < voucher.begin_date)
            return { available: false, reason: "Voucher chưa bắt đầu" };
        
        if (now > voucher.end_date)
            return { available: false, reason: "Voucher đã kết thúc" };
        
        const effectiveUsed = voucher.used_count + (voucher.pending_use?.length || 0);
        if (effectiveUsed >= voucher.max_uses)
            return { available: false, reason: "Voucher đã hết lượt sử dụng" };

        const conditions = voucher.conditions || {};
        const rule_type = conditions.rule_type || "NONE";

        const needsCustomer = rule_type === "FIRST_BOOKING" ||
            (conditions.customer_tiers && conditions.customer_tiers.length > 0);
        const c = needsCustomer ? (customer || await this.getCustomerById(customerId)) : null;

        if (rule_type === "FIRST_BOOKING") {
            if (c.booking_count > 0) {
                return { available: false, reason: "Chỉ áp dụng cho khách hàng chưa có đơn đặt phòng" };
            }
        }

        if (rule_type === "MIN_BOOKING_VALUE") {
            if (orderValue < conditions.min_order_value) {
                return {
                    available: false,
                    reason: `Đơn hàng tối thiểu ${conditions.min_order_value.toLocaleString("vi-VN")}đ`
                };
            }
        }

        if (rule_type === "SEASONAL") {
            if (conditions.days_of_week && conditions.days_of_week.length > 0) {
                if (!conditions.days_of_week.includes(now.getDay())) {
                    const dayNames = ["Chủ nhật", "Thứ 2", "Thứ 3", "Thứ 4", "Thứ 5", "Thứ 6", "Thứ 7"];
                    const valid = conditions.days_of_week.map(d => dayNames[d]).join(", ");
                    
                    return { available: false, reason: `Chỉ áp dụng vào: ${valid}` };
                }
            }

            if (conditions.hours_range) {
                const { from, to } = conditions.hours_range;
                const hour = now.getHours();
                if (hour < from || hour > to) {
                    return { available: false, reason: `Chỉ áp dụng vào khung giờ ${from}:00 - ${to}:00` };
                }
            }
        }

        if (rule_type !== "MIN_BOOKING_VALUE" && conditions.min_order_value > 0) {
            if (orderValue < conditions.min_order_value) {
                return {
                    available: false,
                    reason: `Đơn hàng tối thiểu ${conditions.min_order_value.toLocaleString("vi-VN")}đ`
                };
            }
        }

        if (conditions.customer_tiers && conditions.customer_tiers.length > 0) {
            const tier = this.mapLoyaltyToTier(c.loyalty || "bronze", c.booking_count || 0);

            if (!conditions.customer_tiers.includes(tier)) {
                const tierNames = { NEW: "Mới", LOYAL: "Thân thiết", VIP: "VIP" };
                const allowed = conditions.customer_tiers.map(t => tierNames[t] || t).join(", ");

                return { available: false, reason: `Chỉ áp dụng cho khách hàng hạng: ${allowed}` };
            }
        }

        return { available: true };
    }

    checkUsability(voucher, code, customerId) {
        // effective capacity check: pending + confirmed used
        const effectiveUsed = voucher.used_count + voucher.pending_use.length;
        if (effectiveUsed >= voucher.max_uses)
            throw new Error(`Voucher "${code}" đã hết lượt sử dụng`);

        // per-customer: already fully used
        const alreadyUsed = voucher.used_by.some(
            u => u.customer_id.toString() === customerId.toString()
        );
        if (alreadyUsed)
            throw new Error(`Bạn đã sử dụng voucher "${code}" trước đó`);

        // per-customer: currently soft-locked on another booking
        const hasPending = voucher.pending_use.some(
            u => u.customer_id.toString() === customerId.toString()
        );
        if (hasPending)
            throw new Error(`Voucher "${code}" đang được áp dụng cho một đơn hàng khác của bạn`);
    }

    async getCustomerById(customerId) {
        const reply = await this.eventBus.safeRequest(
            CUSTOMER_EVENTS.CHECK_EXISTS,
            { customerId }
        );
        if (!reply.success) throw new Error(reply.message);
        return reply.customer;
    }

    mapLoyaltyToTier(loyalty, bookingCount) {
        if (bookingCount === 0) return "NEW";
        if (loyalty === "platinum") return "VIP";
        if (["silver", "gold"].includes(loyalty)) return "LOYAL";
        return "NEW";
    }

    formatVoucherResponse(v) {
        return {
            id: v._id.toString(),
            code: v.code,
            name: v.name,
            description: v.description || "",
            discount_type: v.discount.type,
            discount_value: v.discount.value,
            max_discount: v.discount.max_discount,
            discount_text: this.formatDiscountText(v.discount),
            savings: v.savings ?? 0,
            priority: v.priority,
            begin_date: v.begin_date,
            end_date: v.end_date,
            max_uses: v.max_uses,
            used_count: v.used_count,
            remaining_uses: v.max_uses - v.used_count,
            conditions: v.conditions || {}
        };
    }

    calculateSavings(discount, orderValue) {
        if (discount.type === "FIXED") return discount.value;
        const raw = Math.round(orderValue * discount.value / 100);
        return discount.max_discount ? Math.min(raw, discount.max_discount) : raw;
    }

    formatDiscountText(discount) {
        if (discount.type === "PERCENT") {
            return `Giảm ${discount.value}%${discount.max_discount ? ` (tối đa ${discount.max_discount.toLocaleString("vi-VN")}đ)` : ""}`;
        }
        return `Giảm ${discount.value.toLocaleString("vi-VN")}đ`;
    }

    validateDiscount(discount) {
        if (!discount || !discount.type || discount.value == null)
            throw new Error("Thiếu thông tin giảm giá.");

        const { type, value, max_discount } = discount;

        if (!["PERCENT", "FIXED"].includes(type))
            throw new Error("Loại hình khuyến mãi không hợp lệ");
        
        if (value <= 0)
            throw new Error("Giá trị giảm phải lớn hơn 0.");
        
        if (type === "PERCENT") {
            if (value > 100) 
                throw new Error("Giảm % không vượt quá 100.");
            if (!max_discount || max_discount <= 0) 
                throw new Error("Cần cung cấp số tiền khuyến mãi tối đa.");
        }
    }

    validateConditions(conditions) {
        if (!conditions) return;

        const {
            rule_type, min_order_value, days_of_week, hours_range,
            customer_tiers, room_category_ids, service_category_ids
        } = conditions;

        const validRuleTypes = ["NONE", "FIRST_BOOKING", "MIN_BOOKING_VALUE", "SEASONAL", "HOLIDAY"];
        if (rule_type && !validRuleTypes.includes(rule_type)) {
            throw new Error("Loại điều kiện voucher không hợp lệ");
        }

        if (rule_type === "MIN_BOOKING_VALUE") {
            if (min_order_value == null || min_order_value <= 0) {
                throw new Error("MIN_BOOKING_VALUE yêu cầu min_order_value > 0");
            }
        }

        if (rule_type === "SEASONAL") {
            if (!days_of_week || days_of_week.length === 0) {
                throw new Error("SEASONAL yêu cầu ít nhất một ngày trong tuần (days_of_week)");
            }
        }

        if (rule_type === "FIRST_BOOKING") {
            if (customer_tiers && customer_tiers.length > 0) {
                throw new Error("FIRST_BOOKING không thể kết hợp với điều kiện hạng khách hàng");
            }
        }

        if (min_order_value != null && min_order_value < 0) {
            throw new Error("Tiền đơn hàng tối thiểu không được âm");
        }

        if (days_of_week) {
            if (!Array.isArray(days_of_week))
                throw new Error("days_of_week phải là mảng");
            if (days_of_week.some(d => typeof d !== "number" || d < 0 || d > 6))
                throw new Error("Ngày trong tuần chỉ nhận giá trị từ 0 đến 6.");
        }

        if (hours_range) {
            const { from, to } = hours_range;
            if (from == null || to == null || from < 0 || from > 23 || to < 0 || to > 23 || from > to)
                throw new Error("Khung giờ khuyến mãi không hợp lệ");
        }

        if (customer_tiers) {
            if (!Array.isArray(customer_tiers))
                throw new Error("customer_tiers phải là mảng");
            const validTiers = ["NEW", "LOYAL", "VIP"];
            if (customer_tiers.some(t => !validTiers.includes(t)))
                throw new Error("Hạng khách hàng không hợp lệ (NEW, LOYAL, VIP)");
        }

        if (room_category_ids) {
            if (!Array.isArray(room_category_ids))
                throw new Error("room_category_ids phải là mảng");
            if (room_category_ids.some(id => !mongoose.isValidObjectId(id)))
                throw new Error("room_category_ids chứa ID không hợp lệ");
        }

        if (service_category_ids) {
            if (!Array.isArray(service_category_ids))
                throw new Error("service_category_ids phải là mảng");
            if (service_category_ids.some(id => !mongoose.isValidObjectId(id)))
                throw new Error("service_category_ids chứa ID không hợp lệ");
        }
    }

    validateDates(begin_date, end_date) {
        if (!begin_date || !end_date)
            throw new Error("Ngày bắt đầu và kết thúc là bắt buộc");

        const begin = new Date(begin_date);
        const end = new Date(end_date);
        const now = new Date();

        if (begin >= end) 
            throw new Error("Ngày kết thúc phải sau ngày bắt đầu");
        if (now > end) 
            throw new Error("Ngày kết thúc phải là ngày trong tương lai");

        return { begin, end };
    }
}