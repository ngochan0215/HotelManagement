import mongoose from "../../../shared/config/mongoose.js";

const pointsLogSchema = new mongoose.Schema(
  {
    customer_id: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Customer",
      required: true,
    },

    booking_id: {
      type: mongoose.Schema.Types.ObjectId,
      default: null,
    },

    points_change: {
      type: Number,
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
      default: null,
    },
  },
  {
    timestamps: { createdAt: "created_at", updatedAt: "updated_at" },
  }
);

const PointsLog = mongoose.models.PointsLog || mongoose.model("PointsLog", pointsLogSchema);
export default PointsLog;