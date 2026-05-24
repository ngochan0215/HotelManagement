import mongoose from "mongoose";

// phiếu nhập sản phẩm (ăn uống)
const goodTicketSchema = new mongoose.Schema(
    {
        employee_id: { type: mongoose.Schema.Types.ObjectId, ref: "Employee", required: true },
        import_date: { type: Date, required: true },
        status: { type: String, enum: ["pending", "waiting_confirm", "completed", "expired"], default: "pending" },
        confirmed_by: { type: mongoose.Schema.Types.ObjectId },
        confirmed_at: { type: Date }
    },
    {
        timestamps: { createdAt: "created_at", updatedAt: "updated_at" },
    }
);

goodTicketSchema.index({ import_date: 1 });
goodTicketSchema.index({ status: 1 });

const GoodTicket = mongoose.models.goodTicket || mongoose.model("goodTicket", goodTicketSchema);
export default GoodTicket;
