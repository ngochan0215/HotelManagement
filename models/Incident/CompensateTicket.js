import mongoose from "mongoose";

// phiếu đền bù
const compensateTicketSchema = new mongoose.Schema(
  {
    incident_id: { type: mongoose.Schema.Types.ObjectId, ref: "Incident", unique: true, required: true },

    payer_type: { type: String, enum: ["customer", "employee", "hotel"], default: "hotel", required: true },

    payer_id: { type: mongoose.Schema.Types.ObjectId, ref: "User", default: null },

    compensation_details: [
      {
        equipment_id: { type: mongoose.Schema.Types.ObjectId, ref: "Equipment", default: null },

        broken_state: { type: String, 
          enum: ["scratched", "cracked", "broken", "lost", "unusable"], 
          required: true, default: "scratched"
        },

        resolution: { type: String, enum: ["repair", "discard"], required: true },
    
        penalty_fee: { type: Number, required: true, default: 0 },
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

const CompensateTicket = mongoose.models.CompensateTicket || mongoose.model("compensateTicket", compensateTicketSchema);
export default CompensateTicket;
