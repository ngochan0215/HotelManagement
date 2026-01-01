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

    discounts: [
      {
        discount_id: {
          type: mongoose.Schema.Types.ObjectId,
          ref: "Discount",
        },
        name: String,
        percentage: Number,
        applied_amount: Number,
      }
    ],

    compensate_id: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "CompensateTicket",
      default: null,
    },

    total_room_fee: { type: Number, required: true },
    service_fee: { type: Number, default: 0 },
    compensate_fee: { type: Number, default: 0 },
    total_amount: { type: Number, required: true },
    deposit_amount: { type: Number, required: true },
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
