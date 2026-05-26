import mongoose from "../../../shared/config/mongoose.js";

// tài sản cho thuê (xe máy, xe đạp, ...)
const serviceAssetSchema = new mongoose.Schema(
    {
        service_id: { type: mongoose.Schema.Types.ObjectId, ref: "Service", required: true },

        identifier: { type: String, required: true },

        condition: {
            type: String,
            enum: ["new", "good", "maintenance", "broken"],
            default: "new",
        },

        status: {
            type: String,
            enum: ["in-stock", "in-use", "maintenance", "disposed"],
            default: "in-stock",
        },

        notes: { type: String, default: "" },

        purchase_price: { type: Number, default: 0 },

        purchased_at: { type: Date, default: null },
    },
    {
        timestamps: { createdAt: "created_at", updatedAt: "updated_at" },
    }
);

serviceAssetSchema.index({ service_id: 1, status: 1 });

const ServiceAsset = mongoose.models.ServiceAsset || mongoose.model("ServiceAsset", serviceAssetSchema);
export default ServiceAsset;
