import mongoose from "mongoose";

const bookingSchema = new mongoose.Schema(
  {
    customer_id: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Customer",
      required: true,
    },

    employee_id: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Employee",
      default: null
    },

    status: {
      type: String,
      enum: [
        "pending",
        "confirmed",
        "checked_in",
        "checked_out",
        "cancelled",
        "expired",
      ],
      default: "pending",
    },

    checkin_expected: { type: Date, required: true },
    checkout_expected: { type: Date, required: true },

    adults: { type: Number, required: true, min: 1 },
    children: { type: Number, required: true, min: 0 },

    deposit: { type: Number, default: 0 },
  },
  {
    timestamps: { createdAt: "created_at", updatedAt: "updated_at" },
  }
);

const Booking = mongoose.models.Booking || mongoose.model("Booking", bookingSchema);
export default Booking;
