import mongoose from "mongoose";

const employeeEarningSchema = new mongoose.Schema({
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
    
    earning_amount: {
        type: Number,
        required: true,
        min: 0
    },
    
    work_hours: {
        type: Number,
        required: true,
        min: 0
    },
    
    hourly_rate: {
        type: Number,
        required: true,
        min: 0
    },
    
    status: {
        type: String,
        enum: ["available", "pending", "paid"],
        default: "available"
    },
    
    payout_id: {
        type: mongoose.Schema.Types.ObjectId,
        ref: "PayoutEmployee",
        default: null
    },
    
    completed_at: {
        type: Date,
        required: true
    },
    
    period_date: {
        type: Date,
        required: true
    }
}, {
    timestamps: { createdAt: "created_at", updatedAt: "updated_at" }
});

// Index để tìm kiếm nhanh
employeeEarningSchema.index({ employee_id: 1, status: 1 });
employeeEarningSchema.index({ employee_id: 1, payout_id: 1 });
employeeEarningSchema.index({ attendance_id: 1 }, { unique: true });
employeeEarningSchema.index({ period_date: 1 });

export const EmployeeEarning = mongoose.models.EmployeeEarning || mongoose.model("EmployeeEarning", employeeEarningSchema);
export default EmployeeEarning;
