import { CUSTOMER_EVENTS } from "../../../shared/events/customerEvents.js";

export class CustomerEventHandler {
    constructor(customerService, eventBus) {
        this.customerService = customerService;
        this.eventBus = eventBus;
    }

    handlers() {
        return {
            [CUSTOMER_EVENTS.REGISTERED]: this.customerRegistered.bind(this),
            [CUSTOMER_EVENTS.CHECK_EXISTS]: this.customerCheckExists.bind(this),
            [CUSTOMER_EVENTS.GET_INFOS_USERIDS]: this.customerGetInfosByUserIds.bind(this)
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

    async customerCheckExists(data, msg) {
        try {
            const { customerId } = data;
            const exists = await this.customerService.findCustomerById(customerId);

            this.eventBus.channel.sendToQueue(
                msg.properties.replyTo,
                Buffer.from(JSON.stringify({ success: true, found: !!exists, customer: exists })),
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

    async customerGetInfosByUserIds(data, msg) {
        try {
            const { customerUserIds } = data;
            const exists = await this.customerService.getCustomersByUserIds(customerUserIds);

            this.eventBus.channel.sendToQueue(
                msg.properties.replyTo,
                Buffer.from(JSON.stringify({ success: true, found: !!exists, customers: exists })),
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