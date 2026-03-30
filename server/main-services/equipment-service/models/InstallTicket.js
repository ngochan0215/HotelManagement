import mongoose from "../../../shared/config/mongoose.js";

// phiếu lắp đặt thiết bị trong phòng
const equipmentInstallSchema = new mongoose.Schema(
    {
        employee_id: { type: mongoose.Schema.Types.ObjectId, required: true },

        handled_by: { type: mongoose.Schema.Types.ObjectId },
        
        room_id: { type: mongoose.Schema.Types.ObjectId, required: true },
        
        type: { type: String, enum: ['install', 'uninstall'], default: 'install' },
        
        install_date: { type: Date, required: true },
        
        status: { type: String, enum: ["pending", "assigned", "waiting_confirm", "completed", "expired"], default: "pending" },
        
        started_at: { type: Date },
        
        completed_at: { type: Date }
    }, 
    {
        timestamps: { createdAt: "created_at", updatedAt: "updated_at" },
    }
);

equipmentInstallSchema.index({ room_id: 1 });
equipmentInstallSchema.index({ status: 1 });
equipmentInstallSchema.index({ install_date: 1 });

const InstallTicket = mongoose.models.InstallTicket || mongoose.model("InstallTicket", equipmentInstallSchema);
export default InstallTicket;
