import mongoose from "../../shared/config/mongoose.js";

// chi tiết phiếu nhập thiết bị (một phiếu có thể nhập nhiều danh mục thiết bị)
const importDetailSchema = new mongoose.Schema(
    {
        ticket_id: { type: mongoose.Schema.Types.ObjectId, ref: "ImportTicket", required: true },
        
        category_id: { type: mongoose.Schema.Types.ObjectId, ref: "EquipmentCategory", required: true },
        
        import_price: { type: Number, default: 0 },
        
        import_quantity: { type: Number, default: 0 }, 
    }, 
    {
        timestamps: { createdAt: "created_at", updatedAt: "updated_at" },
    }
);

const ImportDetail = mongoose.models.ImportDetail || mongoose.model("ImportDetail", importDetailSchema);
export default ImportDetail;
