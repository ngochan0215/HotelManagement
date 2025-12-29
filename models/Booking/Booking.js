import mongoose from "mongoose";

const bookingSchema = new mongoose.Schema(
  {
    customer_id: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Customer",
      required: true,
    },

    handled_by: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Employee",
      default: null
    },

    status: {
      type: String,
      enum: [
        "pending",
        "confirmed",
        "in_progress",
        "completed",
        "cancelled",
        "expired",
      ],
      default: "pending",
    },

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

    adults: { type: Number, required: true, min: 1 },
    children: { type: Number, required: true, min: 0 },

    deposit: { type: Number, default: 0, min: 0 },
  },
  {
    timestamps: { createdAt: "created_at", updatedAt: "updated_at" },
  }
);

const Booking = mongoose.models.Booking || mongoose.model("Booking", bookingSchema);
export default Booking;
