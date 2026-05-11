import mongoose from "../../../shared/config/mongoose.js";

const shiftSchema = new mongoose.Schema(
    {
        work_day: {
            type: String,
            enum: ['monday','tuesday','wednesday','thursday','friday','saturday','sunday'],
            required: true,
        },

        shift_type: {
            type: String,
            enum: ['morning','afternoon','night'],
            required: true,
        },

        begin_time: { type: String, required: true },

        end_time: { type: String, required: true },

        required_staff: {
            receptionist: { type: Number, default: 0 },

            technician: { type: Number, default: 0 },

            customer_service: { type: Number, default: 0 },

            housekeeper: { type: Number, default: 0 },

            manager: { type: Number, default: 0 },

            accountant: { type: Number, default: 0 },

            it: { type: Number, default: 0 },
        },

    },
    {
        timestamps: { createdAt: "created_at", updatedAt: "updated_at" },
    }
);

const Shift = mongoose.models.Shift || mongoose.model("Shift", shiftSchema);
export default Shift;
