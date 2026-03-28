import mongoose from "../../shared/config/mongoose.js";

// phiếu nhập thiết bị
const importTicketSchema = new mongoose.Schema(
    {
        employee_id: { type: mongoose.Schema.Types.ObjectId, required: true },
        
        import_date: { type: Date, required: true },
        
        status: { type: String, enum: ["pending", "waiting_confirm", "completed", "expired"], default: "pending" },
        
        confirmed_by: { type: mongoose.Schema.Types.ObjectId },
        
        confirmed_at: { type: Date },
        
        total_fee: { type: Number, default: 0 }
    }, 
    {
        timestamps: { createdAt: "created_at", updatedAt: "updated_at" },
    }
);

importTicketSchema.index({ import_date: 1 });
importTicketSchema.index({ status: 1 });

const ImportTicket = mongoose.models.ImportTicket || mongoose.model("ImportTicket", importTicketSchema);
export default ImportTicket;
