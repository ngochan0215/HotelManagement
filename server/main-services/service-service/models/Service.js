import mongoose from "../../../shared/config/mongoose.js";

// bảng dịch vụ
const serviceSchema = new mongoose.Schema(
    {
        category_id: { type: mongoose.Schema.Types.ObjectId, ref: "ServiceCategory", required: true },
        
        name: { type: String, required: true },
        
        description: { type: String },
        
        unit: { type: String, enum: ['hour', 'day', 'item', 'can', 'bottle', 'portion', 'ticket'], default: "hour" },
        
        price: { type: Number, required: true },
        
        storage_quantity: { type: Number, min: 0, default: 0 },

        total_quantity: { type: Number, min: 0, default: 0 },

        total_sold: { type: Number, min: 0, default: 0 },
        
        service_type: { type: String, enum: ["product", "rental", "experience"], default: "product", required: true },

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
