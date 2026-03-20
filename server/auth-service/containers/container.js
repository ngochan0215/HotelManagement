import { AuthService } from "../services/authService.js";
import { UserService } from "../services/userService.js";
import mailService from "../utils/emailService.js";

import { customerClient } from "../clients/customerClient.js";
import { employeeClient } from "../clients/employeeClient.js";

import { EventBus } from "../../shared/messaging/eventBus.js";
import { defaultAvatars } from "../../shared/constants/defaultAvatars.js";

import User from "../models/User.js";

class Container {
    constructor() {
        this.eventBus = new EventBus();

        this.authService = new AuthService({
            User,
            customerClient, employeeClient,
            mailService,
            defaultAvatars,
            eventBus: this.eventBus
        });

        this.userService = new UserService({
            User,
            customerClient, employeeClient,
            mailService
        });
    }

    async init() {
        await this.eventBus.connect();
    }
}

export const container = new Container();