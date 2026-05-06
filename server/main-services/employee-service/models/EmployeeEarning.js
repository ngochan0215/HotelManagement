import mongoose from "../../../shared/config/mongoose.js";

const employeeEarningSchema = new mongoose.Schema(
    {
        employee_id: {
            type: mongoose.Schema.Types.ObjectId,
            ref: "Employee",
            required: true
        },
        
        attendance_id: {
            type: mongoose.Schema.Types.ObjectId,
            ref: "Attendance",
            required: true
        },

        shift_id: {
            type: mongoose.Schema.Types.ObjectId,
            ref: "Shift",
            required: true
        },

        payout_id: {
            type: mongoose.Schema.Types.ObjectId,
            ref: "EmployeePayout",
            default: null
        },
        
        // calculate salary 
        work_hours: { type: Number, required: true, min: 0 },

        hourly_rate: { type: Number, required: true, min: 0 },

        earning_amount: { type: Number, required: true, min: 0 },
        
        deductions: {
            late_penalty: { type: Number, default: 0 },
            early_leave_penalty: { type: Number, default: 0 },
            total: { type: Number, default: 0 },
        },

        status: {
            type: String,
            enum: ["available", "pending", "paid"],
            default: "available"
        },

        work_date:  { type: Date, required: true },
        
        period_date:  { type: Date, required: true },
        
        completed_at: { type: Date, required: true },

        note: { type: String, default: "" },

    }, 
    {
        timestamps: { createdAt: "created_at", updatedAt: "updated_at" }
    }
);

employeeEarningSchema.index({ employee_id: 1, status: 1 });
employeeEarningSchema.index({ employee_id: 1, payout_id: 1 });
employeeEarningSchema.index({ attendance_id: 1 }, { unique: true });
employeeEarningSchema.index({ period_date: 1 });
employeeEarningSchema.index({ employee_id: 1, period_date: 1 });
employeeEarningSchema.index({ work_date: 1 }); 

export const EmployeeEarning = mongoose.models.EmployeeEarning || mongoose.model("EmployeeEarning", employeeEarningSchema);
export default EmployeeEarning;
