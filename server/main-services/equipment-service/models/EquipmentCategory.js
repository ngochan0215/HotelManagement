import mongoose from "../../../shared/config/mongoose.js";

// bảng danh mục thiết bị
const equipmentCategorySchema = new mongoose.Schema(
    {
        warehouse: {
            type: String,
            enum: ["housekeeping", "fb", "technical"],
            required: true
        },

        type: {
            type: String,
            enum: ["single", "quantity"],
            required: true
        },


        name: { type: String, required: true, trim: true },

        description: { type: String, required: true, trim: true },

        unit: { type: String, enum: ["item", "box", "Cái", "Bộ"], default: "item" },

        price: { type: Number, min: 1, required: true },

        storage_quantity: { type: Number, default: 0 }, // Số lượng thiết bị tồn kho (status=in-stock, condition=new/good, room_id=null)

        total_quantity: { type: Number, default: 0 }, // Tổng số lượng thiết bị hiện tại (tất cả status)
        
        image: { type: String }
    }, 
    {
        timestamps: { createdAt: "created_at", updatedAt: "updated_at" },
    }
);

equipmentCategorySchema.index({ price: 1 });
equipmentCategorySchema.index({ storage_quantity: 1 });

const EquipmentCategory = mongoose.models.EquipmentCategory || mongoose.model("EquipmentCategory", equipmentCategorySchema);
export default EquipmentCategory;
