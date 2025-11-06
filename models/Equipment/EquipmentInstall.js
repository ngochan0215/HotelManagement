import mongoose from "mongoose";

// phiếu lắp đặt thiết bị trong phòng
const facilityInstallSchema = new mongoose.Schema(
    {
        employee_id: { type: mongoose.Schema.Types.ObjectId, ref: "Employee", required: true },
        install_day: { type: Date, required: true },
    }, 
    {
        timestamps: { createdAt: "created_at", updatedAt: "updated_at" },
    }
);

const FacilityInstall = mongoose.models.FacilityInstall || mongoose.model("FacilityInstall", facilityInstallSchema);
export default FacilityInstall;
