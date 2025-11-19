import mongoose from "mongoose";

const attendanceSchema = new mongoose.Schema(
  {
    employee_id: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Employee",
      required: true,
    },

    schedule_id: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Schedule",
      required: true,
    },

    check_in: {
      type: Date,
      default: null,
    },

    check_out: {
      type: Date,
      default: null,
    },

    status: {
      type: String,
      enum: ["present", "late", "absent", "on_leave"],
      required: true,
      default: "absent",
    },

    note: {
      type: String,
      trim: true,
      default: "",
    },
  },
  {
    timestamps: { createdAt: "created_at", updatedAt: "updated_at" },
  }
);

// Một employee trong một schedule chỉ được ghi attendance 1 lần
attendanceSchema.index(
  { employee_id: 1, schedule_id: 1 },
  { unique: true }
);

const Attendance = mongoose.models.Attendance || mongoose.model("Attendance", attendanceSchema);
export default Attendance;
