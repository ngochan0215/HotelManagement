import mongoose from "mongoose";

// phiếu nhập thiết bị
const equipmentTicketSchema = new mongoose.Schema(
    {
        employee_id: { type: mongoose.Schema.Types.ObjectId, ref: "Employee", required: true },
        import_date: { type: Date, required: true },
        status: { type: String, enum: ["pending", "waiting_confirm", "completed", "expired"], default: "pending" },
        confirmed_by: { type: mongoose.Schema.Types.ObjectId },
        confirmed_at: { type: Date },
        total_fee: { type: Number, default: 0 }
    }, 
    {
        timestamps: { createdAt: "created_at", updatedAt: "updated_at" },
    }
);

equipmentTicketSchema.index({ import_date: 1 });
equipmentTicketSchema.index({ status: 1 });

const EquipmentTicket = mongoose.models.EquipmentTicket || mongoose.model("EquipmentTicket", equipmentTicketSchema);
export default EquipmentTicket;
