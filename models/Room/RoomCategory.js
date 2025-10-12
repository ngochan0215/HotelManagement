import mongoose from "mongoose";

// bảng loại phòng
const roomCategorySchema = new mongoose.Schema(
    {
        category_name: { type: String, required: true, unique: true },
        description: { type: String, required: true },
        max_adults: { type: Number, default: 0 },
        max_children: { type: Number, default: 0 },
        bed_count: { type: Number, default: 0 },
        price: { type: Number, default: 0 },
    },
    { 
        timestamps: { createdAt: "created_at", updatedAt: "updated_at"},
    }
);

const RoomCategory = mongoose.models.RoomCategory || mongoose.model("RoomCategory", roomCategorySchema);
export default RoomCategory;
