import mongoose from "../../../shared/config/mongoose.js";

// bảng thiết bị
const equipmentSchema = new mongoose.Schema(
    {
        category_id: { type: mongoose.Schema.Types.ObjectId, ref: "EquipmentCategory", required: true },

        room_id: { type: mongoose.Schema.Types.ObjectId, ref: "Room", default: null },
        
        import_ticket_id: { type: mongoose.Schema.Types.ObjectId, ref: "ImportTicket", required: true },
        
        install_ticket_id: { type: mongoose.Schema.Types.ObjectId, ref: "InstallTicket", default: null },

        condition: { type: String, enum: ["new", "good", "maintenance", "broken"], default: "good", required: true },
        
        status: { type: String, enum: ["in-stock", "installing", "removing", "in-use", "maintenance", "lost", "disposed"], default: "in-stock", required: true },
        
        note: { type: String }
    },
    {
        timestamps: { createdAt: "created_at", updatedAt: "updated_at" },
    }
);

equipmentSchema.index({ category_id: 1 });
equipmentSchema.index({ room_id: 1 });
equipmentSchema.index({ status : 1 });
equipmentSchema.index({ condition: 1 });

const Equipment = mongoose.models.Equipment || mongoose.model("Equipment", equipmentSchema);
export default Equipment;
