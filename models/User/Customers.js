import mongoose from "mongoose";

// bảng khách hàng
const customerSchema = new mongoose.Schema(
    {
        user_id: { type: mongoose.Schema.Types.ObjectId, ref: "User", required: true, unique: true },
        full_name: { type: String, required: true, trim: true },
        date_birth: { type: Date, required: true },
        phone_number: { type: String, required: true, unique: true, trim: true },
        nationality: { type: String , default: "vietnam" },
        CCCD: { type: String, unique: true, required: true },
                
        booking_count: { type: Number, default: 0 },
        points: { type: Number, default: 0 },
        loyalty: { type: String, enum: ["bronze", "silver", "gold", "platinum"], default: "bronze" },
    },  
    { 
        timestamps: { createdAt: "created_at", updatedAt: "updated_at" }, 
    }
);

const Customer = mongoose.models.Customer || mongoose.model("Customer", customerSchema);
export default Customer;