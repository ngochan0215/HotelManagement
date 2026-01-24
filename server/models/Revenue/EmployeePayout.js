import mongoose from "mongoose";

const payoutEmployeeSchema = new mongoose.Schema({
    employee_id: {
        type: mongoose.Schema.Types.ObjectId,
        ref: "Employee",
        required: true
    },

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
    
    earning_ids: [{
        type: mongoose.Schema.Types.ObjectId,
        ref: "EmployeeEarning"
    }]
}, {
    timestamps: { createdAt: "created_at", updatedAt: "updated_at" }
});

export const PayoutEmployee = mongoose.models.PayoutEmployee || mongoose.model("PayoutEmployee", payoutEmployeeSchema);
export default PayoutEmployee;