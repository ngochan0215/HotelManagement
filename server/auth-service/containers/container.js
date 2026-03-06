import { AuthService } from "../services/authService.js";
import User from "../models/User.js";
import Customer from "../../customer-service/models/Customer.js";
import Employee from "../../employee-service/models/Employee.js";
import { sendResetPasswordEmail } from "../utils/emailService.js";

class Container {
    constructor() {
        this.authService = new AuthService({
            User,
            Customer,
            Employee,
            sendResetPasswordEmail
        });
    }
}

export const container = new Container();