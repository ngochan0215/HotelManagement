import { CustomerService } from "../services/customerService.js";
import Customer from "../models/Customer.js";
import PointsLog from "../models/PointsLog.js";
import { userClient } from "../clients/userClient.js";
import { EventBus } from "../../shared/messaging/eventBus.js";

class Container {
    constructor() {
        this.eventBus = new EventBus();

        this.customerService = new CustomerService({
            Customer,
            PointsLog,
            userClient
        });
    }

    async init() {
        await this.eventBus.connect();

        await this.eventBus.subscribe(async (message) => {
            if (message.event === "USER_CREATED") {
                await this.customerService.createCustomer(message.data);
            }
        });
    }
}

export const container = new Container();