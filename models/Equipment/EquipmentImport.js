import mongoose from "mongoose";

// chi tiết phiếu nhập thiết bị (một phiếu có thể nhập nhiều thiết bị)
const equipmentImportSchema = new mongoose.Schema(
    {
        ticket_id: { type: mongoose.Schema.Types.ObjectId, ref: "EquipmentTicket", required: true },
        category_id: { type: mongoose.Schema.Types.ObjectId, ref: "EquipmentCategory", required: true },
        import_price: { type: Number, default: 0 },
        import_quantity: { type: Number, default: 0 }, 
    }, 
    {
        timestamps: { createdAt: "created_at", updatedAt: "updated_at" },
    }
);

const EquipmentImport = mongoose.models.EquipmentImport || mongoose.model("EquipmentImport", equipmentImportSchema);
export default EquipmentImport;
