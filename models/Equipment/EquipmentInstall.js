import mongoose from "mongoose";

// phiếu lắp đặt thiết bị trong phòng
const equipmentInstallSchema = new mongoose.Schema(
    {
        employee_id: { type: mongoose.Schema.Types.ObjectId, ref: "Employee", required: true },
        room_id: { type: mongoose.Schema.Types.ObjectId, ref: "Room", required: true },
        install_date: { type: Date, required: true },
        status: { type: String, enum: ["pending", "waiting_confirm", "completed"], default: "pending" }
    }, 
    {
        timestamps: { createdAt: "created_at", updatedAt: "updated_at" },
    }
);

equipmentInstallSchema.index({ room_id: 1 });
equipmentInstallSchema.index({ status: 1 });
equipmentInstallSchema.index({ install_date: 1 });

const EquipmentInstall = mongoose.models.EquipmentInstall || mongoose.model("EquipmentInstall", equipmentInstallSchema);
export default EquipmentInstall;
