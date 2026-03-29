import mongoose from "../../shared/config/mongoose.js";

const employeeSchema = new mongoose.Schema(
    {
        user_id: { type: mongoose.Schema.Types.ObjectId, ref: "User", required: true, unique: true },
        full_name: { type: String, required: true, trim: true },
        date_birth: { type: Date },
        phone_number: { type: String, required: true, unique: true, trim: true },
        CCCD: { type: String, unique: true, required: true },
        
        position: { 
            type: String, 
            enum: ["manager", "receptionist", "technician", "customer_service", "housekeeper", "accountant", "it"], 
            default: "receptionist" 
        },
        
        status: { type: String, enum: ["working", "resign"], default: "working" },
        fixed_salary: { type: Number },
        working_year: { type: Number, default: 0 },

        BIN: {type: String }, //6 số đầu của thẻ ngân hàng
        account_number: {type: String }, //số tài khoản ngân hàng (không phải số thẻ nhé)
        bank_shortName: {type: String }, //mã ngân hàng (key từ API bankcodes)  
    }, 
    { 
        timestamps: { updatedAt: "updated_at", createdAt: "created_at"}, 
    }
);

employeeSchema.index({ position: 1 });
employeeSchema.index({ status: 1 });

const Employee = mongoose.models.Employee || mongoose.model("Employee", employeeSchema);
export default Employee;

console.log("Employee model mongoose state:", mongoose.connection.readyState);
