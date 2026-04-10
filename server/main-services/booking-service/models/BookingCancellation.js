import mongoose from "../../../shared/config/mongoose.js";

const bookingCancellationSchema = new mongoose.Schema(
    {
        booking_id: {
            type: mongoose.Schema.Types.ObjectId,
            ref: "Booking",
            required: true,
        },

        room_id: {
            type: mongoose.Schema.Types.ObjectId,
            default: null
        },

        cancelled_by: {
            type: String,
            enum: ["customer", "employee", "system"],
            required: true,
        },

        // user
        cancelled_by_user: {
            type: mongoose.Schema.Types.ObjectId,
            default: null
        },

        booking_status: { 
            type: String, 
            enum: [ "pending", "confirmed", "checked_in"], 
            required: true 
        },
        
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

const BookingCancellation = mongoose.models.BookingCancellation || mongoose.model("BookingCancellation", bookingCancellationSchema);
export default BookingCancellation;
