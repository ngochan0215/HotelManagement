import mongoose from "mongoose";

// bảng thiết bị
const equipmentSchema = new mongoose.Schema(
    {
        category_id: { type: mongoose.Schema.Types.ObjectId, ref: "EquipmentCategory", required: true },
        room_id: { type: mongoose.Schema.Types.ObjectId, ref: "Room" },
        import_ticket_id: { type: mongoose.Schema.Types.ObjectId, ref: "EquipmentTicket", required: true },
        install_ticket_id: { type: mongoose.Schema.Types.ObjectId, ref: "EquipmentInstall" },

        condition: { type: String, enum: ["new", "good", "maintenance", "broken"], default: "good", required: true },
        status: { type: String, enum: ["in-stock", "installing", "in-use", "maintenance", "lost", "disposed"], default: "in-stock", required: true },
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
