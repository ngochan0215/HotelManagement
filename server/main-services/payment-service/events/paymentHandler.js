import { PAYMENT_EVENTS } from "../../../shared/events/paymentEvents.js";

export class PaymentEventHandler {
    constructor(receiptService, eventBus) {
        this.receiptService = receiptService;
        this.eventBus = eventBus;
    }

    handlers() {
        return {
            [PAYMENT_EVENTS.CREATE_RECEIPT]: this.createReceipt.bind(this),
        };
    }

    async createReceipt(data, msg) {
        try {
            console.log("Handling PAYMENT_EVENTS.CREATE_RECEIPT");
            const receipt = await this.receiptService.createReceiptFromBooking(data);
            this.eventBus.channel.sendToQueue(
                msg.properties.replyTo,
                Buffer.from(JSON.stringify({ success: true, receipt })),
                { correlationId: msg.properties.correlationId, persistent: false }
            );
        } catch (error) {
            this.eventBus.channel.sendToQueue(
                msg.properties.replyTo,
                Buffer.from(JSON.stringify({ success: false, message: error.message })),
                { correlationId: msg.properties.correlationId, persistent: false }
            );
        }
    }
}
