import mongoose from "mongoose";

const scheduleSchema = new mongoose.Schema(
    {
        employee_id: { type: mongoose.Schema.Types.ObjectId, ref: "Employee", required: true },
        shift_id: { type: mongoose.Schema.Types.ObjectId, ref: "Shift", required: true },
    },
    {
        timestamps: { createdAt: "created_at", updatedAt: "updated_at" },
    }
);

const Schedule = mongoose.models.Schedule || mongoose.model("Schedule", scheduleSchema);
export default Schedule;
