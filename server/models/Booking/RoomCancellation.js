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
      default: null
    },

    cancelled_by: {
      type: String,
      enum: ["customer", "employee", "system"],
      required: true,
    },

    cancelled_by_user: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      default: null
    },

    booking_status: { type: String, enum: [ "pending", "confirmed", "checked_in"], required: true },
    
    reason: {
      type: String,
      enum: [
        "change_plan",
        "price_issue",
        "find_better_option",
        "personal_reason",
        "no_show",
        "overbooking",
        "force_majeure",
        "early_checkout",
        "other"
      ],
      required: true,
    },

    cancelled_at: { type: Date, default: Date.now },
    penalty_fee: { type: Number, default: 0, min: 0 },
    refund_amount: { type: Number, default: 0, min: 0 },
  },
  {
    timestamps: { createdAt: "created_at", updatedAt: "updated_at" },
  }
);

const RoomCancellation = mongoose.models.RoomCancellation || mongoose.model("RoomCancellation", roomCancellationSchema);
export default RoomCancellation;
