import mongoose from "mongoose";

// bảng nhân viên
const employeeSchema = new mongoose.Schema(
    {
        user_id: { type: mongoose.Schema.Types.ObjectId, ref: "User", required: true, unique: true },
        full_name: { type: String, required: true, trim: true },
        date_birth: { type: Date },
        phone_number: { type: String, required: true, unique: true, trim: true },
        CCCD: { type: String, unique: true, required: true },
        nationality: { type: String , default: "vietnam" },

        position: { type: String, enum: ["manager", "receptionist", "technicican", "customer-service"], default: "receptionist" },
        status: { type: String, enum: ["working", "resign"], default: "working" },
        fixed_salary: { type: Number },
        working_year: { type: Number },
    }, 
    { 
        timestamps: { updatedAt: "updated_at", createdAt: "created_at"}, 
    }
);

const Employee = mongoose.models.Employee || mongoose.model("Employee", employeeSchema);
export default Employee;

