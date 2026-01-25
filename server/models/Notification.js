import mongoose from "mongoose";

const notificationSchema = new mongoose.Schema(
  {
    user_id: { type: mongoose.Schema.Types.ObjectId, ref: "User", required: true },
    
    content: { type: String, required: true, trim: true },
    title: { type: String, required: true, trim: true },

    type: {
      type: String,
      enum: ["booking", "discount", "system", "equipment", "other"],
      default: "other",
    },

    reference: {
      kind: {
        type: String,
        enum: [
          "Order", "Discount", "Booking", "User", "EquipmentInstall", "EquipmentImport", 
          "CleaningTask",
        ],
      },
      refId: {
        type: mongoose.Schema.Types.ObjectId,
        refPath: "reference.kind",
      },
    },

    status: { type: String, enum: ["read", "unread", "deleted"] },
    read_at: { type: Date, default: null },
    deleted_at: { type: Date, default: null },
  },
  { 
    timestamps: { createdAt: "created_at", updatedAt: "updated_at" }
  }
);

const Notification = mongoose.models.Notification || mongoose.model("Notification", notificationSchema);
export default Notification;
