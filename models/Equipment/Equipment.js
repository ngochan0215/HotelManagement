import mongoose from "mongoose";

// bảng thiết bị
const equipmentSchema = new mongoose.Schema(
    {
        category_id: { type: mongoose.Schema.Types.ObjectId, ref: "EquipmentCategory", required: true },
        room_id: { type: mongoose.Schema.Types.ObjectId, ref: "Room" },
        condition: { type: String, enum: ["new", "good", "maintenance", "broken"], default: "good", required: true },
        status: { type: String, enum: ["in-stock", "in-use", "maintenance", "lost", "disposed"], default: "in-stock", required: true },
        import_ticket_id: { type: mongoose.Schema.Types.ObjectId, ref: "EquipmentTicket", required: true },
        install_ticket_id: { type: mongoose.Schema.Types.ObjectId, ref: "EquipmentInstall" },
        note: { type: String }
    },
    {
        timestamps: { createdAt: "created_at", updatedAt: "updated_at" },
    }
);

const Equipment = mongoose.models.Equipment || mongoose.model("Equipment", equipmentSchema);
export default Equipment;
