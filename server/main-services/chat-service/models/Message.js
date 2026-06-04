import mongoose from "../../../../shared/config/mongoose.js";

const messageSchema = new mongoose.Schema(
    {
        conversation_id: {
            type: mongoose.Schema.Types.ObjectId,
            required: true,
            ref: "Conversation",
        },

        sender_id: {
            type: mongoose.Schema.Types.ObjectId,
            required: true,
        },

        // Snapshot at send time so historical messages always display correctly
        // even if the user later changes their name or avatar
        sender_name: { type: String, required: true },
        sender_avatar: { type: String, default: null },
        sender_role: { type: String, required: true }, // "bot" supported in future

        content: {
            type: String,
            required: function () { return !this.is_deleted; },
            trim: true,
            default: "",
        },

        type: {
            type: String,
            enum: ["text"], // "image", "file", "system" added in future phases
            default: "text",
        },

        read_by: [
            {
                user_id: { type: mongoose.Schema.Types.ObjectId, required: true },
                read_at: { type: Date, default: Date.now },
            },
        ],

        is_deleted: { type: Boolean, default: false },
        deleted_at: { type: Date, default: null },
        edited_at: { type: Date, default: null },
    },
    {
        timestamps: { createdAt: "created_at", updatedAt: false },
    }
);

messageSchema.index({ conversation_id: 1, created_at: -1 });

const Message = mongoose.models.Message || mongoose.model("Message", messageSchema);
export default Message;
