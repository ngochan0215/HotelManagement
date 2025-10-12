import mongoose from "mongoose";

// bảng khách hàng
const customerSchema = new mongoose.Schema(
    {
        user_id: { type: mongoose.Schema.Types.ObjectId, ref: "User", required: true, unique: true },
        full_name: { type: String, required: true, trim: true },
        date_birth: { type: Date },
        phone_number: { type: String, required: true, unique: true, trim: true },
        nationality: { type: String },
        CCCD: { type: String, unique: true, required: true },
        avatar: { type: String },
        
        booking_count: { type: Number, default: 0 },
        points: { type: Number, default: 0 },
        loyalty: { type: String, enum: ["silver", "gold", "platinum"], default: "silver" },
    },  
    { 
        timestamps: { updatedAt: "updated_at" }, 
    }
);

const Customer = mongoose.models.Customer || mongoose.model("Customer", customerSchema);
export default Customer;