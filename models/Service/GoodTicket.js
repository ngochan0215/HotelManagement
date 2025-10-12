import mongoose from "mongoose";

// phiếu nhập sản phẩm (ăn uống)
const goodTicketSchema = new mongoose.Schema(
    {
        category_id: { type: mongoose.Schema.Types.ObjectId, ref: "goodTicketCategory", required: true },
        name: { type: String, required: true },
        description: { type: String },
        unit: { type: String, enum: ['hour', 'day', 'item', 'can', 'bottle', 'portion'], default: "hour" },
        price: { type: Number, required: true },
    }, 
    {
        timestamps: { createdAt: "created_at", updatedAt: "updated_at" },
    }
);

const GoodTicket = mongoose.models.goodTicket || mongoose.model("goodTicket", goodTicketSchema);
export default GoodTicket;
