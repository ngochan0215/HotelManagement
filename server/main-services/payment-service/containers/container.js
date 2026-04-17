import Receipt from "../models/Receipt.js";
import Transaction from "../models/Transaction.js";

import { ReceiptService } from "../services/receiptService.js";
import { TransactionService } from "../services/transactionService.js";

import { payOSpayin } from "../config/payos.js";
import { EventBus } from "../../../shared/messaging/eventBus.js";
import { sendNotification, sendNotificationsToUsers } from "../../../shared/messaging/notificationPublisher.js";

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
            payOSpayin: payOSpayin,
            eventBus: this.eventBus,
            sendNotification,
            sendNotificationsToUsers,
        });
    }

    async init() {
        await this.eventBus.connect();
    }
}

export const container = new Container();
