import mongoose from "mongoose";

const shiftSchema = new mongoose.Schema(
  {
    work_day: {
      type: String,
      enum: ['monday','tuesday','wednesday','thursday','friday','saturday','sunday'],
      required: true,
    },
    type: {
      type: String,
      enum: ['morning','afternoon','night'],
      required: true,
    },
    begin_time: { type: Date, required: true },
    end_time: { type: Date, required: true },
    required_staff: {
      receptionist: { type: Number, default: 0 },
      technician: { type: Number, default: 0 },
      customer_service: { type: Number, default: 0 },
      housekeeper: { type: Number, default: 0 },
    },
  },
  {
    timestamps: { createdAt: "created_at", updatedAt: "updated_at" },
  }
);

const Shift = mongoose.models.Shift || mongoose.model("Shift", shiftSchema);
export default Shift;
