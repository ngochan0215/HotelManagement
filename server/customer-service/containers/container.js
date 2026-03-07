import { CustomerService } from "../services/customerService.js";
import Customer from "../models/Customer.js";
import PointsLog from "../models/PointsLog.js";
import { userClient } from "../clients/userClient.js";

class Container {
    constructor() {
        this.customerService = new CustomerService({
            Customer,
            PointsLog,
            userClient
        });
    }
}

export const container = new Container();