import mongoose from "mongoose";

// phiếu nhập sản phẩm (ăn uống)
const goodTicketSchema = new mongoose.Schema(
    {
        employee_id: { type: mongoose.Schema.Types.ObjectId, ref: "Employee", required: true },
        import_date: { type: Date, required: true },
        status: { type: String, enum: ["pending", "completed"], default: "pending" }
    }, 
    {
        timestamps: { createdAt: "created_at", updatedAt: "updated_at" },
    }
);

const GoodTicket = mongoose.models.goodTicket || mongoose.model("goodTicket", goodTicketSchema);
export default GoodTicket;
