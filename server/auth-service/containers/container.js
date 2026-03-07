import { AuthService } from "../services/authService.js";
import { UserService } from "../services/userService.js";
import User from "../models/User.js";
import { customerClient } from "../clients/customerClient.js";
import Employee from "../../employee-service/models/Employee.js";
import { sendResetPasswordEmail, sendVerificationEmail } from "../utils/emailService.js";

class Container {
    constructor() {
        this.authService = new AuthService({
            User,
            customerClient,
            Employee,
            sendResetPasswordEmail
        });

        this.userService = new UserService({
            User,
            customerClient,
            Employee,
            sendVerificationEmail
        });
    }
}

export const container = new Container();