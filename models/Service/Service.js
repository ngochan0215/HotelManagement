import mongoose from "mongoose";

// bảng dịch vụ
const serviceSchema = new mongoose.Schema(
    {
        category_id: { type: mongoose.Schema.Types.ObjectId, ref: "ServiceCategory", required: true },
        name: { type: String, required: true },
        description: { type: String },
        unit: { type: String, enum: ['hour', 'day', 'item', 'can', 'bottle', 'portion', 'ticket'], default: "hour" },
        price: { type: Number, required: true },
        storage_quantity: { type: Number, min: 1 },
        images: [ { type: String } ]
    }, 
    {
        timestamps: { createdAt: "created_at", updatedAt: "updated_at" },
    }
);

const Service = mongoose.models.Service || mongoose.model("Service", serviceSchema);
export default Service;
