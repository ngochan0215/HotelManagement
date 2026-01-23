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
    total_fee: { type: Number, required: true },       // từ booking (đã discount)
    service_fee: { type: Number, default: 0 },
    compensate_fee: { type: Number, default: 0 },
    deposit_amount: { type: Number, required: true }, // từ booking (đã discount)

    final_amount: { type: Number, required: true },    // tổng trước cọc
    amount_due: { type: Number, required: true },      // còn phải trả

    payment: {
      type: String,
      enum: ["cash", "card", "bank", "e-wallet", "unknown"],
      required: true,
    },

    status: {
      type: String,
      enum: ["pending", "paid", "half-paid", "refunded"],
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
