import mongoose from "mongoose";

const transactionSchema = new mongoose.Schema(
    {
        user_id: {
            type: mongoose.Schema.Types.ObjectId,
            ref: "User",
            required: true,
        },
        booking_id: {
            type: mongoose.Schema.Types.ObjectId,
            ref: "Booking",
            index: true,
        },
        receipt_id: {
            type: mongoose.Schema.Types.ObjectId,
            ref: "Receipt",
            index: true,
        },

        // payos
        booking_code: { type: Number, required: true, unique: true },
        payos_payment_id: { type: String, index: true }, // payment link id
        reference_id: { type: String, index: true },    // payout reference id

        // money
        description: { type: String, trim: true },
        amount: { type: Number, required: true },

        status: { type: String, enum: ["pending", "completed", "failed"], default: "pending", index: true },
        type: { type: String, enum: ["payment", "payout"], required: true, index: true },

        raw_response: { type: mongoose.Schema.Types.Mixed },
        
        completed_at: { type: Date },
        failed_reason: { type: String },
    },
    { 
        timestamps: { createdAt: "created_at", updatedAt: "updated_at" } 
    }
);

transactionSchema.index({ user_id: 1});

const Transaction = mongoose.models.Transaction || mongoose.model("Transaction", transactionSchema);
export default Transaction;
