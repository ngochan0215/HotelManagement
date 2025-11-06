import mongoose from "mongoose";

// phiếu nhập thiết bị
const equipmentTicketSchema = new mongoose.Schema(
    {
        employee_id: { type: mongoose.Schema.Types.ObjectId, ref: "Employee", required: true },
        import_date: { type: Date, required: true },
        status: { type: String, enum: ["pending", "completed"], default: "pending" }
    }, 
    {
        timestamps: { createdAt: "created_at", updatedAt: "updated_at" },
    }
);

const EquipmentTicket = mongoose.models.EquipmentTicket || mongoose.model("EquipmentTicket", equipmentTicketSchema);
export default EquipmentTicket;
