import mongoose from "mongoose";

// bảng thiết bị
const facilitySchema = new mongoose.Schema(
    {
        name: { type: String, required: true },
        description: { type: String },
        unit: { type: String, enum: ["item", "box"], default: "item" },
        price: { type: Number, required: true },
        storage_quantity: { type: Number }
    }, 
    {
        timestamps: { createdAt: "created_at", updatedAt: "updated_at" },
    }
);

const Facility = mongoose.models.Facility || mongoose.model("Facility", facilitySchema);
export default Facility;
