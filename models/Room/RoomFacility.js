import mongoose from "mongoose";

// bảng thiết bị trong phòng
const roomFacilitySchema = new mongoose.Schema(
    {
        room_id: { type: mongoose.Schema.Types.ObjectId, ref: "Room", required: true },
        facility_id: { type: mongoose.Schema.Types.ObjectId, ref: "Facility", required: true },
        status: { type: String, enum: ["in-use", "broken", "maintenance"], default: "in-use" },
        quantity: { type: Number },
    }, 
    {
        timestamps: { createdAt: "created_at", updatedAt: "updated_at" },
    }
);

const roomFacility = mongoose.models.roomFacility || mongoose.model("roomFacility", roomFacilitySchema);
export default roomFacility;
