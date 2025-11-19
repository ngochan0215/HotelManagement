import mongoose from "mongoose";

// chi tiết phiếu lắp đặt thiết bị (một phiếu có thể lắp đặt nhiều thiết bị)
const equipmentInstallDetailSchema = new mongoose.Schema(
    {
        install_id: { type: mongoose.Schema.Types.ObjectId, ref: "EquipmentInstall", required: true },
        equipment_id: { type: mongoose.Schema.Types.ObjectId, ref: "Equipment", required: true },
    }, 
    {
        timestamps: { createdAt: "created_at", updatedAt: "updated_at" },
    }
);

const InstallDetail = mongoose.models.InstallDetail || mongoose.model("InstallDetail", equipmentInstallDetailSchema);
export default InstallDetail;
 