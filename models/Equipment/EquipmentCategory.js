import mongoose from "mongoose";

// bảng danh mục thiết bị
const equipmentCategorySchema = new mongoose.Schema(
    {
        name: { type: String, required: true, trim: true },
        description: { type: String, required: true, trim: true },
        unit: { type: String, enum: ["item", "box"], default: "item" },
        price: { type: Number, min: 1, required: true },
        storage_quantity: { type: Number, default: 0 },
        avatar: { type: String }
    }, 
    {
        timestamps: { createdAt: "created_at", updatedAt: "updated_at" },
    }
);

const EquipmentCategory = mongoose.models.EquipmentCategory || mongoose.model("EquipmentCategory", equipmentCategorySchema);
export default EquipmentCategory;
