import mongoose from "../../../shared/config/mongoose.js";

const reviewSchema = new mongoose.Schema(
    {
        booking_id: { type: mongoose.Schema.Types.ObjectId, ref: "Booking", required: true },
        
        // customer
        customer_id: { type: mongoose.Schema.Types.ObjectId, required: true },

        category_reviews: [
            {
                // room category
                category_id: { type: mongoose.Schema.Types.ObjectId, required: true },
                ratings: {
                    room_quality: { type: Number, min: 1, max: 5 },
                    cleanliness:  { type: Number, min: 1, max: 5 },
                    service:      { type: Number, min: 1, max: 5 },
                    value:        { type: Number, min: 1, max: 5 },
                },
                overall_rating: { type: Number, min: 1, max: 5 },
                comment: { type: String, trim: true, maxlength: 1000 },
            }
        ],

        general_rating: { type: Number, min: 1, max: 5, required: true },

        general_comment: { type: String, trim: true, maxlength: 1000 },

        is_visible: { type: Boolean, default: true },

        note: { type: String }
    },
    {
        timestamps: { createdAt: "created_at", updatedAt: "updated_at" },
    }
);

reviewSchema.index({ category_id: 1 });
reviewSchema.index({ customer_id: 1 });
reviewSchema.index({ booking_id: 1 });

const Review = mongoose.models.Review || mongoose.model("Review", reviewSchema);
export default Review;