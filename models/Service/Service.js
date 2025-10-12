import mongoose from "mongoose";

// bảng dịch vụ
const serviceSchema = new mongoose.Schema(
    {
        category_id: { type: mongoose.Schema.Types.ObjectId, ref: "ServiceCategory", required: true },
        name: { type: String, required: true },
        description: { type: String },
        unit: { type: String, enum: ['hour', 'day', 'item', 'can', 'bottle', 'portion'], default: "hour" },
        price: { type: Number, required: true },
    }, 
    {
        timestamps: { createdAt: "created_at", updatedAt: "updated_at" },
    }
);

const Service = mongoose.models.service || mongoose.model("service", serviceSchema);
export default Service;
