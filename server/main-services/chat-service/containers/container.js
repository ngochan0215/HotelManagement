import Conversation from "../models/Conversation.js";
import Message from "../models/Message.js";
import { ChatService } from "../services/chatService.js";
import { BotService } from "../services/botService.js";
import { EventBus } from "../../../shared/messaging/eventBus.js";

class Container {
    constructor() {
        this.eventBus = new EventBus();

        this.chatService = new ChatService({
            Conversation,
            Message,
            eventBus: this.eventBus,
        });

        this.botService = new BotService({ eventBus: this.eventBus });
    }

    async init() {
        await this.eventBus.connect();
    }
}

export const container = new Container();
