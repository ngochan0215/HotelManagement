import mongoose from "mongoose";

const roomCancellationSchema = new mongoose.Schema(
  {
    booking_id: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Booking",
      required: true,
    },
    room_id: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Room",
      required: true,
    },
    user_id: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      required: true,
    },

    cancelled_by: {
      type: String,
      enum: ["customer", "employee"],
      required: true,
    },

    cancelled_at: { type: Date, default: Date.now },
    reason: { type: String, required: true },
    penalty_fee: { type: Number, default: 0 },
  },
  {
    timestamps: { createdAt: "created_at", updatedAt: "updated_at" },
  }
);

const RoomCancellation = mongoose.models.RoomCancellation ||
  mongoose.model("RoomCancellation", roomCancellationSchema);
export default RoomCancellation;
