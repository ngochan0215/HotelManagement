import mongoose from "../../../shared/config/mongoose.js";

const bookingStatusLogSchema = new mongoose.Schema(
    {
        booking_id: {
            type: mongoose.Schema.Types.ObjectId,
            ref: "Booking",
            required: true,
        },

        status: {
            type: String,
            enum: [
                "pending",
                "confirmed",
                "in_progress",
                "checked_in",
                "checked_out",
                "cancelled",
                "completed",
            ],
            required: true,
        },

        start_time: {
            type: Date,
            required: true,
        },

        end_time: {
            type: Date,
            default: null,
        },

        expected_end_time: {
            type: Date,
            default: null,
        },

        note: {
            type: String,
            default: "",
        },

        // employee
        handled_by: {
            type: mongoose.Schema.Types.ObjectId,
            default: null,
        },
    },
    {
        timestamps: { createdAt: "created_at", updatedAt: "updated_at" },
    }
);

const BookingStatusLog = mongoose.models.BookingStatusLog || mongoose.model("BookingStatusLog", bookingStatusLogSchema);
export default BookingStatusLog;