import mongoose from "mongoose";

const defaultEquipmentSchema = new mongoose.Schema(
  {
    category_id: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "RoomCategory",
      required: true,
    },
    equipment_category_id: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "EquipmentCategory",
      required: true,
    },
    quantity: {
      type: Number,
      required: true,
      min: 0,
    },
  },
  {
    timestamps: { createdAt: "created_at", updatedAt: "updated_at" },
  }
);

// Một loại thiết bị không được khai báo 2 lần cho cùng một loại phòng
defaultEquipmentSchema.index(
  { category_id: 1, equipment_category_id: 1 },
  { unique: true }
);

const DefaultEquipment = mongoose.models.DefaultEquipment || mongoose.model("DefaultEquipment", defaultEquipmentSchema);
export default DefaultEquipment;
