import mongoose from "../../../shared/config/mongoose.js";

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

        shift_id: {
            type: mongoose.Schema.Types.ObjectId,
            ref: "Shift",
            required: true,
        },

        work_date: {
            type: Date,
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
            enum: ["present", "late", "absent", "on_leave", "early_leave"],
            required: true,
            default: "absent",
        },

        late_minutes: { type: Number, default: 0 },

        early_leave_minutes: { type: Number, default: 0 },

        work_hours: { type: Number, default: 0 },

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

attendanceSchema.index(
  { employee_id: 1, schedule_id: 1 },
  { unique: true }
);
attendanceSchema.index({ employee_id: 1, work_date: 1 });
attendanceSchema.index({ work_date: 1 });

const Attendance = mongoose.models.Attendance || mongoose.model("Attendance", attendanceSchema);
export default Attendance;
