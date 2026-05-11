import mongoose from "../../../shared/config/mongoose.js";

const scheduleSchema = new mongoose.Schema(
    {
        contract_id: { type: mongoose.Schema.Types.ObjectId, ref: "ScheduleContract", required: true },
        
        employee_id: { type: mongoose.Schema.Types.ObjectId, ref: "Employee", required: true },

        shift_id: { type: mongoose.Schema.Types.ObjectId, ref: "Shift", required: true },

        work_date: { type: Date, required: true },
        
        role: {
            type: String,
            enum: ["manager", "receptionist", "technician", "customer_service", "housekeeper", "accountant", "it"],
            required: true
        },

        status: {
            type: String,
            enum: ["pending", "approved", "rejected", "cancelled"],
            default: "pending"
        },

        note : { type: String, default: "" }
    },
    {
        timestamps: { createdAt: "created_at", updatedAt: "updated_at" },
    }
);

scheduleSchema.index(
  { employee_id: 1, shift_id: 1, work_date: 1 },
  {
    unique: true,
    partialFilterExpression: {
      status: { $in: ["pending", "approved"] }
    }
  }
);

const Schedule = mongoose.models.Schedule || mongoose.model("Schedule", scheduleSchema);
export default Schedule;
