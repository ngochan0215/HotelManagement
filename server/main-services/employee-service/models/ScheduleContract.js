import mongoose from "../../../shared/config/mongoose.js";

const scheduleContractSchema = new mongoose.Schema(
    {
        employee_id: {
            type: mongoose.Schema.Types.ObjectId,
            ref: "Employee",
            required: true
        },

        recurring_shifts: [
            {
                shift_id: { type: mongoose.Schema.Types.ObjectId, ref: "Shift", required: true },
                work_day: {
                    type: String,
                    enum: ["monday","tuesday","wednesday","thursday","friday","saturday","sunday"],
                    required: true
                },
            }
        ],

        role: {
            type: String,
            enum: ["manager","receptionist","technician","customer_service","housekeeper","accountant","it"],
            required: true
        },

        valid_from: { type: Date, required: true },

        valid_to:   { type: Date, required: true },

        status: {
            type: String,
            enum: [
                "pending", "active", "paused", "expired", "cancelled",
            ],
            default: "pending",
        },

        last_generated_week: { type: Date, default: null },

        note: { type: String, default: "" },
    },
    {
        timestamps: { createdAt: "created_at", updatedAt: "updated_at" },
    }
);

const ScheduleContract = mongoose.models.ScheduleContract || mongoose.model("ScheduleContract", scheduleContractSchema);
export default ScheduleContract;