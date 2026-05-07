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
            [CUSTOMER_EVENTS.CHECK_EXISTS_USERID]: this.checkExistsByUserId.bind(this),
            [CUSTOMER_EVENTS.GET_INFOS_USERIDS]: this.getInfosByUserIds.bind(this),
            [CUSTOMER_EVENTS.GET_INFOS_IDS]: this.getInfosByIds.bind(this)
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

    // get one customer information by customer_id
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

    // get one customer information by user_id
    async checkExistsByUserId(data, msg) {
        try {
            const { customer_user_id } = data;
            const exists = await this.customerService.getCustomerByUserId(customer_user_id);

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

    // get multiple customers information by user_ids
    async getInfosByUserIds(data, msg) {
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

    // get multiple customers information by customer_ids
    async getInfosByIds(data, msg) {
        try {
            const { customerIds } = data;
            const customers = await this.customerService.getCustomersByIds(customerIds);

            this.eventBus.channel.sendToQueue(
                msg.properties.replyTo,
                Buffer.from(JSON.stringify({ success: true, found: !!customers, customers })),
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