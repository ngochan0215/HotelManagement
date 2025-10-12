import mongoose from "mongoose";

// phiếu nhập thiết bị
const facilityTicketSchema = new mongoose.Schema(
    {
        employee_id: { type: mongoose.Schema.Types.ObjectId, ref: "Employee", required: true },
        import_day: { type: Date, required: true },
    }, 
    {
        timestamps: { createdAt: "created_at", updatedAt: "updated_at" },
    }
);

const FacilityTicket = mongoose.models.FacilityTicket || mongoose.model("FacilityTicket", facilityTicketSchema);
export default FacilityTicket;
