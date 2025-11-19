import mongoose from "mongoose";

// phiếu lắp đặt thiết bị trong phòng
const EquipmentInstallSchema = new mongoose.Schema(
    {
        employee_id: { type: mongoose.Schema.Types.ObjectId, ref: "Employee", required: true },
        room_id: { type: mongoose.Schema.Types.ObjectId, ref: "Room", required: true },
        install_date: { type: Date, required: true },
        status: { type: String, enum: ["pending", "completed"], default: "pending" }
    }, 
    {
        timestamps: { createdAt: "created_at", updatedAt: "updated_at" },
    }
);

const EquipmentInstall = mongoose.models.EquipmentInstall || mongoose.model("EquipmentInstall", EquipmentInstallSchema);
export default EquipmentInstall;
