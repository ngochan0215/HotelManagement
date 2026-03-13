import { CustomerService } from "../services/customerService.js";
import Customer from "../models/Customer.js";
import PointsLog from "../models/PointsLog.js";
import { userClient } from "../clients/userClient.js";

import { EventBus } from "../../shared/messaging/eventBus.js";
import { EventConsumer } from "../../shared/messaging/eventConsumer.js";
import { USER_EVENTS } from "../../shared/events/userEvents.js";
import { userCreatedHandler } from "../events/userCreated.handler.js"

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

        const handlers = {
            [USER_EVENTS.CREATED]: userCreatedHandler(this.customerService),
        };

        const consumer = new EventConsumer(this.eventBus, handlers);
        await consumer.start();
    }
}

export const container = new Container();