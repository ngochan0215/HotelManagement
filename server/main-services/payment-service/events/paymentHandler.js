import { PAYMENT_EVENTS } from "../../../shared/events/paymentEvents.js";

export class PaymentEventHandler {
    constructor(receiptService, eventBus) {
        this.receiptService = receiptService;
        this.eventBus = eventBus;
    }

    handlers() {
        return {
            [PAYMENT_EVENTS.CREATE_RECEIPT]: this.createReceipt.bind(this),
            [PAYMENT_EVENTS.GET_RECEIPT_BY_BOOKING]: this.getReceiptByBooking.bind(this),
        };
    }

    async getReceiptByBooking(data, msg) {
        try {
            const result = await this.receiptService.getReceiptInfoByBooking(data);
            this.eventBus.channel.sendToQueue(
                msg.properties.replyTo,
                Buffer.from(JSON.stringify({ success: true, ...result })),
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
