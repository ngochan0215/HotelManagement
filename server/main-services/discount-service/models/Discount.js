import mongoose from "../../../shared/config/mongoose.js";

// Discount: system auto-applies, no code required
const discountSchema = new mongoose.Schema(
  {
    name: { type: String, required: true, unique: true },
    
    description: { type: String },

    discount: {
      type: {
        type: String,
        enum: ["PERCENT", "FIXED"],
        required: true
      },

      value: { type: Number, required: true },
      
      max_discount: Number
    },

    conditions: {
      rule_type: {
        type: String,
        enum: ["NONE", "MIN_BOOKING_VALUE", "FIRST_BOOKING", "SEASONAL", "HOLIDAY"],
        default: "NONE"
      },

      min_order_value: { type: Number, default: 0 },

      room_category_ids: [{ type: mongoose.Schema.Types.ObjectId }],

      service_category_ids: [{ type: mongoose.Schema.Types.ObjectId }],

      days_of_week: [{ type: Number, min: 0, max: 6 }],

      hours_range: {
        from: { type: Number, min: 0, max: 23 },
        to:   { type: Number, min: 0, max: 23 }
      }
    },

    begin_date: { type: Date, required: true },
    
    end_date:   { type: Date, required: true },

    priority: { type: Number, default: 1 }, // higher = picked first

    is_active: { type: Boolean, default: false },
    
    status: {
      type: String,
      enum: ["upcoming", "ongoing", "finished"],
      default: "upcoming"
    }
  },
  {
    timestamps: { createdAt: "created_at", updatedAt: "updated_at" }
  }
);

discountSchema.index({ status: 1, is_active: 1 });
discountSchema.index({ begin_date: 1, end_date: 1 });
discountSchema.index({ priority: -1 });

const Discount = mongoose.models.Discount || mongoose.model("Discount", discountSchema);
export default Discount;