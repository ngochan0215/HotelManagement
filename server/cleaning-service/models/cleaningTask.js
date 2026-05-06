import mongoose from "../../shared/config/mongoose.js";

const cleaningTaskSchema = new mongoose.Schema(
  {
    room_id: { type: mongoose.Schema.Types.ObjectId, required: true },
    room_log_id: { type: mongoose.Schema.Types.ObjectId, required: true },
    booking_id: { type: mongoose.Schema.Types.ObjectId, default: null },
    handled_by: { type: mongoose.Schema.Types.ObjectId, default: null },
    status: {
      type: String,
      enum: ["pending", "in_progress", "completed", "confirmed"],
      default: "pending",
    },
    started_at: { type: Date, default: null },
    completed_at: { type: Date, default: null },
    confirmed_at: { type: Date, default: null },
    note: { type: String, default: "" },
  },
  { timestamps: { createdAt: "created_at", updatedAt: "updated_at" } }
);

const CleaningTask = mongoose.models.CleaningTask || mongoose.model("CleaningTask", cleaningTaskSchema);
export default CleaningTask;