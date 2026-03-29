import mongoose from "../../shared/config/mongoose.js";

const equipmentLogSchema = new mongoose.Schema(
  {
    room_id: {
      type: mongoose.Schema.Types.ObjectId,
      default: null
    },

    equipment_id: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Equipment",
      default: null, required: true
    },

    condition: { 
        type: String, enum: ["new", "good", "maintenance", "broken"], 
        default: "new", required: true 
    },
    
    status: { 
        type: String, enum: ["in-stock", "installing", "in-use", "maintenance", "lost", "disposed", "removing"], 
        default: "in-stock", required: true 
    },

    start_time: {
      type: Date,
      required: true,
    },

    end_time: {
      type: Date,
      default: null,
    },

    note: {
      type: String,
      default: "",
    },

    handled_by: {
      type: mongoose.Schema.Types.ObjectId,
      default: null,
    },
  },
  {
    timestamps: { createdAt: "created_at", updatedAt: "updated_at" },
  }
);

const EquipmentLog = mongoose.models.EquipmentLog || mongoose.model("EquipmentLog", equipmentLogSchema);
export default EquipmentLog;
