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

    status : { type: String, enum: ["pending", "confirmed", "completed", "cancelled"], default: "pending" },
  },
  {
    timestamps: { createdAt: "created_at", updatedAt: "updated_at" },
  }
);

const ServiceUsage = mongoose.models.ServiceUsage || mongoose.model("ServiceUsage", serviceUsageSchema);
export default ServiceUsage;
