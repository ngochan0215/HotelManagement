import mongoose from "../../../shared/config/mongoose.js";

// chi tiết phiếu lắp đặt thiết bị (một phiếu có thể lắp đặt nhiều thiết bị)
const equipmentInstallDetailSchema = new mongoose.Schema(
    {
        ticket_id: { type: mongoose.Schema.Types.ObjectId, ref: "InstallTicket", required: true },
        
        equipment_id: { type: mongoose.Schema.Types.ObjectId, ref: "Equipment", required: true },
        
        equipment_category_id: { type: mongoose.Schema.Types.ObjectId, ref: "EquipmentCategory", default: null }
    }, 
    {
        timestamps: { createdAt: "created_at", updatedAt: "updated_at" },
    }
);

const InstallDetail = mongoose.models.InstallDetail || mongoose.model("InstallDetail", equipmentInstallDetailSchema);
export default InstallDetail;
 