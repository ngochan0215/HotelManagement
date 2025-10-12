import mongoose from "mongoose";

// chi tiết phiếu nhập thiết bị (một phiếu có thể nhập nhiều thiết bị)
const facilityImportSchema = new mongoose.Schema(
    {
        ticket_id: { type: mongoose.Schema.Types.ObjectId, ref: "FacilityTicket", required: true },
        facility_id: { type: mongoose.Schema.Types.ObjectId, ref: "Facility", required: true },
        import_price: { type: Number, default: 0 },
        import_quantity: { type: Number, default: 0 }, 
    }, 
    {
        timestamps: { createdAt: "created_at", updatedAt: "updated_at" },
    }
);

const FacilityImport = mongoose.models.FacilityImport || mongoose.model("FacilityImport", facilityImportSchema);
export default FacilityImport;
