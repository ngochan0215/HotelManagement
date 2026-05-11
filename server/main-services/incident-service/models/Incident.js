import mongoose from "../../../shared/config/mongoose.js";

const incidentSchema = new mongoose.Schema(
  {
    room_id: { type: mongoose.Schema.Types.ObjectId, default: null },

    // user
    reporter_id: { type: mongoose.Schema.Types.ObjectId, required: true },

    // user
    causer_id: { type: mongoose.Schema.Types.ObjectId, default: null },

    booking_id: { type: mongoose.Schema.Types.ObjectId, default: null },

    equipment_ids: [{ type: mongoose.Schema.Types.ObjectId, default: null }],

    description: { type: String, trim: true, required: true },

    type: { 
        type: String, 
        enum: ["equipment", "technical", "facility", "service", "safety", "other"], 
        required: true 
    },
    
    caused_by: { type: String, enum: ["employee", "customer", "other"], required: true },

    severity: { type: String, enum: ["low", "medium", "high", "critical"], required: true },

    status: { 
        type: String, 
        enum: ["new", "in_progress", "resolved", "closed"], 
        default: "new", 
        required: true 
    },
    
    compensation_status: { 
        type: String, 
        enum: ["none", "pending", "done"], 
        default: "none", 
        required: true 
    },

    occured_at: { type: Date, required: true },

    resolved_at: { type: Date, default: null },

    closed_at: { type: Date, default: null },

    assignee_info: {
      // employee
      assignee_id: { type: mongoose.Schema.Types.ObjectId, default: null },
      assignee_name: { type: String, trim: true },    
      assignee_department: { type: String, trim: true },
      assigned_at: { type: Date, default: null },  
    },

    processing_note: { type: String, trim: true, default: "" },

  },
  {
    timestamps: { createdAt: "created_at", updatedAt: "updated_at" },
  }
);

const Incident = mongoose.models.Incident || mongoose.model("Incident",incidentSchema);
export default Incident;
