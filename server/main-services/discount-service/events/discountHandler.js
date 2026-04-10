import { DISCOUNT_EVENTS } from "../../../shared/events/discountEvents.js";

export class DiscountEventHandler {
    constructor(discountService, eventBus) {
        this.discountService = discountService;
        this.eventBus = eventBus;
    }

    handlers() {
        return {
            [DISCOUNT_EVENTS.CHECK_EXISTS]: this.getDiscountById.bind(this),
        }
    }

    // get discount info (check exists) by discount_id
    async getDiscountById(data, msg) {
        console.log("Handling DISCOUNT_CHECK_EXISTS");
        const { discountId } = data;
        const discount = await this.discountService.getDiscountById(discountId);

        this.eventBus.channel.sendToQueue(
            msg.properties.replyTo,
            Buffer.from(JSON.stringify({ found: !!discount, discount })),
            {
                correlationId: msg.properties.correlationId,
                persistent: false
            }
        )
    }
};