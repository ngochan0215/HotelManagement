import { USER_EVENTS } from "../../../shared/events/userEvents.js";

export class UserEventHandler {
    constructor(authService, userService, eventBus) {
        this.authService = authService;
        this.userService = userService;
        this.eventBus = eventBus;
    }

    handlers() {
        return {
            [USER_EVENTS.GET_USER_INFO]: this.getUserInfo.bind(this),
            [USER_EVENTS.GET_USERS_INFO]: this.getUsersInfo.bind(this),
            [USER_EVENTS.CHECK_EXISTED_EMAIL]: this.findUserByEmail.bind(this),
            [USER_EVENTS.UPDATE_USER]: this.updateUser.bind(this),
            [USER_EVENTS.CREATE_ACCOUNT]: this.createUserAccount.bind(this),
            [USER_EVENTS.RESET_PASSWORD]: this.adminResetPassword.bind(this)
        }
    }

    async getUserInfo(data, msg) {
        console.log("Handling GET_USER_INFO");
        const { userId } = data;
        const user = await this.userService.getUserById(userId);
        
        this.eventBus.channel.sendToQueue(
            msg.properties.replyTo,
            Buffer.from(JSON.stringify({ found: !!user, user })),
            {
                correlationId: msg.properties.correlationId,
                persistent: false
            }
        );
    }

    async getUsersInfo(data, msg) {
        console.log("Handling GET_USERS_INFO");
        const { userIds } = data;
        const users = await this.userService.getUsersByIds(userIds);

        this.eventBus.channel.sendToQueue(
            msg.properties.replyTo,
            Buffer.from(JSON.stringify({ users })),
            {
                correlationId: msg.properties.correlationId,
                persistent: false
            }
        );
    }

    async findUserByEmail(data, msg) {
        console.log("Handling CHECK_EXISTED_EMAIL");
        const { email } = data;
        const user = await this.userService.findUserByEmail(email);

        this.eventBus.channel.sendToQueue(
            msg.properties.replyTo,
            Buffer.from(JSON.stringify({ found: !!user, user })),
            {
                correlationId: msg.properties.correlationId,
                persistent: false
            }
        );
    }

    async updateUser(data, msg) {
        console.log("Handling UPDATE_USER");
        const { userId, payload } = data;
        const updatedUser = await this.userService.updateUser(userId, payload);

        this.eventBus.channel.sendToQueue(
            msg.properties.replyTo,
            Buffer.from(JSON.stringify({ success: !!updatedUser, user: updatedUser })),
            {
                correlationId: msg.properties.correlationId,
                persistent: false
            }
        );  
    }

    async createUserAccount(data, msg) {
        console.log("Handling CREATE_ACCOUNT");

        try {
            const newUser = await this.authService.createUserAccount(data);

            this.eventBus.channel.sendToQueue(
                msg.properties.replyTo,
                Buffer.from(JSON.stringify({ success: !!newUser, user: newUser })),
                {
                    correlationId: msg.properties.correlationId,
                    persistent: false
                }
            );  
        } catch (err) {
            this.eventBus.channel.sendToQueue(
                msg.properties.replyTo,
                Buffer.from(JSON.stringify({ success: false, error: err.message })),
                {
                    correlationId: msg.properties.correlationId,
                    persistent: false
                }
            );  
        }
    }

    async adminResetPassword(data, msg) {
        console.log("Handling ADMIN_RESET_PASSWORD");
        try {
            console.log("Data received for adminResetPassword:", data);
            const success = await this.authService.adminResetPassword(data);

            this.eventBus.channel.sendToQueue(
                msg.properties.replyTo,
                Buffer.from(JSON.stringify({ success })),
                {
                    correlationId: msg.properties.correlationId,
                    persistent: false
                }
            );  
        } catch (err) {
            console.log("Error in adminResetPassword:", err);
            this.eventBus.channel.sendToQueue(
                msg.properties.replyTo,
                Buffer.from(JSON.stringify({ success: false, error: err.message })),
                {
                    correlationId: msg.properties.correlationId,
                    persistent: false
                }
            );  
        }
    }
}