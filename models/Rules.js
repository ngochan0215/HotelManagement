import mongoose from "mongoose";

// bảng quy định
const ruleSchema = new mongoose.Schema(
    {
        percentage: { type: Number, default: 0 },
        min_import: { type: Number, default: 0 },
        max_import: { type: Number, default: 0 },
        min_storage: { type: Number, default: 0 },
        max_storage: { type: Number, default: 0 },
        max_shift: { type: Number, default: 0 },        
    }, 
    {
        timestamps: { createdAt: "created_at", updatedAt: "updated_at" },
    }
);

const Rule = mongoose.models.rule || mongoose.model("rule", ruleSchema);
export default Rule;
