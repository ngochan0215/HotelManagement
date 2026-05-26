import mongoose from "../../../shared/config/mongoose.js";

// slot lịch dịch vụ trải nghiệm (spa, buffet, nhạc sống, ...)
const serviceSlotSchema = new mongoose.Schema(
    {
        service_id: { type: mongoose.Schema.Types.ObjectId, ref: "Service", required: true },

        date: { type: Date, required: true },

        label: { type: String, required: true },

        start_time: { type: Date, required: true },

        end_time: { type: Date, default: null },

        max_capacity: { type: Number, required: true, min: 1 },

        booked_count: { type: Number, default: 0, min: 0 },

        status: {
            type: String,
            enum: ["open", "full", "closed"],
            default: "open",
        },

        created_by: { type: mongoose.Schema.Types.ObjectId, default: null },
    },
    {
        timestamps: { createdAt: "created_at", updatedAt: "updated_at" },
    }
);

serviceSlotSchema.index({ service_id: 1, date: 1 });
serviceSlotSchema.index({ status: 1 });

const ServiceSlot = mongoose.models.ServiceSlot || mongoose.model("ServiceSlot", serviceSlotSchema);
export default ServiceSlot;
