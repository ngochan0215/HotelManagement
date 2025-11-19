import mongoose from "mongoose";

// bảng loại dịch vụ
const ServiceCategorySchema = new mongoose.Schema(
    {
        name: { type: String, required: true },
        description: { type: String },
        images: [ { type: String } ]
    }, 
    {
        timestamps: { createdAt: "created_at", updatedAt: "updated_at" },
    }
);

const ServiceCategory = mongoose.models.ServiceCategory || mongoose.model("ServiceCategory", ServiceCategorySchema);
export default ServiceCategory;
