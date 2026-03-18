import Customer from "../models/Customer.js";
import PointsLog from "../models/PointsLog.js";
import { userClient } from "../clients/userClient.js";
import { CustomerEventHandler } from "../events/customerHandler.js"
import { CustomerService } from "../services/customerService.js";

import { EventBus } from "../../shared/messaging/eventBus.js";
import { EventConsumer } from "../../shared/messaging/eventConsumer.js";
import { CUSTOMER_EVENTS } from "../../shared/events/customerEvents.js";

class Container {
    constructor() {
        this.eventBus = new EventBus();

        this.customerService = new CustomerService({
            Customer,
            PointsLog,
            userClient
        });

        this.customerEventHandler = new CustomerEventHandler(this.customerService);
    }

    async init() {
        await this.eventBus.connect({
            queueName: "customer-service-events",
            bindEvents: [CUSTOMER_EVENTS.REGISTERED]
        });

        const handlers = this.customerEventHandler.handlers();

        const consumer = new EventConsumer(this.eventBus, handlers);
        await consumer.start();
    }
}

export const container = new Container();