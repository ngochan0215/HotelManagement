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

    total_fee: {
      type: Number, 
      required: true,
      default: 0,
    },
  },
  {
    timestamps: { createdAt: "created_at", updatedAt: "updated_at" },
  }
);

const ServiceUsage = mongoose.models.ServiceUsage || mongoose.model("ServiceUsage", serviceUsageSchema);
export default ServiceUsage;
