import mongoose from "mongoose";

// bảng nhân viên
const employeeSchema = new mongoose.Schema(
    {
        user_id: { type: mongoose.Schema.Types.ObjectId, ref: "User", required: true, unique: true },
        full_name: { type: String, required: true, trim: true },
        date_birth: { type: Date },
        phone_number: { type: String, required: true, unique: true, trim: true },
        nationality: { type: String },
        CCCD: { type: String, unique: true, required: true },
        avatar: { type: String },
        
        type: { type: String, enum: ["manager", "receptionist", "technicican", "customer-service"], default: "receptionist" },
        status: { type: String, enum: ["working", "resign"], default: "working" },
        fixed_salary: { type: Number, required: true },
        working_year: { type: Number },
    }, 
    { 
        timestamps: { updatedAt: "updated_at" }, 
    }
);

const Employee = mongoose.models.Employee || mongoose.model("Employee", employeeSchema);
export default Employee;

