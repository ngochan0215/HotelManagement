import mongoose from "mongoose";

const notificationSchema = new mongoose.Schema(
    {
        user_id: {
            type: mongoose.Schema.Types.ObjectId, 
            ref: "User",
            required: true,
        },
        type: {
            type: String,
            required: true,
            enum: ["system", "info"],
            default: "info",
        },
        title: {
            type: String,
            required: true,
            trim: true,
        },
        content: {
            type: String,
            required: true,
            trim: true,
        },
        is_read: {
            type: Boolean,
            default: false,
        },
    },
    {
        timestamps: { createdAt: "created_at", updatedAt: "updated_at" },
    }
);

const Notification = mongoose.models.Notification || mongoose.model("Notification", notificationSchema);
export default Notification;