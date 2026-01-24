import mongoose from "mongoose";

// discount: áp dụng cho toàn hệ thống, system tự apply
const discountSchema = new mongoose.Schema(
  {
    code: { type: String, required: true, unique: true, uppercase: true },
    name: { type: String, required: true },
    description: { type: String },

    discount: {
      type: {
        type: String,
        enum: ["PERCENT", "FIXED"],
        required: true
      },
      value: {
        type: Number,
        required: true
      },
      max_discount: Number
    },

    conditions: {
        rule_type: {
            type: String,
            enum: ["NONE", "MIN_BOOKING_VALUE", "FIRST_BOOKING", "SEASONAL", "HOLIDAY"],
            default: "NONE"
        },
        min_order_value: Number,
        room_category_ids: [ { type: mongoose.Schema.Types.ObjectId, ref: "RoomCategory" } ],
        days_of_week: [Number], // 0-6
        hours_range: {
            from: Number, // 0-23
            to: Number
        },
        customer_tiers: [String],
    },

    begin_date: Date,
    end_date: Date,

    priority: {
      type: Number,
      default: 1 // số càng cao càng ưu tiên
    },

    is_active: {
      type: Boolean,
      default: true
    },

    status: { type: String, enum: ["upcoming", "ongoing", "finished"], default: "upcoming" }
  }, 
  { 
    timestamps: { createdAt: "created_at", updatedAt: "updated_at" }
  }
);

discountSchema.index({ begin_date: 1, end_date: 1 });
discountSchema.index({ code: 1, name: 1 });

const Discount = mongoose.models.Discount || mongoose.model("Discount", discountSchema);
export default Discount;
