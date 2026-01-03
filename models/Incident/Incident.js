import mongoose from "mongoose";

const incidentSchema = new mongoose.Schema(
  {
    room_id: { type: mongoose.Schema.Types.ObjectId, ref: "Room", default: null },
    reporter_id: { type: mongoose.Schema.Types.ObjectId, ref: "User", required: true },
    causer_id: { type: mongoose.Schema.Types.ObjectId, ref: "User", default: null },
    booking_id: { type: mongoose.Schema.Types.ObjectId, ref: "Booking", default: null },

    description: { type: String, trim: true, required: true },
    type: { type: String, enum: ["equipment", "technical", "facility", "service", "safety", "other"], required: true },
    caused_by: { type: String, enum: ["employee", "customer", "other"], required: true },

    severity: { type: String, enum: ["low", "medium", "high", "critical"], required: true },
    status: { type: String, enum: ["new", "in_progress", "resolved", "closed"], default: "new", required: true },
    compensation_status: { type: String, enum: ["none", "pending", "done"], default: "none", required: true },

    occured_at: { type: Date, required: true },
    resolved_at: { type: Date, default: null },
    closed_at: { type: Date, default: null },

    assignee_info: {
      assignee_id: { type: mongoose.Schema.Types.ObjectId, ref: "Employee", default: null },
      assignee_name: { type: String, trim: true },    
      assignee_department: { type: String, trim: true },
      assigned_at: { type: Date, default: null },      // thời điểm nhận xử lý
    }
  },
  {
    timestamps: { createdAt: "created_at", updatedAt: "updated_at" },
  }
);

const Incident = mongoose.models.Incident || mongoose.model("Incident",incidentSchema);
export default Incident;
