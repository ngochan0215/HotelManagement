import Customer from "../models/Customer.js";
import PointsLog from "../models/PointsLog.js";

import { CustomerEventHandler } from "../events/customerHandler.js"
import { CustomerService } from "../services/customerService.js";

import { EventBus } from "../../../shared/messaging/eventBus.js";
import { EventConsumer } from "../../../shared/messaging/eventConsumer.js";
import { CUSTOMER_EVENTS } from "../../../shared/events/customerEvents.js";

class Container {
    constructor() {
        this.eventBus = new EventBus();

        this.customerService = new CustomerService({
            Customer,
            PointsLog,
            eventBus: this.eventBus
        });

        this.customerEventHandler = new CustomerEventHandler(this.customerService, this.eventBus);
    }

    async init() {
        await this.eventBus.connect({
            queueName: "customer-service-events",
            bindEvents: [
                CUSTOMER_EVENTS.REGISTERED,
                CUSTOMER_EVENTS.CHECK_EXISTS,  
                CUSTOMER_EVENTS.CHECK_EXISTS_USERID,
                CUSTOMER_EVENTS.GET_INFOS_USERIDS,
                CUSTOMER_EVENTS.GET_INFOS_IDS
            ]
        });

        const handlers = this.customerEventHandler.handlers();
        const consumer = new EventConsumer(this.eventBus, handlers);
        await consumer.start();
    }
}

export const container = new Container();