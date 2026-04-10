import Booking from "../models/Booking.js";
import BookingDetail from "../models/BookingDetail.js";
import BookingStatusLog from "../models/BookingStatusLog.js";
import BookingCancellation from "../models/BookingCancellation.js";

import { BookingService } from "../services/bookingService.js";

import { EventBus } from "../../../shared/messaging/eventBus.js";
import { EventConsumer } from "../../../shared/messaging/eventConsumer.js";
import { sendNotification, sendNotificationsToUsers } from "../../../shared/messaging/notificationPublisher.js";

class Container {
    constructor() {
        this.eventBus = new EventBus();

        this.bookingService = new BookingService({
            Booking, BookingDetail, BookingStatusLog, BookingCancellation,
            eventBus: this.eventBus,
            sendNotification, sendNotificationsToUsers
        });
    }

     async init() {
        await this.eventBus.connect({
            // queueName: "booking-service-events",
            // bindEvents: [
            // ]
        });

        // const handlers = this.userEventHandler.handlers();
        // const consumer = new EventConsumer(this.eventBus, handlers);
        // await consumer.start();
    }
}

export const container = new Container();