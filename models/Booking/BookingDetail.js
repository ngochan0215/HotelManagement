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

    base_fee: { type: Number, required: true, min: 0 },
    extra_fee: { type: Number, default: 0, min: 0 },

    expected_checkin: {
      type: Date,
      required: true,
    },

    expected_checkout: {
      type: Date,
      required: true,
      validate: {
        validator: function (value) {
          return value > this.expected_checkin;
        },
        message: "Ngày check-out phải sau ngày check-in.",
      },
    },

    actual_checkin: {
      type: Date,
      default: null,
    },

    actual_checkout: {
      type: Date,
      default: null,
    },

    status: {
      type: String,
      enum: ["confirmed", "checked_in", "checked_out", "cancelled"],
      default: "reserved",
    },

  },
  {
    timestamps: { createdAt: "created_at", updatedAt: "updated_at" },
  }
);

// 1 phòng chỉ xuất hiện 1 lần trong 1 booking
bookingDetailSchema.index(
  { booking_id: 1, room_id: 1 },
  { unique: true }
);

const BookingDetail = mongoose.models.BookingDetail || mongoose.model("BookingDetail", bookingDetailSchema);
export default BookingDetail;
