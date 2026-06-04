import mongoose from "../../../../shared/config/mongoose.js";

const conversationSchema = new mongoose.Schema(
    {
        type: {
            type: String,
            enum: ["direct", "group"],
            required: true,
        },

        // Only for direct conversations — sorted pair of user IDs joined by "_"
        // Unique index prevents duplicate 1:1 conversations
        pair_key: {
            type: String,
            default: null,
        },

        name: {
            type: String,
            default: null, // only used for group conversations
        },

        participants: [
            {
                user_id: { type: mongoose.Schema.Types.ObjectId, required: true },
                role: { type: String, required: true },
                joined_at: { type: Date, default: Date.now },
            },
        ],

        created_by: {
            type: mongoose.Schema.Types.ObjectId,
            required: true,
        },

        // Denormalized snapshot of the last message for conversation list rendering
        last_message: {
            content: { type: String, default: null },
            sender_id: { type: mongoose.Schema.Types.ObjectId, default: null },
            sender_name: { type: String, default: null },
            sent_at: { type: Date, default: null },
        },
    },
    {
        timestamps: { createdAt: "created_at", updatedAt: "updated_at" },
    }
);

conversationSchema.index({ "participants.user_id": 1 });
conversationSchema.index({ pair_key: 1 }, { unique: true, sparse: true });

const Conversation = mongoose.models.Conversation || mongoose.model("Conversation", conversationSchema);
export default Conversation;
