import mongoose from "mongoose";

// phiếu đền bù thiết bị
const compensateTicketSchema = new mongoose.Schema(
    {
        customer_id: { type: mongoose.Schema.Types.ObjectId, ref: "Customer", required: true },
        employee_id: { type: mongoose.Schema.Types.ObjectId, ref: "Employee", required: true },        
        total_fee: { type: Number }
    }, 
    {
        timestamps: { createdAt: "created_at", updatedAt: "updated_at" },
    }
);

const CompensateTicket = mongoose.models.compensateTicket || mongoose.model("compensateTicket", compensateTicketSchema);
export default CompensateTicket;
