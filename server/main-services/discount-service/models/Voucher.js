import mongoose from "../../../shared/config/mongoose.js";

// Voucher: customer enters code manually, usage is tracked
const voucherSchema = new mongoose.Schema(
    {
        code: { type: String, required: true, unique: true, uppercase: true },
        
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
            },

            customer_tiers: [{
                type: String,
                enum: ["NEW", "LOYAL", "VIP"]
            }]
        },

        // usage tracking
        max_uses: { type: Number, required: true },

        used_count: { type: Number, default: 0 },

        // confirmed but not yet completed
        pending_use: [{
            customer_id: { type: mongoose.Schema.Types.ObjectId, required: true },
            booking_id:  { type: mongoose.Schema.Types.ObjectId, required: true },
            locked_at:   { type: Date, default: Date.now }
        }],

        // completed bookings only
        used_by: [{
            customer_id: { type: mongoose.Schema.Types.ObjectId, required: true },
            booking_id:  { type: mongoose.Schema.Types.ObjectId, required: true },
            used_at:     { type: Date, default: Date.now }
        }],

        begin_date: { type: Date, required: true },
        
        end_date:   { type: Date, required: true },

        priority: { type: Number, default: 1 },

        is_active: { type: Boolean, default: false },
        
        status: {
            type: String,
            enum: ["upcoming", "ongoing", "finished", "exhausted"],
            default: "upcoming"
        }
    },
    {
        timestamps: { createdAt: "created_at", updatedAt: "updated_at" }
    }
);

voucherSchema.index({ code: 1 });
voucherSchema.index({ status: 1, is_active: 1 });
voucherSchema.index({ begin_date: 1, end_date: 1 });
voucherSchema.index({ priority: -1 });
voucherSchema.index({ "used_by.customer_id": 1 });
voucherSchema.index({ "pending_use.customer_id": 1 });

const Voucher = mongoose.models.Voucher || mongoose.model("Voucher", voucherSchema);
export default Voucher;