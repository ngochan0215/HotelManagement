import mongoose from "mongoose";

const checkinOutSchema = new mongoose.Schema(
  {
    booking_detail_id: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "BookingDetail",
      required: true,
    },
    employee_id: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Employee",
      required: true,
    },

    action: {
      type: String,
      enum: ["checkin", "checkout"],
      required: true,
    },

    action_time: {
      type: Date,
      required: true,
      default: Date.now,
    },
    
    note: { type: String, default: "" },
  },
  {
    timestamps: { createdAt: "created_at", updatedAt: "updated_at" },
  }
);

const CheckInOut = mongoose.models.CheckInOut || mongoose.model("CheckinOut", checkinOutSchema);
export default CheckInOut;
