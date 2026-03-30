import { CUSTOMER_EVENTS } from "../../../shared/events/customerEvents.js";

export class CustomerEventHandler {
    constructor(customerService, eventBus) {
        this.customerService = customerService;
        this.eventBus = eventBus;
    }

    handlers() {
        return {
            [CUSTOMER_EVENTS.REGISTERED]: this.customerRegistered.bind(this)
        }
    }

    async customerRegistered(data, msg) {
        console.log("Handling CUSTOMER_REGISTERED");

        try {
            const { userId, customer } = data;
            const result = await this.customerService.createCustomer(userId, customer);

            this.eventBus.channel.sendToQueue(
                msg.properties.replyTo,
                Buffer.from(JSON.stringify({ success: true, customer: result })),
                {
                    correlationId: msg.properties.correlationId,
                    persistent: false
                }
            );
        } catch (error) {
            this.eventBus.channel.sendToQueue(
                msg.properties.replyTo,
                Buffer.from(JSON.stringify({ success: false, message: error.message })),
                {
                    correlationId: msg.properties.correlationId,
                    persistent: false
                }
            );
        }
    }
}