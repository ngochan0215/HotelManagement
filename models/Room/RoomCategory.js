import mongoose from "mongoose";

const roomCategorySchema = new mongoose.Schema(
  {
    category_name: { type: String, required: true, unique: true, trim: true },
    description: { type: String, required: true, trim: true },
    max_adults: { type: Number, required: true, min: 1 },
    max_children: { type: Number, required: true, min: 0 },
    default_equipment: {
      type: [
        {
          equipment: { type: mongoose.Schema.Types.ObjectId, ref: "EquipmentCategory", required: true },
          quantity: { type: Number, required: true, min: 1 },
        },
      ],
      validate: {
        validator: (arr) => arr.length > 0,
        message: "Phải có ít nhất một tiện nghi mặc định.",
      },
    },
    price: { type: Number, required: true, min: 0 },
  },
  {
    timestamps: { createdAt: "created_at", updatedAt: "updated_at" },
  }
);

roomCategorySchema.index({ price: 1 });
roomCategorySchema.index({ max_adults: 1 });

const RoomCategory = mongoose.models.RoomCategory || mongoose.model("RoomCategory", roomCategorySchema);
export default RoomCategory;
