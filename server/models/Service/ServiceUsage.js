import mongoose from "mongoose";

const serviceUsageSchema = new mongoose.Schema(
  {
    customer_id: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Customer",
      required: true,
    },

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

    total_fee: {
      type: Number, 
      required: true,
      default: 0,
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
