import mongoose from "mongoose";

const cleaningTaskSchema = new mongoose.Schema(
  {
    room_id: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Room",
      required: true,
    },
    
    room_log_id: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "RoomLog",
      required: true,
    },
    
    booking_id: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Booking",
      default: null,
    },
    
    handled_by: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Employee",
      default: null,
    },
    
    status: {
      type: String,
      enum: ["pending", "in_progress", "completed", "confirmed"],
      default: "pending",
    },
    
    started_at: {
      type: Date,
      default: null,
    },
    
    completed_at: {
      type: Date,
      default: null,
    },
    
    confirmed_at: {
      type: Date,
      default: null,
    },
    
    note: {
      type: String,
      default: "",
    },
  },
  {
    timestamps: { createdAt: "created_at", updatedAt: "updated_at" },
  }
);

cleaningTaskSchema.index({ room_id: 1 });
cleaningTaskSchema.index({ handled_by: 1 });
cleaningTaskSchema.index({ status: 1 });
cleaningTaskSchema.index({ room_log_id: 1 }, { unique: true });

const CleaningTask = mongoose.models.CleaningTask || mongoose.model("CleaningTask", cleaningTaskSchema);
export default CleaningTask;
