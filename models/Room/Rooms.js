import mongoose from "mongoose";

// bảng phòng
const roomSchema = new mongoose.Schema(
    {
        category_id: { type: mongoose.Schema.Types.ObjectId, ref: "RoomCategory", required: true },
        room_number: { type: Number },
        room_status: { type: String, enum: ["free", "occupied", "out_of_order"], default: "free" },
        cleaning_status: { type: String, enum: ["cleaned", "unclean"], default: "cleaned" },
        begin_date: { type: Date },
        end_date: { type: Date }
    },
    { 
        timestamps: { createdAt: "created_at", updatedAt: "updated_at"},
    }
);

const Room = mongoose.models.Room || mongoose.model("Room", roomSchema);
export default Roomategory;
