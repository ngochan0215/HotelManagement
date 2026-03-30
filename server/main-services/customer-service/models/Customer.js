import mongoose from "../../../shared/config/mongoose.js";

const customerSchema = new mongoose.Schema(
    {
        user_id: { type: mongoose.Schema.Types.ObjectId, ref: "User", required: true, unique: true },
        full_name: { type: String, required: true, trim: true },
        date_birth: { type: Date, required: true },
        phone_number: { type: String, required: true, unique: true, trim: true, unique: true },
        nationality: { type: String , default: "vietnam" },
        CCCD: { type: String, unique: true, required: true, unique: true },
                
        booking_count: { type: Number, min: 0, default: 0 },
        points: { type: Number, default: 10 },
        loyalty: { type: String, enum: ["bronze", "silver", "gold", "platinum"], default: "bronze" },
        status: { type: String, enum: ["active", "inactive", "banned"], default: "active" },
    },  
    { 
        timestamps: { createdAt: "created_at", updatedAt: "updated_at" }, 
    }
);

customerSchema.index({ status: 1 });
customerSchema.index({ points: 1 });

const Customer = mongoose.models.Customer || mongoose.model("Customer", customerSchema);
export default Customer;