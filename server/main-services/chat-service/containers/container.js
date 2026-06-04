import Conversation from "../models/Conversation.js";
import Message from "../models/Message.js";
import { ChatService } from "../services/chatService.js";
import { EventBus } from "../../../shared/messaging/eventBus.js";

class Container {
    constructor() {
        this.eventBus = new EventBus();

        this.chatService = new ChatService({
            Conversation,
            Message,
            eventBus: this.eventBus,
        });
    }

    async init() {
        // Publisher-only connection — chat-service makes safeRequests to auth-service
        // but does not consume any events from RabbitMQ in Phase 1
        await this.eventBus.connect();
    }
}

export const container = new Container();
