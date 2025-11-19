import mongoose from "mongoose";

const usageDetailSchema = new mongoose.Schema(
  {
    ticket_id: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "ServiceUsage",
      required: true,
    },

    service_id: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Service",
      required: true,
    },

    quantity: {
      type: Number,
      required: true,
      min: 1,
    },

    use_from: {
      type: Date,
      required: true,
    },

    finish_at: {
      type: Date,
      required: false,
      default: null,
    },

    total_fee: {
      type: Number,
      required: true,
      default: 0,
    },

    status: {
      type: String,
      enum: ["cancelled", "done", "pending"],
      default: "pending",
    },
  },
  {
    timestamps: { createdAt: "created_at", updatedAt: "updated_at" },
  }
);

const UsageDetail = mongoose.models.UsageDetail || mongoose.model("UsageDetail", usageDetailSchema);
export default UsageDetail;
