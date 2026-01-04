import mongoose from "mongoose";

const roomLogSchema = new mongoose.Schema(
  {
    room_id: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Room",
      required: true,
    },

    booking_id: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Booking",
      default: null,
    },

    status: {
      type: String,
      enum: ["maintenance", "cleaning", "booked", "occupied", "available", "reserved"],
      required: true,
    },

    start_time: {
      type: Date,
      required: true,
      default: null
    },

    end_time: {
      type: Date,
      default: null
    },

    note: {
      type: String,
      default: "",
    },

    handled_by: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Employee",
      default: null,
    },
  },
  {
    timestamps: { createdAt: "created_at", updatedAt: "updated_at" },
  }
);

roomLogSchema.index({
  room_id: 1,
  start_time: -1,
  end_time: 1,
});

const RoomLog = mongoose.models.RoomLog || mongoose.model("RoomLog", roomLogSchema);
export default RoomLog;
