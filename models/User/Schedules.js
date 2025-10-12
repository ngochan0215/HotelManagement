import mongoose from "mongoose";

const scheduleSchema = new mongoose.Schema(
    {
        employee_id: { type: mongoose.Schema.Types.ObjectId, ref: "Employee", required: true },
        shift_id: { type: mongoose.Schema.Types.ObjectId, ref: "Shift", required: true },
    }
);

const Schedule = mongoose.models.Schedule || mongoose.model("Schedule", scheduleSchema);
export default Schedule;
