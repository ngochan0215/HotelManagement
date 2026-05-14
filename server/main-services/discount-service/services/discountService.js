import mongoose from 'mongoose';
import { CUSTOMER_EVENTS } from '../../../shared/events/customerEvents.js';

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

            return discounts;

        } catch (err) {
            console.log("Error fetching discounts:", err);
            throw err;
        }
    };

    async getDiscountById (discountId) {
        try {
            const discount = await this.Discount.findById(discountId)
                .select("-__v -created_at -updated_at");
            
            if (!discount) {
                throw new Error("Không tìm thấy discount");
            }
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
            return discount;

        } catch (err) { 
            console.log("Error updating discount:", err);
            throw err;
        }
    };

    // async checkDiscountAvailability(discount, customerId, orderValue) {
    //     const now = new Date();
        
    //     if (!discount.is_active) 
    //         return { available: false, reason: "Khuyến mãi chưa được kích hoạt" };
    //     if (now < discount.begin_date) 
    //         return { available: false, reason: "Khuyến mãi chưa bắt đầu" };
    //     if (now > discount.end_date) 
    //         return { available: false, reason: "Khuyến mãi đã kết thúc" };
        
    //     const conditions = discount.conditions || {};
        
    //     // if (conditions.rule_type === "FIRST_BOOKING") {
    //     //     const hasPreviousBooking = await this.Booking.exists({
    //     //         customer_id: customerId,
    //     //         status: { $in: ["confirmed", "in_progress", "completed"] }
    //     //     });
    //     //     if (hasPreviousBooking) {
    //     //         throw new Error("Chỉ áp dụng cho khách hàng chưa có đơn hàng nào trước đây");
    //     //     }
    //     // }
        
    //     if (conditions.rule_type === "MIN_ORDER_VALUE" && conditions.min_order_value) {
    //         if (orderValue < conditions.min_order_value) {
    //             throw new Error(`Chỉ áp dụng cho đơn hàng có giá trị tối thiểu ${conditions.min_order_value.toLocaleString("vi-VN")}đ`);
    //         }
    //     }
        
    //     if (conditions.customer_tiers && conditions.customer_tiers.length > 0) {
    //         const reply = await this.eventBus.safeRequest(
    //             CUSTOMER_EVENTS.CHECK_EXISTS,
    //             { customerId }
    //         );
    //         if (!reply.success) {
    //             throw new Error(reply.message);
    //         }

    //         const customer = reply.customer;
    //         const customerTier = this.mapLoyaltyToTier(customer.loyalty || "bronze", customer.booking_count || 0);

    //         if (!conditions.customer_tiers.includes(customerTier)) {
    //             const tierNames = { NEW: "Mới", LOYAL: "Thân thiết", VIP: "VIP" };
    //             const allowedTiers = conditions.customer_tiers.map(t => tierNames[t] || t).join(", ");
    //             throw new Error(`Chỉ áp dụng cho khách hàng hạng: ${allowedTiers}`);
    //         }
    //     }
        
    //     if (conditions.days_of_week && conditions.days_of_week.length > 0) {
    //         const dayOfWeek = now.getDay();
    //         if (!conditions.days_of_week.includes(dayOfWeek)) {
    //             const dayNames = ["Chủ nhật", "Thứ 2", "Thứ 3", "Thứ 4", "Thứ 5", "Thứ 6", "Thứ 7"];
    //             const validDays = conditions.days_of_week.map(d => dayNames[d]).join(", ");
    //             throw new Error(`Chỉ áp dụng vào các ngày: ${validDays}`);
    //         }
    //     }
        
    //     if (conditions.hours_range) {
    //         const { from, to } = conditions.hours_range;
    //         const hour = now.getHours();
    //         if (hour < from || hour > to) {
    //             throw new Error(`Chỉ áp dụng vào khung giờ: ${from}:00 - ${to}:00`);
    //         }
    //     }
        
    //     // Kiểm tra task_ids (nếu có, có thể bỏ qua hoặc check sau)
    //     // task_ids thường dùng cho SEASONAL, có thể check sau nếu cần
        
    //     return { available: true };
    // };

    // async getAvailableDiscounts(query = {}) {
    //     try {
    //         const { customer_id, order_value } = query;
            
    //         if (!customer_id) {
    //             throw new Error("Thiếu customer_id");
    //         }
            
    //         const orderValue = order_value ? parseFloat(order_value) : 0;
    //         const now = new Date();
            
    //         const discounts = await this.Discount.find({
    //             is_active: true,
    //             begin_date: { $lte: now },
    //             end_date: { $gte: now }
    //         })
    //             .select("-__v")
    //             .sort({ priority: -1, created_at: -1 })
    //             .lean();
            
    //         const discountsWithAvailability = await Promise.all(
    //             discounts.map(async (discount) => {
    //                 const availability = await this.checkDiscountAvailability( discount, customer_id, orderValue );
                
    //                 // calculate discount amount for display
    //                 let discountAmount = 0;
    //                 let discountText = "";
                    
    //                 if (availability.available && orderValue > 0) {
    //                     if (discount.discount.type === "PERCENT") {
    //                         discountAmount = Math.round(orderValue * discount.discount.value / 100);
    //                         if (discount.discount.max_discount && discountAmount > discount.discount.max_discount) {
    //                             discountAmount = discount.discount.max_discount;
    //                         }
    //                         discountText = `Giảm ${discount.discount.value}%${discount.discount.max_discount ? ` (tối đa ${discount.discount.max_discount.toLocaleString("vi-VN")}đ)` : ""}`;
    //                     } else {
    //                         discountAmount = discount.discount.value;
    //                         discountText = `Giảm ${discount.discount.value.toLocaleString("vi-VN")}đ`;
    //                     }
    //                 } else {
    //                     if (discount.discount.type === "PERCENT") {
    //                         discountText = `Giảm ${discount.discount.value}%${discount.discount.max_discount ? ` (tối đa ${discount.discount.max_discount.toLocaleString("vi-VN")}đ)` : ""}`;
    //                     } else {
    //                         discountText = `Giảm ${discount.discount.value.toLocaleString("vi-VN")}đ`;
    //                     }
    //                 }
                    
    //                 return {
    //                     id: discount._id.toString(),
    //                     code: discount.code,
    //                     name: discount.name,
    //                     description: discount.description || "",
    //                     discount_type: discount.discount.type,
    //                     discount_value: discount.discount.value,
    //                     max_discount: discount.discount.max_discount,
    //                     discount_text: discountText,
    //                     discount_amount: discountAmount,
    //                     priority: discount.priority || 1,
    //                     begin_date: discount.begin_date,
    //                     end_date: discount.end_date,
    //                     conditions: discount.conditions || {},
    //                     is_available: availability.available,
    //                     availability_reason: availability.reason || null
    //                 };
    //             })
    //         );
            
    //         return discountsWithAvailability;
            
    //     } catch (err) {
    //         console.error("Error getting available discounts:", err);
    //         throw err;
    //     }
    // };

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