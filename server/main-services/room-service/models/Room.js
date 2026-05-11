import mongoose from "../../../shared/config/mongoose.js";

// bảng phòng
const roomSchema = new mongoose.Schema(
    {
        category_id: { type: mongoose.Schema.Types.ObjectId, ref: "RoomCategory", required: true },
        
        room_number: { type: String, required: true, unique: true },
        
        room_status: { type: String, enum: ["available", "reserved", "booked", "occupied", "cleaning", "maintenance", "new"], default: "new", required: true },
        
        start_time: { type: Date, default: null },
        
        end_time: { type: Date, default: null },
    },
    { 
        timestamps: { createdAt: "created_at", updatedAt: "updated_at"},
    }
);

roomSchema.index({ category_id: 1 });
roomSchema.index({ room_status: 1 });

roomSchema.virtual("roomStatusLog", {
  ref: "RoomLog",
  localField: "_id",
  foreignField: "room_id",
});

roomSchema.set("toObject", { virtuals: true });
roomSchema.set("toJSON", { virtuals: true });

const Room = mongoose.models.Room || mongoose.model("Room", roomSchema);
export default Room;
