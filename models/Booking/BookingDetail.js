import mongoose from "mongoose";

const bookingDetailSchema = new mongoose.Schema(
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

    base_fee: { type: Number, required: true },
    extra_fee: { type: Number, default: 0 },

    checkin_expected: { type: Date },
    checkout_expected: { type: Date },
  },
  {
    timestamps: { createdAt: "created_at", updatedAt: "updated_at" },
  }
);

const BookingDetail = mongoose.models.BookingDetail || mongoose.model("BookingDetail", bookingDetailSchema);
export default BookingDetail;
