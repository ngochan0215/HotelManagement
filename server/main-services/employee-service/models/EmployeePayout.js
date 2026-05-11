import mongoose from "../../../shared/config/mongoose.js";

const payoutEmployeeSchema = new mongoose.Schema(
    {
        employee_id: {
            type: mongoose.Schema.Types.ObjectId,
            ref: "Employee",
            required: true
        },

        earning_ids: [{
            type: mongoose.Schema.Types.ObjectId,
            ref: "EmployeeEarning"
        }],

        total_amount: {
            type: Number,
            required: true
        },

        period_start: {
            type: Date,
            required: true
        },

        period_end: {
            type: Date,
            required: true
        },

        status: {
            type: String,
            enum: ["pending", "processing", "completed", "failed"],
            default: "pending"
        },

        processed_at: {
            type: Date
        },
    }, 
    {
        timestamps: { createdAt: "created_at", updatedAt: "updated_at" }
    }
);

export const EmployeePayout = mongoose.models.EmployeePayout || mongoose.model("EmployeePayout", payoutEmployeeSchema);
export default EmployeePayout;