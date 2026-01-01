import mongoose from "mongoose";

// phiếu đền bù
const compensateTicketSchema = new mongoose.Schema(
  {
    incident_id: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Incident",
      unique: true, 
      required: true,
    },

    booking_id: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Booking",
      default: null,
    },

    payer_type: {
      type: String,
      enum: ["customer", "employee", "hotel"],
      required: true
    },
    payer_id: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      default: null
    },

    total_fee: {
      type: Number,
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

const CompensateTicket = mongoose.models.CompensateTicket || mongoose.model("compensateTicket", compensateTicketSchema);
export default CompensateTicket;
