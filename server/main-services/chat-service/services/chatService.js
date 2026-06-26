import { USER_EVENTS } from "../../../../shared/events/userEvents.js";
import mongoose from "../../../../shared/config/mongoose.js";
import { BOT_USER_ID, BOT_NAME } from "../config/botConfig.js";

export class ChatService {
    constructor({ Conversation, Message, eventBus }) {
        this.Conversation = Conversation;
        this.Message = Message;
        this.eventBus = eventBus;
    }

    // helpers

    async getUserInfo(userId) {
        try {
            const reply = await this.eventBus.safeRequest(USER_EVENTS.GET_USER_INFO, { userId });
            if (!reply?.success) return null;
            return reply.user ?? null;
        } catch (err) {
            throw new Error(`Failed to get user info: ${err.message}`);
        }
    }

    async getUsersInfo(userIds) {
        try {
            const reply = await this.eventBus.safeRequest(USER_EVENTS.GET_USERS_INFO, { userIds });
            if (!reply?.success) return [];
            return reply.users ?? [];
        } catch (err) {
            throw new Error(`Failed to get users info: ${err.message}`);
        }
    }

    async getSupportAgents() {
        try {
            const managerReply = await this.eventBus.safeRequest(USER_EVENTS.GET_MANAGERS, {});
            const managers = (managerReply?.success ? managerReply.managers ?? [] : [])
                .filter(user => user?.isBanned !== true)
                .sort((a, b) => String(b._id).localeCompare(String(a._id)));
            if (managers.length > 0) return managers;

            const adminReply = await this.eventBus.safeRequest(USER_EVENTS.GET_ADMINS, {});
            return (adminReply?.success ? adminReply.admins ?? [] : [])
                .filter(user => user?.isBanned !== true)
                .sort((a, b) => String(b._id).localeCompare(String(a._id)));
        } catch (err) {
            throw new Error(`Failed to get support agents: ${err.message}`);
        }
    }

    // main methods

    async getOrCreateDirectConversation(myUserId, myRole, targetUserId) {
        try {
            console.log(`Attempting to get or create direct conversation between ${myUserId} and ${targetUserId}`);
            const pairKey = [myUserId.toString(), targetUserId.toString()].sort().join("_");

            const existing = await this.Conversation.findOne({ pair_key: pairKey, status: { $ne: "ended" } });
            if (existing) return { conversation: existing, isNew: false };

            const targetUser = await this.getUserInfo(targetUserId);
            if (!targetUser) throw new Error("Target user not found.");

            const conversation = await this.Conversation.create({
                type: "direct",
                pair_key: pairKey,
                participants: [
                    { user_id: myUserId, role: myRole },
                    { user_id: targetUserId, role: targetUser.system_role },
                ],
                created_by: myUserId,
            });

            return { conversation, isNew: true };
        } catch (err) {
            console.log(`Error in getOrCreateDirectConversation: ${err.message}`);
            throw new Error(`Failed to create direct conversation: ${err.message}`);
        }
    }

    async getOrCreateBotConversation(userId, userRole) {
        try {
            const pairKey = `bot_${userId}`;
            const existing = await this.Conversation.findOne({ pair_key: pairKey, status: { $ne: "ended" } });
            if (existing) return { conversation: existing, isNew: false };

            const conversation = await this.Conversation.create({
                type: "bot",
                pair_key: pairKey,
                name: BOT_NAME,
                participants: [
                    { user_id: userId, role: userRole },
                    { user_id: new mongoose.Types.ObjectId(BOT_USER_ID), role: "bot" },
                ],
                created_by: userId,
            });

            return { conversation, isNew: true };
        } catch (err) {
            console.log(`Error in getOrCreateBotConversation: ${err.message}`);
            throw new Error(`Failed to create bot conversation: ${err.message}`);
        }
    }

    async getOrCreateSupportConversation(userId, userRole) {
        try {
            const pairKey = `support_${userId}`;
            const existing = await this.Conversation.findOne({ pair_key: pairKey, status: { $ne: "ended" } });
            if (existing) return { conversation: existing, isNew: false };

            const supportAgents = await this.getSupportAgents();
            const supportAgent = supportAgents[0];
            if (!supportAgent?._id) {
                throw new Error("Chưa có nhân viên hỗ trợ khả dụng.");
            }

            const conversation = await this.Conversation.create({
                type: "support",
                pair_key: pairKey,
                name: "Hỗ trợ khách hàng",
                participants: [
                    { user_id: userId, role: userRole },
                    { user_id: supportAgent._id, role: supportAgent.system_role },
                ],
                created_by: userId,
            });

            return { conversation, isNew: true };
        } catch (err) {
            console.log(`Error in getOrCreateSupportConversation: ${err.message}`);
            throw new Error(`Failed to create support conversation: ${err.message}`);
        }
    }

    async createGroupConversation(creatorId, creatorRole, participantIds, name) {
        try {
            if (!name?.trim()) throw new Error("Group conversation requires a name.");

            const uniqueIds = [...new Set([creatorId.toString(), ...participantIds.map(String)])];
            if (uniqueIds.length < 2) 
                throw new Error("Group conversation requires at least 2 participants.");

            const otherIds = uniqueIds.filter(id => id !== creatorId.toString());
            const users = await this.getUsersInfo(otherIds);

            const usersById = Object.fromEntries(users.map(u => [u._id.toString(), u]));

            const participants = uniqueIds.map(id => {
                if (id === creatorId.toString()) return { user_id: creatorId, role: creatorRole };
                const user = usersById[id];
                if (!user) throw new Error(`User ${id} not found.`);
                return { user_id: user._id, role: user.system_role };
            });

            const conversation = await this.Conversation.create({
                type: "group",
                name: name.trim(),
                participants,
                created_by: creatorId,
            });

            return conversation;
        } catch (err) {
            console.log(`Error in createGroupConversation: ${err.message}`);
            throw new Error(`Failed to create group conversation: ${err.message}`);
        }
    }

    async getMyConversations(userId) {
        try {
            const userObjectId = new mongoose.Types.ObjectId(userId);

            return await this.Conversation.aggregate([
                { $match: { "participants.user_id": userObjectId } },
                { $sort: { "last_message.sent_at": -1, created_at: -1 } },
                {
                    $lookup: {
                        from: "messages",
                        let: { convId: "$_id" },
                        pipeline: [
                            {
                                $match: {
                                    $expr: {
                                        $and: [
                                            { $eq: ["$conversation_id", "$$convId"] },
                                            { $not: { $in: [userObjectId, "$read_by.user_id"] } },
                                            { $ne: ["$is_deleted", true] },
                                        ],
                                    },
                                },
                            },
                            { $count: "count" },
                        ],
                        as: "unread",
                    },
                },
                {
                    $addFields: {
                        unread_count: { $ifNull: [{ $arrayElemAt: ["$unread.count", 0] }, 0] },
                    },
                },
                { $project: { unread: 0 } },
            ]);
        } catch (err) {
            console.log(`Error in getMyConversations: ${err.message}`);
            throw new Error(`Failed to get conversations: ${err.message}`);
        }
    }

    async getConversationById(conversationId, userId) {
        try {
            const conversation = await this.Conversation.findOne({
                _id: conversationId,
                "participants.user_id": userId,
            }).lean();

            if (!conversation) throw new Error("Conversation not found or access denied.");
            return conversation;
        } catch (err) {
            console.log(`Error in getConversationById: ${err.message}`);
            throw new Error(err.message);
        }
    }

    // messages

    async getMessages(conversationId, userId, page = 1, limit = 30) {
        try {
            await this.assertParticipant(conversationId, userId);

            const skip = (page - 1) * limit;
            const messages = await this.Message.find({ conversation_id: conversationId })
                .sort({ created_at: -1 })
                .skip(skip)
                .limit(limit)
                .lean();

            return messages.reverse(); // return oldest-first for display
        } catch (err) {
            console.log(`Error in getMessages: ${err.message}`);
            throw new Error(err.message);
        }
    }

    async sendMessage(conversationId, senderSnapshot, content, type = "text") {
        try {
            const conversation = await this.assertParticipant(conversationId, senderSnapshot.user_id);

            const message = await this.Message.create({
                conversation_id: conversationId,
                sender_id: senderSnapshot.user_id,
                sender_name: senderSnapshot.name,
                sender_avatar: senderSnapshot.avatar,
                sender_role: senderSnapshot.role,
                content: content.trim(),
                type,
                read_by: [{ user_id: senderSnapshot.user_id, read_at: new Date() }],
            });

            await this.Conversation.findByIdAndUpdate(conversationId, {
                last_message: {
                    content: content.trim(),
                    sender_id: senderSnapshot.user_id,
                    sender_name: senderSnapshot.name,
                    sent_at: message.created_at,
                },
            });

            return { message, conversationType: conversation.type };
        } catch (err) {
            console.log(`Error in sendMessage: ${err.message}`);
            throw new Error(`Failed to send message: ${err.message}`);
        }
    }

    async markAsRead(conversationId, userId) {
        try {
            await this.assertParticipant(conversationId, userId);

            const now = new Date();
            await this.Message.updateMany(
                {
                    conversation_id: conversationId,
                    "read_by.user_id": { $ne: userId },
                },
                {
                    $push: { read_by: { user_id: userId, read_at: now } },
                }
            );

            return now;
        } catch (err) {
            console.log(`Error in markAsRead: ${err.message}`);
            throw new Error(`Failed to mark as read: ${err.message}`);
        }
    }

    async assertParticipant(conversationId, userId) {
        try {
            const conversation = await this.Conversation.findOne({
                _id: conversationId,
                "participants.user_id": userId,
            });
            if (!conversation) throw new Error("Conversation not found or access denied.");
            return conversation;
        } catch (err) {
            console.log(`Error in assertParticipant: ${err.message}`);
            throw new Error(err.message);
        }
    }

    async deleteMessage(messageId, conversationId, userId) {
        try {
            const conversation = await this.assertParticipant(conversationId, userId);

            const message = await this.Message.findOne({ _id: messageId, conversation_id: conversationId });
            if (!message) 
                throw new Error("Message not found.");
            if (message.is_deleted) 
                throw new Error("Message already deleted.");

            const isOwner = message.sender_id.toString() === userId.toString();
            const isGroupCreator =
                conversation.type === "group" &&
                conversation.created_by.toString() === userId.toString();

            if (!isOwner && !isGroupCreator)
                throw new Error("You do not have permission to delete this message.");

            message.is_deleted = true;
            message.deleted_at = new Date();
            message.content = "";
            await message.save();

            // Keep last_message in sync: if deleted msg was the last, find the next latest
            if (conversation.last_message?.sent_at?.getTime() === message.created_at?.getTime()) {
                const newLast = await this.Message.findOne({
                    conversation_id: conversationId,
                    is_deleted: { $ne: true },
                }).sort({ created_at: -1 }).lean();

                await this.Conversation.findByIdAndUpdate(conversationId, {
                    last_message: newLast
                        ? { content: newLast.content, sender_id: newLast.sender_id, sender_name: newLast.sender_name, sent_at: newLast.created_at }
                        : { content: null, sender_id: null, sender_name: null, sent_at: null },
                });
            }

            return message;
        } catch (err) {
            console.log(`Error in deleteMessage: ${err.message}`);
            throw new Error(err.message);
        }
    }

    async editMessage(messageId, conversationId, userId, newContent) {
        try {
            const conversation = await this.assertParticipant(conversationId, userId);

            if (!newContent?.trim()) throw new Error("Message content cannot be empty.");

            const message = await this.Message.findOne({ _id: messageId, conversation_id: conversationId });
            if (!message) throw new Error("Message not found.");
            if (message.is_deleted) throw new Error("Cannot edit a deleted message.");
            if (message.sender_id.toString() !== userId.toString())
                throw new Error("You can only edit your own messages.");

            message.content = newContent.trim();
            message.edited_at = new Date();
            await message.save();

            // Keep last_message preview in sync if this was the last message
            if (conversation.last_message?.sent_at?.getTime() === message.created_at?.getTime()) {
                await this.Conversation.findByIdAndUpdate(conversationId, {
                    "last_message.content": newContent.trim(),
                });
            }

            return message;
        } catch (err) {
            console.log(`Error in editMessage: ${err.message}`);
            throw new Error(err.message);
        }
    }

    async renameGroup(conversationId, userId, name) {
        try {
            if (!name?.trim()) throw new Error("Group name cannot be empty.");

            const conversation = await this.Conversation.findById(conversationId);
            if (!conversation) throw new Error("Conversation not found.");
            if (conversation.type !== "group") throw new Error("Only group conversations can be renamed.");

            const isParticipant = conversation.participants.some(
                p => p.user_id.toString() === userId.toString()
            );
            if (!isParticipant) throw new Error("Conversation not found or access denied.");

            if (conversation.created_by.toString() !== userId.toString())
                throw new Error("Only the group creator can rename this conversation.");

            conversation.name = name.trim();
            await conversation.save();
            return conversation;
        } catch (err) {
            console.log(`Error in renameGroup: ${err.message}`);
            throw new Error(err.message);
        }
    }

    async endConversation(conversationId, userId, userRole) {
        try {
            const conversation = await this.Conversation.findById(conversationId);
            if (!conversation) throw new Error("Conversation not found.");

            const isParticipant = conversation.participants.some(
                (participant) => participant.user_id.toString() === userId.toString()
            );
            const isStaff = ["manager", "admin", "receptionist", "customer_service"].includes(String(userRole || "").toLowerCase());

            if (!isParticipant && !isStaff) {
                throw new Error("Conversation not found or access denied.");
            }

            if (conversation.status === "ended") return conversation;

            conversation.status = "ended";
            conversation.ended_at = new Date();
            conversation.ended_by = userId;
            conversation.pair_key = undefined;

            await conversation.save();
            return conversation;
        } catch (err) {
            console.log(`Error in endConversation: ${err.message}`);
            throw new Error(err.message);
        }
    }

    async getConversationIds(userId) {
        try {
            const conversations = await this.Conversation.find(
                { "participants.user_id": userId, status: { $ne: "ended" } },
                { _id: 1 }
            ).lean();
            return conversations.map(c => c._id.toString());
        } catch (err) {
            console.log(`Error in getConversationIds: ${err.message}`);
            throw new Error(`Failed to get conversation IDs: ${err.message}`);
        }
    }
}
