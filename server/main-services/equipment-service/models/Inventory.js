import mongoose from "../../../shared/config/mongoose.js";

const inventorySchema = new mongoose.Schema({
    category_id: {
        type: mongoose.Schema.Types.ObjectId,
        ref: "EquipmentCategory",
        required: true
    },

    warehouse: {
        type: String,
        enum: ["housekeeping", "fb", "technical"],
        required: true
    },

    quantity: {
        type: Number,
        default: 0
    },

    min_quantity: {
        type: Number,
        default: 0
    }

}, { timestamps: true });


const Inventory = mongoose.models.Inventory || mongoose.model("Inventory", inventorySchema);
export default Inventory;
