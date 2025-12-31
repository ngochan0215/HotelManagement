import mongoose from "mongoose";

// chi tiết phiếu đền bù thiết bị
import mongoose from "mongoose";

const compensateDetailSchema = new mongoose.Schema(
  {
    ticket_id: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "CompensateTicket",
      required: true,
    },

    equipment_id: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Equipment",
      default: null,
    },

    broken_state: {
      type: String,
      trim: true,
      required: true,
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


const CompensateDetail = mongoose.models.compensateDetail || mongoose.model("CompensateDetail", compensateDetailSchema);
export default CompensateDetail;
