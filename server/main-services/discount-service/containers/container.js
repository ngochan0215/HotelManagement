import Discount from "../models/Discount.js";

import { DiscountService } from "../services/discountService.js";
import { DiscountEventHandler } from "../events/discountHandler.js";
import { EventBus } from "../../../shared/messaging/eventBus.js";
import { EventConsumer } from "../../../shared/messaging/eventConsumer.js";

class Container {
    constructor() {
        this.eventBus = new EventBus();

        this.discountService = new DiscountService({
            Discount,
            eventBus: this.eventBus
        });

        this.discountEventHandler = new DiscountEventHandler(this.discountService, this.eventBus);
    }

    async init() {
        await this.eventBus.connect({
        });

        // const handlers = this.customerEventHandler.handlers();
        // const consumer = new EventConsumer(this.eventBus, handlers);
        // await consumer.start();
    }
}

export const container = new Container();