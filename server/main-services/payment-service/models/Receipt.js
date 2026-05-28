import mongoose from "../../../shared/config/mongoose.js";

const receiptSchema = new mongoose.Schema(
    {
        // booking
        booking_id: {
            type: mongoose.Schema.Types.ObjectId,
            required: true,
        },

        transaction_id: {
            type: mongoose.Schema.Types.ObjectId,
            ref: "Transaction",
            default: null,
        },

        // discount
        discount_id: {
            type: mongoose.Schema.Types.ObjectId,
            default: null,
        },

        discount_snapshot: {
            code: String,
            name: String,
            description: String,
            discount_amount: Number,
        },

        // employee (null for customer self-bookings)
        employee_id: {
            type: mongoose.Schema.Types.ObjectId,
            default: null,
        },

        // service usage
        service_usage_id: {
            type: mongoose.Schema.Types.ObjectId,
            default: null,
        },

        // compensation ticket
        compensate_ticket_id: {
            type: mongoose.Schema.Types.ObjectId,
            default: null,
        },

        // Snapshot tiền
        base_room_fee: { type: Number, required: true },   // từ booking
        
        discount_amount: { type: Number, default: 0 },
        service_fee: { type: Number, default: 0 },
        compensate_fee: { type: Number, default: 0 },

        total_fee: { type: Number, required: true },       // từ booking (đã discount)
        deposit_amount: { type: Number, required: true }, // từ booking (đã discount)

        final_amount: { type: Number, required: true },    // tổng trước cọc
        amount_due: { type: Number, required: true },      // còn phải trả

        payment: {
            type: String,
            enum: ["cash", "bank", "unknown"],
            required: true,
        },

        status: {
            type: String,
            enum: ["pending", "paid", "half-paid", "refunded", "cancelled"],
            default: "pending",
        },

        paid_at: { type: Date, default: null },

        cancelled_at: { type: Date, default: null },

        note: { type: String, default: "" },

    },
    {
        timestamps: { createdAt: "created_at", updatedAt: "updated_at" },
    }
);

const Receipt = mongoose.models.Receipt || mongoose.model("Receipt", receiptSchema);
export default Receipt;
    