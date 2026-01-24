import { Discount, Customer, Booking } from "../models/index.js";
import mongoose from "mongoose";

export const createDiscount = async (req, res) => {
  try {
    const { code, name, description, discount,
      conditions, begin_date, end_date, priority } = req.body;

    if (!code || !name || !discount || !discount.type || discount.value == null) {
      return res.status(400).json({
        success: false,
        message: "Thiếu thông tin bắt buộc (mã, tên, thể lệ khuyến mãi)"
      });
    }

    const existing = await Discount.findOne({ code: code.toUpperCase() });
    if (existing) {
      return res.status(400).json({ success: false, message: "Mã khuyến mãi đã tồn tại." });
    }

    const existingName = await Discount.findOne({ name });
    if (existingName) {
      return res.status(400).json({ success: false, message: "Tên khuyến mãi đã tồn tại." });
    }

    if (!["PERCENT", "FIXED"].includes(discount.type)) {
      return res.status(400).json({
        success: false,
        message: "Loại hình khuyến mãi không hợp lệ"
      });
    }

    if (discount.type === "FIXED") {
      if (discount.value <= 0) {
        return res.status(400).json({
          success: false,
          message: "Số tiền khuyến mãi cố định phải > 0"
        });
      }
    }

    if (discount.type === "PERCENT") {
      if (discount.value <= 0 || discount.value > 100) {
        return res.status(400).json({
          success: false,
          message: "Phần trăm khuyến mãi phải nằm trong (0, 100]"
        });
      }

      if (!discount.max_discount || discount.max_discount <= 0) {
        return res.status(400).json({
          success: false,
          message: "Cần cung cấp số tiền khuyến mãi tối đa."
        });
      }
    }

    if (conditions) {
      const { rule_type, min_order_value, days_of_week, hours_range, customer_tiers, room_category_ids } = conditions;

      if (min_order_value != null && min_order_value < 0) {
        return res.status(400).json({
          success: false,
          message: "Tiền đơn hàng tối thiểu không được âm"
        });
      }

      if (rule_type && !["NONE", "MIN_BOOKING_VALUE", "FIRST_BOOKING", "SEASONAL", "HOLIDAY"].includes(rule_type)) {
        return res.status(400).json({ message: "Điều kiện áp dụng voucher không hợp lệ." });
      }

      if (days_of_week) {
        if (!Array.isArray(days_of_week)) {
          return res.status(400).json({
            success: false,
            message: "days_of_week phải là mảng"
          });
        }
        const invalidDay = days_of_week.some(
          d => typeof d !== "number" || d < 0 || d > 6
        );
        if (invalidDay) {
          return res.status(400).json({
            success: false,
            message: "Ngày trong tuần chỉ nhận giá trị từ 0 đến 6 (0=Chủ nhật, 1=Thứ 2, ..., 6=Thứ 7)."
          });
        }
      }

      if (hours_range) {
        const { from, to } = hours_range;
        if (
          from == null || to == null ||
          from < 0 || from > 23 ||
          to < 0 || to > 23 ||
          from > to
        ) {
          return res.status(400).json({
            success: false,
            message: "Khung giờ khuyến mãi không hợp lệ"
          });
        }
      }

      if (customer_tiers) {
        if (!Array.isArray(customer_tiers)) {
          return res.status(400).json({
            success: false,
            message: "customer_tiers phải là mảng"
          });
        }
        const validTiers = ["bronze", "silver", "gold", "platinum"];
        const invalidTier = customer_tiers.some(tier => !validTiers.includes(tier));
        if (invalidTier) {
          return res.status(400).json({
            success: false,
            message: "Hạng khách hàng chỉ nhận giá trị: bronze, silver, gold, platinum"
          });
        }
      }

      if (room_category_ids) {
        if (!Array.isArray(room_category_ids)) {
          return res.status(400).json({
            success: false,
            message: "room_category_ids phải là mảng"
          });
        }
        // Validate ObjectIds
        const invalidId = room_category_ids.some(id => !mongoose.isValidObjectId(id));
        if (invalidId) {
          return res.status(400).json({
            success: false,
            message: "room_category_ids chứa ID không hợp lệ"
          });
        }
      }
    }

    if (!begin_date || !end_date) {
      return res.status(400).json({
        success: false,
        message: "Ngày bắt đầu và kết thúc là bắt buộc"
      });
    }

    const begin = new Date(begin_date);
    const end = new Date(end_date);
    const now = new Date();

    if (begin >= end) {
      return res.status(400).json({
        success: false,
        message: "Ngày bắt đầu phải nhỏ hơn ngày kết thúc."
      });
    }

    if (now > end) {
      return res.status(400).json({
        success: false,
        message: "Ngày kết thúc không được ở trong quá khứ"
      });
    }

    let is_active = false;
    let status = "upcoming";
    if (now >= begin && now <= end) {
      is_active = true;
      status = "ongoing";
    } else if (now > end) {
      status = "finished";
    }

    const newDiscount = await Discount.create({
      code: code.toUpperCase(),
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

    return res.status(201).json({
      success: true,
      message: "Tạo discount thành công",
      data: newDiscount
    });

  } catch (err) {
    console.error(err);
    return res.status(500).json({
      success: false,
      message: "SERVER ERROR: " + err.message
    });
  }
};

export const getAllDiscounts = async (req, res) => {
  try {
    const { status, type, code, name,
      min_order_value, customer_tier, date,
      day, hour, page = 1, limit = 10 } = req.query;

    const filter = {};

    if (status) filter.status = status;
    if (type) filter["discount.type"] = type;
    if (code) filter.code = code;
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

    // const skip = (page - 1) * limit;

    // const [data, total] = await Promise.all([
    //   Discount.find(filter)
    //     .sort({ priority: -1, created_at: -1 })
    //     .skip(skip)
    //     .limit(Number(limit)),
    //   Discount.countDocuments(filter)
    // ]);

    const discounts = await Discount
      .find(filter)
      .select("-__v")
      .sort({ priority: -1, created_at: -1 })
      .lean();

    return res.json({
      success: true,
      total: discounts.length,
      discounts
    });

  } catch (err) {
    console.error(err);
    return res.status(500).json({
      success: false,
      message: "SERVER ERROR: " + err.message
    });
  }
};

export const getDiscountById = async (req, res) => {
  try {
    const { id } = req.params;

    const discount = await Discount.findById(id).select("-__v");
    if (!discount) {
      return res.status(404).json({
        success: false,
        message: "Không tìm thấy discount"
      });
    }

    return res.json({
      success: true,
      data: discount
    });

  } catch (err) {
    return res.status(500).json({
      success: false,
      message: "SERVER ERROR: " + err.message
    });
  }
};

export const deleteDiscount = async (req, res) => {
  try {
      const { id } = req.params;
      const discount = await Discount.findById(id);

      if (!discount)
        return res.status(404).json({ success: false, message: "Không tìm thấy khuyến mãi!" });

      // const now = new Date();
      // if (now >= discount.begin_date || discount.is_active || discount.status === "ongoing") {
      //   return res.status(400).json({
      //     success: false,
      //     message: "Không thể xóa vì khuyến mãi đã bắt đầu!"
      //   });
      // }

      await Discount.findByIdAndDelete(id);
      return res.status(200).json({ success: true, message: "Xóa khuyến mãi thành công!"});

  } catch (err) {
      console.error(err);
      return res.status(500).json({ success: false, message: "SERVER ERROR: " + err.message });
  }
};

export const unactivateDiscount = async (req, res) => {
  try {
    const { id } = req.params;

    const discount = await Discount.findById(id);
    if (!discount) {
      return res.status(404).json({
        success: false,
        message: "Không tìm thấy discount"
      });
    }

    discount.is_active = false;
    discount.status = "finished";
    await discount.save();

    return res.json({
      success: true,
      message: "Dừng hoạt động discount thành công"
    });

  } catch (err) {
    return res.status(500).json({
      success: false,
      message: "SERVER ERROR: " + err.message
    });
  }
};

export const updateDiscount = async (req, res) => {
  try {
    const { id } = req.params;
    const payload = req.body;

    const discount = await Discount.findById(id);
    if (!discount) {
      return res.status(404).json({ 
        success: false, 
        message: "Không tìm thấy khuyến mãi" 
      });
    }

    const now = new Date();
    const isRunning = discount.is_active && now >= discount.begin_date && now <= discount.end_date;

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

    // Check trùng code
    if (payload.code) {
      const exist = await Discount.findOne({
        code: payload.code.toUpperCase(),
        _id: { $ne: id }
      });
      if (exist) {
        return res.status(400).json({ 
          success: false, 
          message: "Mã khuyến mãi đã tồn tại." 
        });
      }
      discount.code = payload.code.toUpperCase();
    }

    // Check trùng name
    if (payload.name) {
      const exist = await Discount.findOne({
        name: payload.name,
        _id: { $ne: id }
      });
      if (exist) {
        return res.status(400).json({ 
          success: false, 
          message: "Tên khuyến mãi đã tồn tại." 
        });
      }
      discount.name = payload.name;
    }

    // Update description
    if (payload.description !== undefined) {
      discount.description = payload.description;
    }

    // Validate & update date
    if (payload.begin_date || payload.end_date) {
      const begin = payload.begin_date ? new Date(payload.begin_date) : discount.begin_date;
      const end = payload.end_date ? new Date(payload.end_date) : discount.end_date;

      if (isNaN(begin.getTime()) || isNaN(end.getTime())) {
        return res.status(400).json({ 
          success: false, 
          message: "Định dạng ngày không hợp lệ." 
        });
      }

      if (end <= begin) {
        return res.status(400).json({ 
          success: false, 
          message: "Ngày kết thúc phải sau ngày bắt đầu." 
        });
      }

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

    // Update priority
    if (payload.priority !== undefined) {
      if (typeof payload.priority !== "number" || payload.priority < 1) {
        return res.status(400).json({
          success: false,
          message: "Độ ưu tiên phải là số >= 1"
        });
      }
      discount.priority = payload.priority;
    }

    // Update discount object
    if (payload.discount) {
      const { type, value, max_discount } = payload.discount;

      if (!["PERCENT", "FIXED"].includes(type)) {
        return res.status(400).json({ 
          success: false, 
          message: "Loại giảm giá không hợp lệ." 
        });
      }

      if (value == null || value <= 0) {
        return res.status(400).json({ 
          success: false, 
          message: "Giá trị giảm phải lớn hơn 0." 
        });
      }

      if (type === "PERCENT") {
        if (value > 100) {
          return res.status(400).json({ 
            success: false, 
            message: "Giảm % không vượt quá 100." 
          });
        }
        if (!max_discount || max_discount <= 0) {
          return res.status(400).json({
            success: false,
            message: "Cần cung cấp số tiền khuyến mãi tối đa cho loại phần trăm."
          });
        }
      }

      discount.discount = {
        type,
        value,
        max_discount: type === "PERCENT" ? max_discount : undefined
      };
    }

    // Update conditions
    if (payload.conditions !== undefined) {
      // Nếu conditions là null, xóa tất cả conditions
      if (payload.conditions === null) {
        discount.conditions = {};
      } else {
        const { rule_type, min_order_value, days_of_week, hours_range, customer_tiers, room_category_ids } = payload.conditions;

        if (rule_type && !["NONE", "MIN_BOOKING_VALUE", "FIRST_BOOKING", "SEASONAL", "HOLIDAY"].includes(rule_type)) {
          return res.status(400).json({ message: "Điều kiện áp dụng voucher không hợp lệ." });
        }

        // Validate min_order_value
        if (min_order_value !== undefined) {
          if (min_order_value < 0) {
            return res.status(400).json({
              success: false,
              message: "Tiền đơn hàng tối thiểu không được âm"
            });
          }
        }

        // Validate days_of_week
        if (days_of_week !== undefined) {
          if (days_of_week !== null && !Array.isArray(days_of_week)) {
            return res.status(400).json({
              success: false,
              message: "days_of_week phải là mảng hoặc null"
            });
          }
          if (Array.isArray(days_of_week)) {
            const invalidDay = days_of_week.some(
              d => typeof d !== "number" || d < 0 || d > 6
            );
            if (invalidDay) {
              return res.status(400).json({
                success: false,
                message: "Ngày trong tuần chỉ nhận giá trị từ 0 đến 6 (0=Chủ nhật, 1=Thứ 2, ..., 6=Thứ 7)."
              });
            }
          }
        }

        // Validate hours_range
        if (hours_range !== undefined) {
          if (hours_range === null) {
            // Cho phép xóa hours_range bằng cách set null
          } else if (hours_range) {
            const { from, to } = hours_range;
            if (
              from == null || to == null ||
              from < 0 || from > 23 ||
              to < 0 || to > 23 ||
              from > to
            ) {
              return res.status(400).json({
                success: false,
                message: "Khung giờ khuyến mãi không hợp lệ"
              });
            }
          }
        }

        // Validate customer_tiers
        if (customer_tiers !== undefined) {
          if (customer_tiers !== null && !Array.isArray(customer_tiers)) {
            return res.status(400).json({
              success: false,
              message: "customer_tiers phải là mảng hoặc null"
            });
          }
          if (Array.isArray(customer_tiers)) {
            const validTiers = ["bronze", "silver", "gold", "platinum"];
            const invalidTier = customer_tiers.some(tier => !validTiers.includes(tier));
            if (invalidTier) {
              return res.status(400).json({
                success: false,
                message: "Hạng khách hàng chỉ nhận giá trị: bronze, silver, gold, platinum"
              });
            }
          }
        }

        // Validate task_ids
        if (room_category_ids !== undefined) {
          if (room_category_ids !== null && !Array.isArray(room_category_ids)) {
            return res.status(400).json({
              success: false,
              message: "room_category_ids phải là mảng hoặc null"
            });
          }
          if (Array.isArray(room_category_ids)) {
            const invalidId = room_category_ids.some(id => !mongoose.isValidObjectId(id));
            if (invalidId) {
              return res.status(400).json({
                success: false,
                message: "room_category_ids chứa ID không hợp lệ"
              });
            }
          }
        }

        // Merge conditions - chỉ update các field được gửi lên
        discount.conditions = discount.conditions || {};
        
        if (min_order_value !== undefined) {
          if (min_order_value > 0) {
            discount.conditions.min_order_value = min_order_value;
          } else {
            delete discount.conditions.min_order_value;
          }
        }

        if (rule_type !== undefined) {
          if (rule_type !== null) {
            discount.conditions.rule_type = rule_type;
          } else {
            delete discount.conditions.rule_type;
          }
        }
        
        if (days_of_week !== undefined) {
          if (days_of_week === null || (Array.isArray(days_of_week) && days_of_week.length === 0)) {
            delete discount.conditions.days_of_week;
          } else if (Array.isArray(days_of_week)) {
            discount.conditions.days_of_week = days_of_week;
          }
        }
        
        if (hours_range !== undefined) {
          if (hours_range === null) {
            delete discount.conditions.hours_range;
          } else if (hours_range) {
            discount.conditions.hours_range = hours_range;
          }
        }
        
        if (customer_tiers !== undefined) {
          if (customer_tiers === null || (Array.isArray(customer_tiers) && customer_tiers.length === 0)) {
            delete discount.conditions.customer_tiers;
          } else if (Array.isArray(customer_tiers)) {
            discount.conditions.customer_tiers = customer_tiers;
          }
        }
        
        if (room_category_ids !== undefined) {
          if (room_category_ids === null || (Array.isArray(room_category_ids) && room_category_ids.length === 0)) {
            delete discount.conditions.room_category_ids;
          } else if (Array.isArray(room_category_ids)) {
            discount.conditions.room_category_ids = room_category_ids;
          }
        }
      }
    }

    await discount.save();

    return res.status(200).json({ 
      success: true, 
      message: "Cập nhật khuyến mãi thành công",
      data: discount
    });

  } catch (err) { 
    console.error(err);
    return res.status(500).json({ 
      success: false, 
      message: "SERVER ERROR: " + err.message 
    });
  }
};

// // hàm xem trước khuyến mãi
// export const getPreviewDiscount = async (req, res) => {
//   try {
//     const userId = req.userId;

//     // Lấy thông tin customer
//     const customer = await Customer.findOne({ user_id: userId }).select("type");
//     const customerTier = customer?.type?.toUpperCase() || "NEW";

//     const now = new Date();
//     const dayOfWeek = now.getDay();
//     const hour = now.getHours();

//     // Tìm tất cả discount phù hợp (không filter theo taskId, lấy cả global và specific)
//     const discounts = await Discount.find({
//       is_active: true,
//       begin_date: { $lte: now },
//       end_date: { $gte: now },
//       $and: [
//         // theo hạng khách
//         {
//           $or: [
//             { "conditions.customer_tiers": { $exists: false } },
//             { "conditions.customer_tiers": { $size: 0 } },
//             { "conditions.customer_tiers": customerTier }
//           ]
//         },
//         // theo ngày trong tuần
//         {
//           $or: [
//             { "conditions.days_of_week": { $exists: false } },
//             { "conditions.days_of_week": { $size: 0 } },
//             { "conditions.days_of_week": dayOfWeek }
//           ]
//         },
//         // theo giờ
//         {
//           $or: [
//             { "conditions.hours_range": { $exists: false } },
//             {
//               "conditions.hours_range.from": { $lte: hour },
//               "conditions.hours_range.to": { $gte: hour }
//             }
//           ]
//         }
//       ]
//     }).sort({ priority: -1 });

//     return res.status(200).json({
//       success: true,
//       discounts: discounts.map(d => ({
//         id: d._id,
//         code: d.code,
//         name: d.name,
//         description: d.description,
//         type: d.discount.type,
//         value: d.discount.value,
//         max_discount: d.discount.max_discount,
//         priority: d.priority,
//         is_global: !d.conditions?.task_ids || d.conditions.task_ids.length === 0,
//         conditions: d.conditions ? {
//           min_order_value: d.conditions.min_order_value,
//           task_ids: d.conditions.task_ids || [],
//           days_of_week: d.conditions.days_of_week || [],
//           hours_range: d.conditions.hours_range,
//           customer_tiers: d.conditions.customer_tiers || []
//         } : null
//       }))
//     });

//   } catch (err) {
//     console.error(err);
//     return res.status(500).json({
//       success: false,
//       message: "SERVER ERROR: " + err.message
//     });
//   }
// };

// // Hàm lấy danh sách discount đang hoạt động cho customer (để hiển thị trên trang chủ)
// export const getActivePromotions = async (req, res) => {
//   try {
//     const userId = req.userId;
//     const now = new Date();
//     const dayOfWeek = now.getDay();
//     const hour = now.getHours();

//     // Lấy thông tin customer
//     const customer = await Customer.findOne({ user_id: userId }).select("type total_completed_orders");
//     const customerTier = customer?.type?.toUpperCase() || "NEW";

//     // Lấy discount đang hoạt động và phù hợp
//     const discounts = await Discount.find({
//       is_active: true,
//       begin_date: { $lte: now },
//       end_date: { $gte: now },
//       $and: [
//         {
//           $or: [
//             { "conditions.customer_tiers": { $exists: false } },
//             { "conditions.customer_tiers": { $size: 0 } },
//             { "conditions.customer_tiers": customerTier }
//           ]
//         },
//         {
//           $or: [
//             { "conditions.days_of_week": { $exists: false } },
//             { "conditions.days_of_week": { $size: 0 } },
//             { "conditions.days_of_week": dayOfWeek }
//           ]
//         },
//         {
//           $or: [
//             { "conditions.hours_range": { $exists: false } },
//             {
//               "conditions.hours_range.from": { $lte: hour },
//               "conditions.hours_range.to": { $gte: hour }
//             }
//           ]
//         }
//       ]
//     })
//       .select("-__v")
//       .sort({ priority: -1, created_at: -1 })
//       .limit(10)
//       .lean();

//     // Lấy voucher đang hoạt động
//     const vouchers = await Voucher.find({
//       is_active: true,
//       begin_date: { $lte: now },
//       end_date: { $gte: now },
//       $or: [
//         { total_quantity: null },
//         { $expr: { $lt: ["$used_quantity", "$total_quantity"] } }
//       ]
//     })
//       .select("-__v")
//       .sort({ created_at: -1 })
//       .limit(10)
//       .lean();

//     // Lấy usage của user cho voucher
//     const { VoucherUsage } = await import("../models/index.js");
//     const usages = await VoucherUsage.aggregate([
//       { $match: { user_id: userId } },
//       {
//         $group: {
//           _id: "$voucher_id",
//           used_count: { $sum: "$used_count" }
//         }
//       }
//     ]);
//     const usageMap = new Map();
//     usages.forEach(u => {
//       usageMap.set(String(u._id), u.used_count);
//     });

//     // Format discount
//     const formattedDiscounts = discounts.map(d => {
//       const discountText = d.discount.type === "PERCENT"
//         ? `Giảm ${d.discount.value}%${d.discount.max_discount ? ` (tối đa ${d.discount.max_discount.toLocaleString("vi-VN")}đ)` : ""}`
//         : `Giảm ${d.discount.value.toLocaleString("vi-VN")}đ`;

//       return {
//         id: d._id.toString(),
//         type: "discount",
//         code: d.code,
//         name: d.name,
//         description: d.description || "",
//         discount_text: discountText,
//         discount_type: d.discount.type,
//         discount_value: d.discount.value,
//         max_discount: d.discount.max_discount,
//         begin_date: d.begin_date,
//         end_date: d.end_date,
//         conditions: d.conditions || {},
//         priority: d.priority || 1
//       };
//     });

//     // Format voucher (lọc theo điều kiện customer)
//     const formattedVouchers = [];
//     for (const v of vouchers) {
//       const conditions = v.conditions || {};
//       const usedByUser = usageMap.get(String(v._id)) || 0;

//       // Kiểm tra per_user_limit
//       if (v.per_user_limit != null && usedByUser >= v.per_user_limit) continue;

//       // Kiểm tra đơn hàng đầu tiên
//       if (conditions.rule_type === "FIRST_ORDER" && customer?.total_completed_orders > 0) continue;

//       // Kiểm tra hạng thành viên
//       const allowedTypes = conditions.customer_tiers || [];
//       if (allowedTypes.length > 0 && !allowedTypes.includes(customerTier)) continue;

//       const discountText = v.discount.type === "PERCENT"
//         ? `Giảm ${v.discount.value}%${v.discount.max_discount ? ` (tối đa ${v.discount.max_discount.toLocaleString("vi-VN")}đ)` : ""}`
//         : `Giảm ${v.discount.value.toLocaleString("vi-VN")}đ`;

//       formattedVouchers.push({
//         id: v._id.toString(),
//         type: "voucher",
//         code: v.code,
//         name: v.name,
//         description: v.description || "",
//         discount_text: discountText,
//         discount_type: v.discount.type,
//         discount_value: v.discount.value,
//         max_discount: v.discount.max_discount,
//         begin_date: v.begin_date,
//         end_date: v.end_date,
//         conditions: v.conditions || {},
//         total_quantity: v.total_quantity,
//         used_quantity: v.used_quantity,
//         per_user_limit: v.per_user_limit,
//         applicable_model: v.applicable_model || []
//       });
//     }

//     // Gộp và sắp xếp: discount trước (priority cao), sau đó voucher
//     const allPromotions = [
//       ...formattedDiscounts.map(d => ({ ...d, sortKey: d.priority * 1000 })),
//       ...formattedVouchers.map(v => ({ ...v, sortKey: 0 }))
//     ].sort((a, b) => b.sortKey - a.sortKey).slice(0, 10);

//     return res.json({
//       success: true,
//       promotions: allPromotions
//     });

//   } catch (err) {
//     console.error("Error getting active promotions:", err);
//     return res.status(500).json({
//       success: false,
//       message: "SERVER ERROR: " + err.message
//     });
//   }
// };

// // Hàm lấy chi tiết discount hoặc voucher theo ID
// export const getPromotionDetail = async (req, res) => {
//   try {
//     const { id, type } = req.params; // type = "discount" hoặc "voucher"
//     const userId = req.userId;

//     if (type === "discount") {
//       const discount = await Discount.findById(id).select("-__v");
//       if (!discount) {
//         return res.status(404).json({
//           success: false,
//           message: "Không tìm thấy khuyến mãi"
//         });
//       }

//       // Lấy thông tin customer để kiểm tra điều kiện
//       const customer = await Customer.findOne({ user_id: userId }).select("type");
//       const customerTier = customer?.type?.toUpperCase() || "NEW";
//       const now = new Date();
//       const dayOfWeek = now.getDay();
//       const hour = now.getHours();

//       // Kiểm tra điều kiện
//       let isEligible = true;
//       const reasons = [];

//       if (discount.conditions?.customer_tiers && discount.conditions.customer_tiers.length > 0) {
//         if (!discount.conditions.customer_tiers.includes(customerTier)) {
//           isEligible = false;
//           reasons.push(`Chỉ áp dụng cho khách hàng hạng: ${discount.conditions.customer_tiers.join(", ")}`);
//         }
//       }

//       if (discount.conditions?.days_of_week && discount.conditions.days_of_week.length > 0) {
//         if (!discount.conditions.days_of_week.includes(dayOfWeek)) {
//           isEligible = false;
//           const dayNames = ["Chủ nhật", "Thứ 2", "Thứ 3", "Thứ 4", "Thứ 5", "Thứ 6", "Thứ 7"];
//           const validDays = discount.conditions.days_of_week.map(d => dayNames[d]).join(", ");
//           reasons.push(`Chỉ áp dụng vào: ${validDays}`);
//         }
//       }

//       if (discount.conditions?.hours_range) {
//         const { from, to } = discount.conditions.hours_range;
//         if (hour < from || hour > to) {
//           isEligible = false;
//           reasons.push(`Chỉ áp dụng trong khung giờ: ${from}:00 - ${to}:00`);
//         }
//       }

//       const discountText = discount.discount.type === "PERCENT"
//         ? `Giảm ${discount.discount.value}%${discount.discount.max_discount ? ` (tối đa ${discount.discount.max_discount.toLocaleString("vi-VN")}đ)` : ""}`
//         : `Giảm ${discount.discount.value.toLocaleString("vi-VN")}đ`;

//       return res.json({
//         success: true,
//         promotion: {
//           id: discount._id.toString(),
//           type: "discount",
//           code: discount.code,
//           name: discount.name,
//           description: discount.description || "",
//           discount_text: discountText,
//           discount_type: discount.discount.type,
//           discount_value: discount.discount.value,
//           max_discount: discount.discount.max_discount,
//           begin_date: discount.begin_date,
//           end_date: discount.end_date,
//           conditions: discount.conditions || {},
//           priority: discount.priority || 1,
//           is_active: discount.is_active,
//           status: discount.status,
//           is_eligible: isEligible,
//           eligibility_reasons: reasons
//         }
//       });
//     } else if (type === "voucher") {
//       const voucher = await Voucher.findById(id).select("-__v");
//       if (!voucher) {
//         return res.status(404).json({
//           success: false,
//           message: "Không tìm thấy voucher"
//         });
//       }

//       // Lấy thông tin customer
//       const customer = await Customer.findOne({ user_id: userId }).select("type total_completed_orders");
//       const customerTier = customer?.type?.toUpperCase() || "NEW";

//       // Lấy usage
//       const { VoucherUsage } = await import("../models/index.js");
//       const usage = await VoucherUsage.aggregate([
//         { $match: { user_id: userId, voucher_id: voucher._id } },
//         { $group: { _id: null, used_count: { $sum: "$used_count" } } }
//       ]);
//       const usedByUser = usage[0]?.used_count || 0;

//       // Kiểm tra điều kiện
//       let isEligible = true;
//       const reasons = [];
//       const conditions = voucher.conditions || {};

//       if (voucher.per_user_limit != null && usedByUser >= voucher.per_user_limit) {
//         isEligible = false;
//         reasons.push(`Bạn đã sử dụng hết lượt (${voucher.per_user_limit} lượt)`);
//       }

//       if (conditions.rule_type === "FIRST_ORDER" && customer?.total_completed_orders > 0) {
//         isEligible = false;
//         reasons.push("Chỉ áp dụng cho đơn hàng đầu tiên");
//       }

//       if (conditions.customer_tiers && conditions.customer_tiers.length > 0) {
//         if (!conditions.customer_tiers.includes(customerTier)) {
//           isEligible = false;
//           reasons.push(`Chỉ áp dụng cho khách hàng hạng: ${conditions.customer_tiers.join(", ")}`);
//         }
//       }

//       if (voucher.total_quantity != null && voucher.used_quantity >= voucher.total_quantity) {
//         isEligible = false;
//         reasons.push("Voucher đã hết lượt sử dụng");
//       }

//       const discountText = voucher.discount.type === "PERCENT"
//         ? `Giảm ${voucher.discount.value}%${voucher.discount.max_discount ? ` (tối đa ${voucher.discount.max_discount.toLocaleString("vi-VN")}đ)` : ""}`
//         : `Giảm ${voucher.discount.value.toLocaleString("vi-VN")}đ`;

//       return res.json({
//         success: true,
//         promotion: {
//           id: voucher._id.toString(),
//           type: "voucher",
//           code: voucher.code,
//           name: voucher.name,
//           description: voucher.description || "",
//           discount_text: discountText,
//           discount_type: voucher.discount.type,
//           discount_value: voucher.discount.value,
//           max_discount: voucher.discount.max_discount,
//           begin_date: voucher.begin_date,
//           end_date: voucher.end_date,
//           conditions: voucher.conditions || {},
//           total_quantity: voucher.total_quantity,
//           used_quantity: voucher.used_quantity,
//           remaining_quantity: voucher.total_quantity ? voucher.total_quantity - voucher.used_quantity : null,
//           per_user_limit: voucher.per_user_limit,
//           used_by_user: usedByUser,
//           remaining_for_user: voucher.per_user_limit ? voucher.per_user_limit - usedByUser : null,
//           applicable_model: voucher.applicable_model || [],
//           is_active: voucher.is_active,
//           status: voucher.status,
//           is_eligible: isEligible,
//           eligibility_reasons: reasons
//         }
//       });
//     } else {
//       return res.status(400).json({
//         success: false,
//         message: "Loại khuyến mãi không hợp lệ (phải là 'discount' hoặc 'voucher')"
//       });
//     }

//   } catch (err) {
//     console.error("Error getting promotion detail:", err);
//     return res.status(500).json({
//       success: false,
//       message: "SERVER ERROR: " + err.message
//     });
//   }
// };

// Hàm helper để map customer loyalty sang customer tier
const mapLoyaltyToTier = (loyalty, bookingCount) => {
  if (bookingCount === 0) return "NEW";
  if (loyalty === "platinum") return "VIP";
  if (["silver", "gold"].includes(loyalty)) return "LOYAL";
  return "NEW";
};

// Hàm kiểm tra discount có available cho booking không
const checkDiscountAvailability = async (discount, customerId, orderValue) => {
  const now = new Date();
  
  // 1. Kiểm tra is_active và thời gian
  if (!discount.is_active) return { available: false, reason: "Khuyến mãi chưa được kích hoạt" };
  if (now < discount.begin_date) return { available: false, reason: "Khuyến mãi chưa bắt đầu" };
  if (now > discount.end_date) return { available: false, reason: "Khuyến mãi đã kết thúc" };
  
  const conditions = discount.conditions || {};
  
  // 2. Kiểm tra rule_type
  if (conditions.rule_type === "FIRST_BOOKING") {
    const hasPreviousBooking = await Booking.exists({
      customer_id: customerId,
      status: { $in: ["confirmed", "in_progress", "completed"] }
    });
    if (hasPreviousBooking) {
      return { available: false, reason: "Chỉ áp dụng cho đơn hàng đầu tiên" };
    }
  }
  
  // 3. Kiểm tra min_order_value
  if (conditions.rule_type === "MIN_ORDER_VALUE" && conditions.min_order_value) {
    if (orderValue < conditions.min_order_value) {
      return { 
        available: false, 
        reason: `Đơn hàng tối thiểu ${conditions.min_order_value.toLocaleString("vi-VN")}đ` 
      };
    }
  }
  
  // 4. Kiểm tra customer_tiers
  if (conditions.customer_tiers && conditions.customer_tiers.length > 0) {
    const customer = await Customer.findById(customerId).select("loyalty booking_count");
    if (!customer) {
      return { available: false, reason: "Không tìm thấy thông tin khách hàng" };
    }
    
    const customerTier = mapLoyaltyToTier(customer.loyalty || "bronze", customer.booking_count || 0);
    if (!conditions.customer_tiers.includes(customerTier)) {
      const tierNames = { NEW: "Mới", LOYAL: "Thân thiết", VIP: "VIP" };
      const allowedTiers = conditions.customer_tiers.map(t => tierNames[t] || t).join(", ");
      return { 
        available: false, 
        reason: `Chỉ áp dụng cho khách hàng hạng: ${allowedTiers}` 
      };
    }
  }
  
  // 5. Kiểm tra days_of_week
  if (conditions.days_of_week && conditions.days_of_week.length > 0) {
    const dayOfWeek = now.getDay();
    if (!conditions.days_of_week.includes(dayOfWeek)) {
      const dayNames = ["Chủ nhật", "Thứ 2", "Thứ 3", "Thứ 4", "Thứ 5", "Thứ 6", "Thứ 7"];
      const validDays = conditions.days_of_week.map(d => dayNames[d]).join(", ");
      return { 
        available: false, 
        reason: `Chỉ áp dụng vào: ${validDays}` 
      };
    }
  }
  
  // 6. Kiểm tra hours_range
  if (conditions.hours_range) {
    const { from, to } = conditions.hours_range;
    const hour = now.getHours();
    if (hour < from || hour > to) {
      return { 
        available: false, 
        reason: `Chỉ áp dụng trong khung giờ: ${from}:00 - ${to}:00` 
      };
    }
  }
  
  // 7. Kiểm tra task_ids (nếu có, có thể bỏ qua hoặc check sau)
  // task_ids thường dùng cho SEASONAL, có thể check sau nếu cần
  
  return { available: true };
};

// Hàm lấy danh sách discount với đánh dấu available
export const getAvailableDiscounts = async (req, res) => {
  try {
    const { customer_id, order_value } = req.query;
    
    if (!customer_id) {
      return res.status(400).json({
        success: false,
        message: "Thiếu customer_id"
      });
    }
    
    const orderValue = order_value ? parseFloat(order_value) : 0;
    const now = new Date();
    
    // Lấy tất cả discount đang active (trong thời gian hiệu lực)
    const discounts = await Discount.find({
      is_active: true,
      begin_date: { $lte: now },
      end_date: { $gte: now }
    })
      .select("-__v")
      .sort({ priority: -1, created_at: -1 })
      .lean();
    
    // Kiểm tra từng discount và đánh dấu available
    const discountsWithAvailability = await Promise.all(
      discounts.map(async (discount) => {
        const availability = await checkDiscountAvailability(
          discount,
          customer_id,
          orderValue
        );
        
        // Tính toán discount amount để hiển thị
        let discountAmount = 0;
        let discountText = "";
        
        if (availability.available && orderValue > 0) {
          if (discount.discount.type === "PERCENT") {
            discountAmount = Math.round(orderValue * discount.discount.value / 100);
            if (discount.discount.max_discount && discountAmount > discount.discount.max_discount) {
              discountAmount = discount.discount.max_discount;
            }
            discountText = `Giảm ${discount.discount.value}%${discount.discount.max_discount ? ` (tối đa ${discount.discount.max_discount.toLocaleString("vi-VN")}đ)` : ""}`;
          } else {
            discountAmount = discount.discount.value;
            discountText = `Giảm ${discount.discount.value.toLocaleString("vi-VN")}đ`;
          }
        } else {
          if (discount.discount.type === "PERCENT") {
            discountText = `Giảm ${discount.discount.value}%${discount.discount.max_discount ? ` (tối đa ${discount.discount.max_discount.toLocaleString("vi-VN")}đ)` : ""}`;
          } else {
            discountText = `Giảm ${discount.discount.value.toLocaleString("vi-VN")}đ`;
          }
        }
        
        return {
          id: discount._id.toString(),
          code: discount.code,
          name: discount.name,
          description: discount.description || "",
          discount_type: discount.discount.type,
          discount_value: discount.discount.value,
          max_discount: discount.discount.max_discount,
          discount_text: discountText,
          discount_amount: discountAmount,
          priority: discount.priority || 1,
          begin_date: discount.begin_date,
          end_date: discount.end_date,
          conditions: discount.conditions || {},
          is_available: availability.available,
          availability_reason: availability.reason || null
        };
      })
    );
    
    return res.json({
      success: true,
      total: discountsWithAvailability.length,
      available_count: discountsWithAvailability.filter(d => d.is_available).length,
      discounts: discountsWithAvailability
    });
    
  } catch (err) {
    console.error("Error getting available discounts:", err);
    return res.status(500).json({
      success: false,
      message: "SERVER ERROR: " + err.message
    });
  }
};




