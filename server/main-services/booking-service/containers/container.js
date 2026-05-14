import Booking from "../models/Booking.js";
import BookingDetail from "../models/BookingDetail.js";
import BookingStatusLog from "../models/BookingStatusLog.js";
import BookingCancellation from "../models/BookingCancellation.js";
import Review from "../models/Review.js";

import { BookingService } from "../services/bookingService.js";
import { ReviewService } from "../services/reviewService.js";
import { BookingStatisticService } from "../services/statisticService.js";
import { BookingEventHandler } from "../events/bookingHandler.js";

import { EventBus } from "../../../shared/messaging/eventBus.js";
import { EventConsumer } from "../../../shared/messaging/eventConsumer.js";
import { sendNotification, sendNotificationsToUsers } from "../../../shared/messaging/notificationPublisher.js";
import { BOOKING_EVENTS } from "../../../shared/events/bookingEvents.js";

class Container {
    constructor() {
        this.eventBus = new EventBus();

        this.bookingService = new BookingService({
            Booking, BookingDetail, BookingStatusLog, BookingCancellation,
            eventBus: this.eventBus,
            sendNotification, sendNotificationsToUsers
        });

        this.reviewService = new ReviewService({
            Review, Booking, BookingDetail,
            eventBus: this.eventBus
        });

        this.bookingStatisticService = new BookingStatisticService({
            Booking, BookingDetail, BookingStatusLog, BookingCancellation,
            eventBus: this.eventBus
        });

        this.bookingEventHandler = new BookingEventHandler(this.bookingService, this.eventBus);
    }

     async init() {
        await this.eventBus.connect({
            queueName: "booking-service-events",
            bindEvents: [
                BOOKING_EVENTS.CHECK_EXISTS_ID,
                BOOKING_EVENTS.GET_DETAILS_BOOKING_ID,
                BOOKING_EVENTS.GET_DETAILS_BOOKING_IDS,
                
                BOOKING_EVENTS.GET_BOOKINGS_BY_IDS,
                BOOKING_EVENTS.CONFIRM_FROM_PAYMENT,
                BOOKING_EVENTS.GET_ACTIVE_BOOKINGS,

                BOOKING_EVENTS. GET_CALENDAR_DATA,
                BOOKING_EVENTS.GET_BOOKINGS_CUSTOMER_REPORT,
                BOOKING_EVENTS.GET_LOGS_CUSTOMER_REPORT,

                BOOKING_EVENTS.GET_TOP_BOOKED_ROOM_CATEGORIES
            ]
        });

        const handlers = this.bookingEventHandler.handlers();
        const consumer = new EventConsumer(this.eventBus, handlers);
        await consumer.start();
    }
}

export const container = new Container();