import mongoose from "mongoose";

const pointsLogSchema = new mongoose.Schema(
  {
    customer_id: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Customer",
      required: true,
    },

    booking_id: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Booking",
      default: null,
    },

    points_change: {
      type: Number, // + hoặc -
      required: true,
    },

    points_before: {
      type: Number,
      required: true,
    },

    points_after: {
      type: Number,
      required: true,
    },

    reason: {
      type: String,
      required: true,
    },

    note: {
      type: String,
      default: "",
    },

    handled_by: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Employee",
      default: null,
    },
  },
  {
    timestamps: { createdAt: "created_at" },
  }
);

const PointsLog = mongoose.models.PointsLog || mongoose.model("PointsLog", pointsLogSchema);
export default PointsLog;