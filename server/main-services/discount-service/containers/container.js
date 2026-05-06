import Discount from "../models/Discount.js";
import Voucher from "../models/Voucher.js";

import { DiscountService } from "../services/discountService.js";
import { VoucherService } from "../services/voucherService.js";

import { DiscountEventHandler } from "../events/discountHandler.js";

import { EventBus } from "../../../shared/messaging/eventBus.js";
import { EventConsumer } from "../../../shared/messaging/eventConsumer.js";
import { DISCOUNT_EVENTS } from "../../../shared/events/discountEvents.js";

class Container {
    constructor() {
        this.eventBus = new EventBus();

        this.discountService = new DiscountService({
            Discount,
            eventBus: this.eventBus
        });

        this.voucherService = new VoucherService({
            Voucher,
            eventBus: this.eventBus
        });

        this.discountEventHandler = new DiscountEventHandler(this.discountService, this.eventBus);
    }

    async init() {
        await this.eventBus.connect({
            queueName: "discount-service-events",
            bindEvents: [
                DISCOUNT_EVENTS.CHECK_EXISTS
            ]
        });

        const handlers = this.discountEventHandler.handlers();
        const consumer = new EventConsumer(this.eventBus, handlers);
        await consumer.start();
    }
}

export const container = new Container();