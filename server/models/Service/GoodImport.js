import mongoose from "mongoose";

// chi tiết phiếu nhập sản phẩm (một phiếu có thể nhập nhiều)
const goodImportSchema = new mongoose.Schema(
    {
        ticket_id: { type: mongoose.Schema.Types.ObjectId, ref: "GoodTicket", required: true },
        service_id: { type: mongoose.Schema.Types.ObjectId, ref: "Service", required: true },
        import_price: { type: Number, default: 0 },
        import_quantity: { type: Number, default: 0 }, 
    }, 
    {
        timestamps: { createdAt: "created_at", updatedAt: "updated_at" },
    }
);

const GoodImport = mongoose.models.goodImport || mongoose.model("goodImport", goodImportSchema);
export default GoodImport;
