import { AuthService } from "../services/authService.js";
import { UserService } from "../services/userService.js";
import mailService from "../utils/emailService.js";

import { UserEventHandler } from "../events/authHandler.js";
import { EventBus } from "../../../shared/messaging/eventBus.js";
import { EventConsumer } from "../../../shared/messaging/eventConsumer.js";
import { sendNotification } from "../../../shared/messaging/notificationPublisher.js";

import { defaultAvatars } from "../../../shared/constants/defaultAvatars.js";
import User from "../models/User.js";
import { USER_EVENTS } from "../../../shared/events/userEvents.js";

class Container {
    constructor() {
        this.eventBus = new EventBus();

        this.authService = new AuthService({
            User,
            mailService,
            defaultAvatars,
            eventBus: this.eventBus
        });

        this.userService = new UserService({
            User,
            mailService,
            eventBus: this.eventBus,
            sendNotification
        });

        this.userEventHandler = new UserEventHandler(this.authService, this.userService, this.eventBus);
    }

    async init() {
        await this.eventBus.connect({
            queueName: "user-service-events",
            bindEvents: [
                USER_EVENTS.GET_USERS_INFO,
                USER_EVENTS.GET_USER_INFO,
                USER_EVENTS.CHECK_EXISTED_EMAIL,
                USER_EVENTS.UPDATE_USER,
                USER_EVENTS.CREATE_ACCOUNT,
                USER_EVENTS.RESET_PASSWORD,
                USER_EVENTS.GET_MANAGERS,
                USER_EVENTS.GET_ADMINS,
            ]
        });

        const handlers = this.userEventHandler.handlers();
        const consumer = new EventConsumer(this.eventBus, handlers);
        await consumer.start();
    }
}

export const container = new Container();