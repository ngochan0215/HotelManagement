import mongoose from "../../../shared/config/mongoose.js";

// phiếu đền bù
const compensateTicketSchema = new mongoose.Schema(
  {
    incident_id: { type: mongoose.Schema.Types.ObjectId, ref: "Incident", unique: true, required: true },
    
    booking_id: { type: mongoose.Schema.Types.ObjectId, default: null },

    payer_type: { type: String, enum: ["customer", "employee", "hotel"], default: "hotel", required: true },

    // user
    payer_id: { type: mongoose.Schema.Types.ObjectId, default: null },

    compensation_details: [
      {
        // equipment
        equipment_id: { type: mongoose.Schema.Types.ObjectId, default: null },

        broken_state: { type: String, 
          enum: ["scratched", "cracked", "broken", "lost", "unusable"], 
          default: "scratched"
        },

        resolution: { type: String, enum: ["repair", "discard"], default: "repair" },
    
        penalty_fee: { type: Number, default: 0 },
      }
    ],

    total_fee: { type: Number, default: 0 },

    status: { type: String, enum: ["pending", "paid", "cancelled"], default: "pending" },

    note: { type: String, trim: true, default: "" },

    paid_at: { type: Date, default: null }
  },
  {
    timestamps: { createdAt: "created_at", updatedAt: false },
  }
);

const CompensateTicket = mongoose.models.CompensateTicket || mongoose.model("CompensateTicket", compensateTicketSchema);
export default CompensateTicket;
