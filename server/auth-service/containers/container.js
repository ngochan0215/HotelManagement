import { AuthService } from "../services/authService.js";
import { UserService } from "../services/userService.js";
import User from "../models/User.js";
import { customerClient } from "../clients/customerClient.js";
import Employee from "../models/Employee.js";
import { sendResetPasswordEmail, sendVerificationEmail } from "../utils/emailService.js";
import { EventBus } from "../../shared/messaging/eventBus.js";

class Container {
    constructor() {
        this.eventBus = new EventBus();

        this.authService = new AuthService({
            User,
            customerClient,
            Employee,
            sendResetPasswordEmail,
            eventBus: this.eventBus
        });

        this.userService = new UserService({
            User,
            customerClient,
            Employee,
            sendVerificationEmail
        });
    }

    async init() {
        await this.eventBus.connect();
    }
}

export const container = new Container();