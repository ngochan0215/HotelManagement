import mongoose from "mongoose";

// chi tiết phiếu đền bù thiết bị
const compensateDetailSchema = new mongoose.Schema(
  {
    ticket_id: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "CompensateTicket",
      required: true,
    },

    // equipment
    equipment_id: {
      type: mongoose.Schema.Types.ObjectId,
      default: null,
    },

    broken_state: {
      type: String,
      enum: ["scratched", "cracked", "broken", "lost", "unusable"],
      required: true
    },

    resolution: {
      type: String,
      enum: ["repair", "discard"],
      required: true
    },

    penalty_fee: {
      type: Number,
      required: true,
      default: 0,
    },
  },
  {
    timestamps: { createdAt: "created_at", updatedAt: false },
  }
);

const CompensateDetail = mongoose.models.CompensateDetail || mongoose.model("CompensateDetail", compensateDetailSchema);
export default CompensateDetail;
