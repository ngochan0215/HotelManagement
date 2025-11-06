import mongoose from "mongoose";

// bảng phòng
const roomSchema = new mongoose.Schema(
    {
        category_id: { type: mongoose.Schema.Types.ObjectId, ref: "RoomCategory", required: true },
        room_number: { type: String, required: true, unique: true },
        room_status: { type: String, enum: ["available", "booked", "occupied", "cleaning", "maintenance"], default: "available", required: true }
    },
    { 
        timestamps: { createdAt: "created_at", updatedAt: "updated_at"},
    }
);

roomSchema.index({ category_id: 1 });

const Room = mongoose.models.Room || mongoose.model("Room", roomSchema);
export default Room;
