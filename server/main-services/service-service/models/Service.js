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
        
        status: { type: String, enum: ["active", "inactive"], default: "active" },
        
        images: [ { type: String } ]
    },
    {
        timestamps: { createdAt: "created_at", updatedAt: "updated_at" },
    }
);

serviceSchema.index({ category_id: 1 });
serviceSchema.index({ price: 1 });
serviceSchema.index({ storage_quantity: 1 });
serviceSchema.index({ status: 1 });

const Service = mongoose.models.Service || mongoose.model("Service", serviceSchema);
export default Service;
