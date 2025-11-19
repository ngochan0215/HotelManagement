import mongoose from "mongoose";

const compensateTicketSchema = new mongoose.Schema(
  {
    incident_id: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Incident",
      required: true,
    },

    booking_id: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Booking",
      default: null,
    },

    total_fee: {
      type: Number,
      required: true,
      default: 0,
    },

    status: {
      type: String,
      enum: ["pending", "approved", "paid", "cancelled"],
      default: "pending",
    },

    note: {
      type: String,
      trim: true,
      default: "",
    },
  },
  {
    timestamps: { createdAt: "created_at", updatedAt: false },
  }
);

const CompensateTicket = mongoose.models.CompensateTicket || mongoose.model("compensateDetail", compensateDetailSchema);
export default CompensateTicket;
