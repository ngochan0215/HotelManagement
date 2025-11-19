import mongoose from "mongoose";

const checkinOutSchema = new mongoose.Schema(
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

    actual_checkin: { type: Date, required: true },
    actual_checkout: { type: Date, required: true },
    note: { type: String, default: "" },
  },
  {
    timestamps: { createdAt: "created_at", updatedAt: "updated_at" },
  }
);

const CheckInOut = mongoose.models.CheckInOut || mongoose.model("CheckinOut", checkinOutSchema);
export default CheckInOut;
