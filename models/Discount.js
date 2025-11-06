import mongoose from "mongoose";

// bảng khuyến mãi
const DiscountSchema = new mongoose.Schema(
    {
        name: { type: String, required: true },
        description: { type: String, required: true },
        begin_date: { type: Date, required: true },
        end_date: { type: Date, required: true },
        percentage: { type: Number, min: 1, max: 100, required: true },
    }, 
    {
        timestamps: { createdAt: "created_at", updatedAt: "updated_at" },
    }
);

const Discount = mongoose.models.Discount || mongoose.model("Discount", DiscountSchema);
export default Discount;
