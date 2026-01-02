import mongoose from "mongoose";

const usageDetailSchema = new mongoose.Schema(
  {
    ticket_id: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "ServiceUsage",
      required: true,
    },

    confirmed_by: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Employee",
      default: null,
    },

    confirmed_at: {
      type: Date,
      default: null,
    },

    cancelled_at: {
      type: Date,
      default: null,
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
      default: null,
      required: false,
    },

    finish_at: {
      type: Date,
      required: false,
      default: null,
    },

    current_price: { type: Number, required: true },
    unit: { type: String, enum: ["unit", "hour", "day"], default: "unit" },

    total_fee: {
      type: Number,
      required: true,
      default: 0,
    },

    status: {
      type: String,
      enum: ["cancelled", "waiting_confirm", "completed", "pending"],
      default: "pending",
    },
  },
  {
    timestamps: { createdAt: "created_at", updatedAt: "updated_at" },
  }
);

usageDetailSchema.index({ status: 1, use_from: 1 });

const UsageDetail = mongoose.models.UsageDetail || mongoose.model("UsageDetail", usageDetailSchema);
export default UsageDetail;
