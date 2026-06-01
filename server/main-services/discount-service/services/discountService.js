import mongoose from 'mongoose';
import { CUSTOMER_EVENTS } from '../../../shared/events/customerEvents.js';
import { cache, makeCacheKey } from '../../../shared/utils/cache.js';

export class DiscountService {
    constructor({ Discount, eventBus }) {
        this.Discount = Discount;
        this.eventBus = eventBus;
    }

    async createDiscount(data) {
        try {
            const { name, description, discount,
            conditions, begin_date, end_date, priority } = data;

            if (!name || !discount || !discount.type || discount.value == null) {
                throw new Error("Thiếu thông tin bắt buộc (tên, thể lệ khuyến mãi)");
            }

            const existingName = await this.Discount.findOne({ name });
            if (existingName) {
                throw new Error("Tên khuyến mãi đã tồn tại.");
            }

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

            const newDiscount = await this.Discount.create({
                name,
                description,
                discount,
                conditions: conditions && Object.keys(conditions).length > 0 ? conditions : undefined,
                begin_date: begin,
                end_date: end,
                priority: priority || 1,
                is_active,
                status
            });

            await cache.delByPattern("discount:list:*");
            return newDiscount;

        } catch (err) {
            console.log("Error creating discount:", err);
            throw err;
        }
    };

    async getAllDiscounts(query = {}) {
        try {
            const { status, type, name, min_order_value, date, day, hour,
                page = 1, limit = 10 } = query;

            const cacheKey = makeCacheKey("discount:list", {
                status: status || null,
                type: type || null,
                name: name || null,
                min_order_value: min_order_value || null,
                date: date || null,
                day: day || null,
                hour: hour || null,
                page: Number(page),
                limit: Number(limit),
            });
            const cached = await cache.get(cacheKey);
            if (cached) return cached;

            const filter = {};

            if (status) filter.status = status;
            if (type) filter["discount.type"] = type;
            if (name) filter.name = name;

            // date filter
            if (date) {
                const d = new Date(date);
                filter.begin_date = { $lte: d };
                filter.end_date = { $gte: d };
            }

            // condition filters
            if (min_order_value) {
                filter["conditions.min_order_value"] = { $lte: Number(min_order_value) };
            }

            if (day !== undefined) {
                filter["conditions.days_of_week"] = Number(day);
            }

            if (hour !== undefined) {
                filter["conditions.hours_range.from"] = { $lte: Number(hour) };
                filter["conditions.hours_range.to"] = { $gte: Number(hour) };
            }

            // const skip = (page - 1) * limit;
            // const [data, total] = await Promise.all([
            //     this.Discount.find(filter)
            //         .sort({ priority: -1, created_at: -1 })
            //         .skip(skip)
            //         .limit(Number(limit)),
            //     this.Discount.countDocuments(filter)
            // ]);

            const discounts = await this.Discount
                .find(filter)
                .select("-__v -updated_at")
                .sort({ priority: -1, created_at: -1 })
                .lean();

            await cache.set(cacheKey, discounts, 300);
            return discounts;

        } catch (err) {
            console.log("Error fetching discounts:", err);
            throw err;
        }
    };

    async getDiscountById (discountId) {
        try {
            const cacheKey = `discount:one:${discountId}`;
            const cached = await cache.get(cacheKey);
            if (cached) return cached;

            const discount = await this.Discount.findById(discountId)
                .select("-__v -created_at -updated_at");

            if (!discount) {
                throw new Error("Không tìm thấy discount");
            }

            await cache.set(cacheKey, discount, 300);
            return discount;

        } catch (err) {
            console.log("Error fetching discount by ID:", err);
            throw err;
        }
    };

    async deleteDiscount(discountId) {
        try {
            const discount = await this.Discount.findById(discountId);

            if (!discount)
                throw new Error("Không tìm thấy khuyến mãi!");

            const now = new Date();
            if (now >= discount.begin_date || discount.is_active || discount.status === "ongoing") {
                throw new Error("Không thể xóa vì khuyến mãi đã bắt đầu!");
            }

            await this.Discount.findByIdAndDelete(discountId);
            await Promise.all([
                cache.del(`discount:one:${discountId}`),
                cache.delByPattern("discount:list:*"),
            ]);
            return { success: true };

        } catch (err) {
            console.log("Error deleting discount:", err);
            throw err;
        }
    };

    async unactivateDiscount(discountId) {
        try {
            const discount = await this.Discount.findById(discountId);
            if (!discount)
                throw new Error("Không tìm thấy discount");

            discount.is_active = false;
            discount.status = "finished";
            await discount.save();
            await Promise.all([
                cache.del(`discount:one:${discountId}`),
                cache.delByPattern("discount:list:*"),
            ]);

            return { success: true };

        } catch (err) {
            console.log("Error unactivating discount:", err);
            throw err;
        }
    };

    async updateDiscount(discountId, payload) {
        try {
            const discount = await this.Discount.findById(discountId);
            if (!discount)
                throw new Error("Không tìm thấy khuyến mãi");

            const now = new Date();
            // const isRunning = discount.is_active && now >= discount.begin_date && now <= discount.end_date;
            // Chặn update một số trường quan trọng khi đang chạy (tùy chọn - có thể bỏ nếu muốn cho phép update)
            // if (isRunning) {
            //   const blockedFields = ["begin_date", "discount", "conditions"];
            //   for (const field of blockedFields) {
            //     if (payload[field] !== undefined) {
            //       return res.status(400).json({
            //         success: false,
            //         message: "Không thể chỉnh sửa khuyến mãi đang hoạt động."
            //       });
            //     }
            //   }
            // }

            if (payload.name) {
                const exist = await this.Discount.findOne({
                    name: payload.name,
                    _id: { $ne: discountId }
                });
                if (exist) {
                    throw new Error("Tên khuyến mãi đã tồn tại.");
                }
                discount.name = payload.name;
            }

            if (payload.description !== undefined) {
                discount.description = payload.description;
            }

            if (payload.begin_date || payload.end_date) {
                const begin = payload.begin_date ? new Date(payload.begin_date) : discount.begin_date;
                const end = payload.end_date ? new Date(payload.end_date) : discount.end_date;

                this.validateDates(begin, end);
                
                discount.begin_date = begin;
                discount.end_date = end;
                
                // Cập nhật is_active và status
                if (now >= begin && now <= end) {
                    discount.is_active = true;
                    discount.status = "ongoing";
                } else if (now < begin) {
                    discount.is_active = false;
                    discount.status = "upcoming";
                } else {
                    discount.is_active = false;
                    discount.status = "finished";
                }
            }

            if (payload.priority !== undefined) {
                if (typeof payload.priority !== "number" || payload.priority < 1) {
                    throw new Error("Độ ưu tiên phải là số >= 1");
                }
                discount.priority = payload.priority;
            }

            if (payload.discount) {
                this.validateDiscount(payload.discount);
                discount.discount = payload.discount;
            }

            if (payload.conditions !== undefined) {
                this.validateConditions(payload.conditions);
                discount.conditions = payload.conditions;
            }

            await discount.save();
            await Promise.all([
                cache.del(`discount:one:${discountId}`),
                cache.delByPattern("discount:list:*"),
            ]);
            return discount;

        } catch (err) {
            console.log("Error updating discount:", err);
            throw err;
        }
    };

async getAvailableDiscounts(query = {}) {
        try {
            const { customer_id, order_value } = query;

            if (!customer_id) {
                const err = new Error("Thiếu customer_id");
                err.status = 400;
                throw err;
            }

            const orderValue = order_value ? parseFloat(order_value) : 0;
            const now = new Date();

            const discounts = await this.Discount.find({
                is_active: true,
                begin_date: { $lte: now },
                end_date: { $gte: now }
            })
                .select("-__v")
                .sort({ priority: -1, created_at: -1 })
                .lean();

            const discountsWithAvailability = discounts.map((discount) => {
                const conditions = discount.conditions || {};
                let isAvailable = this.checkDiscountConditions(discount, orderValue);
                let availabilityReason = null;

                if (!isAvailable) {
                    const rule = conditions.rule_type;
                    if (rule === "MIN_BOOKING_VALUE" && conditions.min_order_value) {
                        availabilityReason = `Chỉ áp dụng cho đơn hàng từ ${conditions.min_order_value.toLocaleString("vi-VN")}đ`;
                    } else if (rule === "SEASONAL") {
                        availabilityReason = "Không áp dụng vào thời điểm này";
                    } else {
                        availabilityReason = "Không đáp ứng điều kiện khuyến mãi";
                    }
                }

                const discountAmount = isAvailable && orderValue > 0
                    ? this.calculateSavings(discount.discount, orderValue)
                    : 0;

                return {
                    id: discount._id.toString(),
                    code: discount.code || null,
                    name: discount.name,
                    description: discount.description || "",
                    discount_type: discount.discount.type,
                    discount_value: discount.discount.value,
                    max_discount: discount.discount.max_discount || null,
                    discount_text: this.formatDiscountText(discount.discount),
                    discount_amount: discountAmount,
                    priority: discount.priority || 1,
                    begin_date: discount.begin_date,
                    end_date: discount.end_date,
                    conditions,
                    is_available: isAvailable,
                    availability_reason: availabilityReason,
                };
            });

            return discountsWithAvailability;

        } catch (err) {
            console.error("Error getting available discounts:", err);
            throw err;
        }
    };

    // called by booking service — returns top 2 discounts ranked by priority then savings
    async getApplicableDiscounts(orderValue = 0) {
        try {
            const now = new Date();

            const discounts = await this.Discount.find({
                is_active: true,
                begin_date: { $lte: now },
                end_date: { $gte: now }
            })
                .select("-__v")
                .sort({ priority: -1, created_at: -1 })
                .lean();

            // filter by conditions, then calculate savings
            const eligible = discounts
                .filter(d => this.checkDiscountConditions(d, orderValue))
                .map(d => ({
                    ...d,
                    savings: this.calculateSavings(d.discount, orderValue)
                }));

            // sort: priority desc, then savings desc as tiebreaker
            eligible.sort((a, b) =>
                b.priority !== a.priority
                    ? b.priority - a.priority
                    : b.savings - a.savings
            );

            // pick top 2
            return eligible.slice(0, 2).map(d => ({
                id: d._id.toString(),
                name: d.name,
                description: d.description || "",
                discount_type: d.discount.type,
                discount_value: d.discount.value,
                max_discount: d.discount.max_discount,
                discount_text: this.formatDiscountText(d.discount),
                savings: d.savings,
                priority: d.priority,
                begin_date: d.begin_date,
                end_date: d.end_date,
                conditions: d.conditions || {}
            }));

        } catch (err) {
            console.error("Error getting applicable discounts:", err);
            throw err;
        }
    }

    // helper

    checkDiscountConditions(discount, orderValue) {
        const conditions = discount.conditions || {};
        const rule_type = conditions.rule_type || "NONE";
        const now = new Date();

        if (rule_type === "MIN_BOOKING_VALUE") {
            if (orderValue < (conditions.min_order_value || 0)) return false;
        }

        if (rule_type === "SEASONAL") {
            if (conditions.days_of_week?.length > 0) {
                if (!conditions.days_of_week.includes(now.getDay())) return false;
            }
            if (conditions.hours_range) {
                const hour = now.getHours();
                if (hour < conditions.hours_range.from || hour > conditions.hours_range.to) return false;
            }
        }

        if (rule_type !== "MIN_BOOKING_VALUE" && conditions.min_order_value > 0) {
            if (orderValue < conditions.min_order_value) return false;
        }

        return true;
    }

    calculateSavings(discount, orderValue) {
        if (discount.type === "FIXED") {
            return discount.value;
        }
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
        if (!discount || !discount.type || discount.value == null) {
            throw new Error("Thiếu thông tin giảm giá.");
        }

        const { type, value, max_discount } = discount;

        if (!["PERCENT", "FIXED"].includes(type)) {
            throw new Error("Loại hình khuyến mãi không hợp lệ");
        }

        if (value <= 0) {
            throw new Error("Giá trị giảm phải lớn hơn 0.");
        }

        if (type === "PERCENT") {
            if (value > 100) {
                throw new Error("Giảm % không vượt quá 100.");
            }

            if (!max_discount || max_discount <= 0) {
                throw new Error("Cần cung cấp số tiền khuyến mãi tối đa.");
            }
        }

        if (type === "FIXED") {
            if (value <= 0) {
                throw new Error("Số tiền khuyến mãi cố định phải > 0");
            }
        }
    }

    validateConditions(conditions) {
        if (!conditions) return;

        const {
            rule_type, min_order_value, days_of_week, hours_range,
            customer_tiers, room_category_ids, service_category_ids
        } = conditions;

        const validRuleTypes = ["NONE", "MIN_BOOKING_VALUE", "SEASONAL", "HOLIDAY"];
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
        if (!begin_date || !end_date) {
            throw new Error("Ngày bắt đầu và kết thúc là bắt buộc");
        }

        const begin = new Date(begin_date);
        const end = new Date(end_date);
        const now = new Date();

        if (begin >= end) {
            throw new Error("Ngày kết thúc phải sau ngày bắt đầu");
        }

        if (now > end) {
            throw new Error("Ngày kết thúc phải là ngày trong tương lai");
        }

        return { begin, end };
    }
}