import mongoose from "mongoose";

// chi tiết phiếu đền bù thiết bị
const compensateDetailSchema = new mongoose.Schema(
    {
        ticket_id: {type: mongoose.Schema.Types.ObjectId, ref: "CompensateTicket", required: true },
        facility_id: { type: mongoose.Schema.Types.ObjectId, ref: "Facility", required: true },
        count: { type: Number, default: 1, required: true },
        broken_state: { type: String, required: true },
    }, 
    {
        timestamps: { createdAt: "created_at", updatedAt: "updated_at" },
    }
);

const CompensateDetail = mongoose.models.compensateDetail || mongoose.model("compensateDetail", compensateDetailSchema);
export default CompensateDetail;
