import Receipt from "../models/Receipt.js";
import Transaction from "../models/Transaction.js";

import { ReceiptService } from "../services/receiptService.js";
import { TransactionService } from "../services/transactionService.js";
import { PaymentEventHandler } from "../events/paymentHandler.js";

import { PaymentGatewayFactory } from "../payment/paymentGatewayFactory.js";
import { EventBus } from "../../../shared/messaging/eventBus.js";
import { EventConsumer } from "../../../shared/messaging/eventConsumer.js";
import { sendNotification, sendNotificationsToUsers } from "../../../shared/messaging/notificationPublisher.js";
import { PAYMENT_EVENTS } from "../../../shared/events/paymentEvents.js";

class Container {
    constructor() {
        this.eventBus = new EventBus();

        this.receiptService = new ReceiptService({
            Receipt,
            Transaction,
            eventBus: this.eventBus,
            sendNotification,
            sendNotificationsToUsers,
        });

        this.transactionService = new TransactionService({
            Receipt,
            Transaction,
            paymentGateway: PaymentGatewayFactory.getGateway("payos"),
            eventBus: this.eventBus,
            sendNotification,
            sendNotificationsToUsers,
        });

        this.paymentEventHandler = new PaymentEventHandler(this.receiptService, this.eventBus);
    }

    async init() {
        await this.eventBus.connect({
            queueName: "payment-service-events",
            bindEvents: [
                PAYMENT_EVENTS.CREATE_RECEIPT,
            ]
        });

        const handlers = this.paymentEventHandler.handlers();
        const consumer = new EventConsumer(this.eventBus, handlers);
        await consumer.start();
    }
}

export const container = new Container();
