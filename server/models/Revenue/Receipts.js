import mongoose from "mongoose";

const receiptSchema = new mongoose.Schema(
  {
    booking_id: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Booking",
      required: true,
    },

    discount_id: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Discount",
      default: null,
    },
    discount_snapshot: {
      code: String,
      name: String,
      description: String,
      discount_amount: Number,
    },

    employee_id: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Employee",
      required: true,
    },

    service_usage_id: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "ServiceUsage",
      default: null,
    },

    compensate_ticket_id: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "CompensateTicket",
      default: null,
    },

    // Snapshot tiền
    base_room_fee: { type: Number, required: true },   // từ booking
    total_fee: { type: Number, required: true },       // từ booking (đã discount)
    service_fee: { type: Number, default: 0 },
    compensate_fee: { type: Number, default: 0 },
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
    
    // Link với Transaction (PayOS)
    transaction_id: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Transaction",
      default: null,
    },
  },
  {
    timestamps: { createdAt: "created_at", updatedAt: "updated_at" },
  }
);

const Receipt = mongoose.models.Receipt || mongoose.model("Receipt", receiptSchema);
export default Receipt;
