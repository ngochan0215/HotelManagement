import mongoose from "../../../shared/config/mongoose.js";

const serviceUsageSchema = new mongoose.Schema(
  {
    // customer
    customer_id: {
      type: mongoose.Schema.Types.ObjectId,
      required: true,
    },

    // booking
    booking_id: {
      type: mongoose.Schema.Types.ObjectId,
      required: true,
    },

    // employee (null when auto-created from customer pre-order after deposit)
    employee_id: {
      type: mongoose.Schema.Types.ObjectId,
      default: null,
    },

    total_fee: {
      type: Number,
      required: true,
      default: 0,
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

    status : { type: String, enum: ["pending", "waiting_confirm", "completed", "cancelled"], default: "pending" },
  },
  {
    timestamps: { createdAt: "created_at", updatedAt: "updated_at" },
  }
);

serviceUsageSchema.index({ booking_id: 1 });
serviceUsageSchema.index({ customer_id: 1 });
serviceUsageSchema.index({ employee_id: 1 });
serviceUsageSchema.index({ status: 1 });

const ServiceUsage = mongoose.models.ServiceUsage || mongoose.model("ServiceUsage", serviceUsageSchema);
export default ServiceUsage;
