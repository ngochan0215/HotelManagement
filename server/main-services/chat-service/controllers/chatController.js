import { container } from "../containers/container.js";

export class ChatController {
    constructor() {
        this.chatService = container.chatService;
    }

    getMyConversations = async (req, res) => {
        try {
            const conversations = await this.chatService.getMyConversations(req.user.userId);
            return res.status(200).json({ success: true, conversations });
        } catch (err) {
            return res.status(500).json({ success: false, message: err.message });
        }
    };

    createConversation = async (req, res) => {
        try {
            const { type, target_user_id, participant_ids, name } = req.body;
            const myId = req.user.userId;
            const myRole = req.user.role;

            let conversation;

            if (type === "direct") {
                if (!target_user_id) {
                    return res.status(400).json({ success: false, message: "target_user_id is required." });
                }
                if (target_user_id === myId?.toString()) {
                    return res.status(400).json({ success: false, message: "Cannot create a conversation with yourself." });
                }
                const result = await this.chatService.getOrCreateDirectConversation(myId, myRole, target_user_id);
                conversation = result.conversation;
            } else if (type === "group") {
                if (!participant_ids?.length) {
                    return res.status(400).json({ success: false, message: "participant_ids is required for group conversations." });
                }
                conversation = await this.chatService.createGroupConversation(myId, myRole, participant_ids, name);
            } else {
                return res.status(400).json({ success: false, message: "type must be 'direct' or 'group'." });
            }

            return res.status(201).json({ success: true, conversation });
        } catch (err) {
            return res.status(500).json({ success: false, message: err.message });
        }
    };

    getMessages = async (req, res) => {
        try {
            const { id } = req.params;
            const page = parseInt(req.query.page) || 1;
            const limit = Math.min(parseInt(req.query.limit) || 30, 100);

            const messages = await this.chatService.getMessages(id, req.user.userId, page, limit);
            return res.status(200).json({ success: true, messages, page, limit });
        } catch (err) {
            const status = err.message.includes("access denied") ? 403 : 500;
            return res.status(status).json({ success: false, message: err.message });
        }
    };

    getConversationById = async (req, res) => {
        try {
            const conversation = await this.chatService.getConversationById(req.params.id, req.user.userId);
            return res.status(200).json({ success: true, conversation });
        } catch (err) {
            const status = err.message.includes("access denied") ? 403 : 500;
            return res.status(status).json({ success: false, message: err.message });
        }
    };
}
