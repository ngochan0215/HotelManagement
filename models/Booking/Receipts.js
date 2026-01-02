import mongoose from "mongoose";

const receiptSchema = new mongoose.Schema(
  {
    booking_id: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Booking",
      required: true,
    },

    employee_id: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Employee",
      required: true,
    },

    compensate_ticket_id: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "CompensateTicket",
      default: null,
    },

    service_usage_id: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "ServiceUsage",
      default: null,
    },

    total_fee: { type: Number, required: true },      // total_fee from booking (applied discount already)
    service_fee: { type: Number, default: 0 },        // total_fee from service usage ticket
    compensate_fee: { type: Number, default: 0 },     // total_fee from compensate ticket
    deposit_amount: { type: Number, required: true }, // depost from booking (applied discount already)
    
    final_amount: { type: Number, default: 0, required: true },
    amount_due: { type: Number, default: 0 },

    payment: {
      type: String,
      enum: ["cash", "card", "bank", "e-wallet"],
      required: true,
    },

    status: {
      type: String,
      enum: ["pending", "paid", "refunded"],
      default: "pending",
    },

    paid_at: { 
      type: Date, 
      default: null 
    },

    note: { 
      type: String, 
      default: "" 
    },
  },

  {
    timestamps: { createdAt: "created_at", updatedAt: "updated_at" },
  }
);

const Receipt = mongoose.models.Receipt || mongoose.model("Receipt", receiptSchema);
export default Receipt;
