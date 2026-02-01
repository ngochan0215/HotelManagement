import mongoose from "mongoose";

const incidentLogSchema = new mongoose.Schema(
  {
    incident_id: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Incident",
      required: true,
    },

    action: {
      type: String,
      enum: [
        "created",
        "assigned",
        "severity_changed",
        "updated",
        "resolved",
        "closed",
        "reopened",
        "compensation_updated",
        "compensation_paid_closed"
      ],
      required: true,
    },

    from_status: { type: String, default: null },
    to_status: { type: String, default: null },

    actor_id: { type: mongoose.Schema.Types.ObjectId, ref: "Employee", required: true },
    actor_name: { type: String, trim: true },   
    actor_role: { type: String, trim: true },

    note: { type: String, trim: true },
    created_at: { type: Date, default: Date.now },
  }
);

const IncidentLog = mongoose.models.IncidentLog || mongoose.model("IncidentLog", incidentLogSchema);
export default IncidentLog;