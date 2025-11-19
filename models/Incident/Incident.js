import mongoose from "mongoose";

const incidentSchema = new mongoose.Schema(
  {
    room_id: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Room",
      required: true,
    },

    caused_user: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      required: false,
    },

    description: {
      type: String,
      trim: true,
      required: true,
    },

    type: {
      type: String,
      enum: ["equipment", "technical"],
      required: true,
    },

    caused_by: {
      type: String,
      enum: ["employee", "customer", "other"],
      required: true,
    },

    severity: {
      type: String,
      enum: ["low", "medium", "high", "critical"],
      required: true,
    },

    status: {
      type: String,
      enum: ["reported", "in-progress", "resolved", "compensated"],
      default: "reported",
      required: true,
    },

    occured_at: {
      type: Date,
      required: true,
    },

    fixed_date: {
      type: Date,
      default: null,
    },

    finish_date: {
      type: Date,
      default: null,
    },
  },
  {
    timestamps: { createdAt: "created_at", updatedAt: "updated_at" },
  }
);

const Incident = mongoose.models.Incident || mongoose.model("Incident",incidentSchema);
export default Incident;
