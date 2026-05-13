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
            [USER_EVENTS.RESET_PASSWORD]: this.adminResetPassword.bind(this),
            [USER_EVENTS.GET_MANAGERS]: this.getAllManagers.bind(this)
        }
    }

    // check exists / get user information by user_id
    async getUserInfo(data, msg) {
        try {
            console.log("Handling GET_USER_INFO");
            const { userId } = data;
            const user = await this.userService.getUserById(userId);
            
            this.eventBus.channel.sendToQueue(
                msg.properties.replyTo,
                Buffer.from(JSON.stringify({ success: true, found: !!user, user })),
                {
                    correlationId: msg.properties.correlationId,
                    persistent: false
                }
            );
        } catch (error) {
            this.eventBus.channel.sendToQueue(
                msg.properties.replyTo,
                Buffer.from(JSON.stringify({ success: false, message: error.message })),
                {
                    correlationId: msg.properties.correlationId,
                    persistent: false
                }
            );
        }
    }

    // check exists / get many users information by user_ids
    async getUsersInfo(data, msg) {
        try {
            console.log("Handling GET_USERS_INFO");
            const { userIds } = data;
            const users = await this.userService.getUsersByIds(userIds);

            this.eventBus.channel.sendToQueue(
                msg.properties.replyTo,
                Buffer.from(JSON.stringify({ success: true, users })),
                {
                    correlationId: msg.properties.correlationId,
                    persistent: false
                }
            );
        } catch (error) {
            this.eventBus.channel.sendToQueue(
                msg.properties.replyTo,
                Buffer.from(JSON.stringify({ success: false, message: error.message })),
                {
                    correlationId: msg.properties.correlationId,
                    persistent: false
                }
            );
        }
    }

    async findUserByEmail(data, msg) {
        try {
            console.log("Handling CHECK_EXISTED_EMAIL");
            const { email } = data;
            const user = await this.userService.findUserByEmail(email);

            this.eventBus.channel.sendToQueue(
                msg.properties.replyTo,
                Buffer.from(JSON.stringify({ success: true, found: !!user, user })),
                {
                    correlationId: msg.properties.correlationId,
                    persistent: false
                }
            );
        } catch (error) {
            this.eventBus.channel.sendToQueue(
                msg.properties.replyTo,
                Buffer.from(JSON.stringify({ success: false, message: error.message })),
                {
                    correlationId: msg.properties.correlationId,
                    persistent: false
                }
            );
        }
    }

    async updateUser(data, msg) {
        try {
            console.log("Handling UPDATE_USER");
            const { userId, payload } = data;
            const updatedUser = await this.userService.updateUser(userId, payload);

            this.eventBus.channel.sendToQueue(
                msg.properties.replyTo,
                Buffer.from(JSON.stringify({ success: true, found: !!updatedUser, user: updatedUser })),
                {
                    correlationId: msg.properties.correlationId,
                    persistent: false
                }
            );  
        } catch (error) {
            this.eventBus.channel.sendToQueue(
                msg.properties.replyTo,
                Buffer.from(JSON.stringify({ success: false, message: error.message })),
                {
                    correlationId: msg.properties.correlationId,
                    persistent: false
                }
            );  
        }
    }

    async createUserAccount(data, msg) {
        try {
            console.log("Handling CREATE_ACCOUNT");
            const newUser = await this.authService.createUserAccount(data);

            this.eventBus.channel.sendToQueue(
                msg.properties.replyTo,
                Buffer.from(JSON.stringify({ success: true, found: !!newUser, user: newUser })),
                {
                    correlationId: msg.properties.correlationId,
                    persistent: false
                }
            );  
        } catch (err) {
            this.eventBus.channel.sendToQueue(
                msg.properties.replyTo,
                Buffer.from(JSON.stringify({ success: false, message: err.message })),
                {
                    correlationId: msg.properties.correlationId,
                    persistent: false
                }
            );  
        }
    }

    async adminResetPassword(data, msg) {
        try {
            console.log("Handling ADMIN_RESET_PASSWORD");
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
            this.eventBus.channel.sendToQueue(
                msg.properties.replyTo,
                Buffer.from(JSON.stringify({ success: false, message: err.message })),
                {
                    correlationId: msg.properties.correlationId,
                    persistent: false
                }
            );  
        }
    }

    async getAllManagers(data, msg) {
        try {
            console.log("Handling USER.GET_MANAGERS");
            const managers = await this.userService.getAllUsers({ system_role: "manager" });

            this.eventBus.channel.sendToQueue(
                msg.properties.replyTo,
                Buffer.from(JSON.stringify({ success: true, managers })),
                {
                    correlationId: msg.properties.correlationId,
                    persistent: false
                }
            );
        } catch (error) {
            this.eventBus.channel.sendToQueue(
                msg.properties.replyTo,
                Buffer.from(JSON.stringify({ success: false, message: err.message })),
                {
                    correlationId: msg.properties.correlationId,
                    persistent: false
                }
            );  
        }
    }
}