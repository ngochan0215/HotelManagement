import { CleaningService } from "../services/cleaningService.js";
import { CleaningEventHandler } from "../events/cleaningHandler.js";
import { EventBus } from "../../../shared/messaging/eventBus.js";
import { EventConsumer } from "../../../shared/messaging/eventConsumer.js";
import { CLEANING_EVENTS } from "../../../shared/events/cleaningEvents.js";
import CleaningTask from "../models/CleaningTask.js";

import { sendNotification, sendNotificationsToUsers } from "../../../shared/messaging/notificationPublisher.js";

class Container {
    constructor() {
        this.eventBus = new EventBus();

        this.cleaningService = new CleaningService({
            CleaningTask,
            eventBus: this.eventBus,
            sendNotification, sendNotificationsToUsers
        });

        this.cleaningEventHandler = new CleaningEventHandler(this.cleaningService, this.eventBus);
    }

    async init() {
        await this.eventBus.connect({
            queueName: "cleaning-service-events",
            bindEvents: [
                CLEANING_EVENTS.CREATE_TASK,
            ]
        });

        const handlers = this.cleaningEventHandler.handlers();
        const consumer = new EventConsumer(this.eventBus, handlers);
        await consumer.start();
    }
}

export const container = new Container();