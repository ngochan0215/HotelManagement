import mongoose from "mongoose";

// bảng khuyến mãi
const DiscountSchema = new mongoose.Schema({
    name: { type: String, required: true },
    description: { type: String, trim: true },

    begin_date: { type: Date, required: true },
    end_date: { type: Date, required: true },

    percentage: {
        type: Number,
        min: 1,
        max: 100,
        required: true
    },

    scope: {
        type: String,
        enum: ["booking", "room", "service", "customer"],
        required: true
    },

    type: {
        type: String,
        enum: ["seasonal", "first_booking", "loyalty", "promo_code"],
        required: true
    },

    stackable: { type: Boolean, default: false },

    status: { type: String, enum: ["launching", "active", "expired"], default: "launching" }

    }, 
    {
        timestamps: { createdAt: "created_at", updatedAt: "updated_at" }
    }
);


const Discount = mongoose.models.Discount || mongoose.model("Discount", DiscountSchema);
export default Discount;
