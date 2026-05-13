import { BOOKING_EVENTS } from "../../../shared/events/bookingEvents.js";

export class BookingEventHandler {
    constructor(bookingService, eventBus) {
        this.bookingService = bookingService;
        this.eventBus = eventBus;
    }

    handlers() {
        return {
            [BOOKING_EVENTS.CHECK_EXISTS_ID]: this.findBookingById.bind(this),
            [BOOKING_EVENTS.GET_DETAILS_BOOKING_ID]: this.findBookingDetailsByBookingId.bind(this),
            [BOOKING_EVENTS.GET_DETAILS_BOOKING_IDS]: this.findBookingDetailsByBookingIds.bind(this),

            [BOOKING_EVENTS.GET_BOOKINGS_BY_IDS]: this.findBookingsByIds.bind(this),
            [BOOKING_EVENTS.CONFIRM_FROM_PAYMENT]: this.confirmBookingFromPayment.bind(this),
            [BOOKING_EVENTS.GET_ACTIVE_BOOKINGS]: this.getActiveBookings.bind(this),

            [BOOKING_EVENTS.GET_CALENDAR_DATA]: this.getCalendarData.bind(this),
            [BOOKING_EVENTS.GET_LOGS_CUSTOMER_REPORT]: this.getLogsForCustomerReport.bind(this),
            [BOOKING_EVENTS.GET_BOOKINGS_CUSTOMER_REPORT]: this.getBookingsForCustomerReport.bind(this),

            [BOOKING_EVENTS.GET_TOP_BOOKED_ROOM_CATEGORIES]: this.getTopBookedRoomCategories.bind(this)
        }
    }

    async findBookingById(data, msg) {
        try {
            console.log("Handling BOOKING_EVENTS.CHECK_EXISTS_ID");
            const { bookingId } = data;
            const booking = await this.bookingService.findBookingById(bookingId);
            
            this.eventBus.channel.sendToQueue(
                msg.properties.replyTo,
                Buffer.from(JSON.stringify({ success: true, booking })),
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

    async findBookingDetailsByBookingId(data, msg) {
        try {
            console.log("Handling BOOKING_EVENTS.GET_DETAILS_BOOKING_ID");
            const { bookingId } = data;
            const details = await this.bookingService.findBookingDetailsByBookingId(bookingId);
            
            this.eventBus.channel.sendToQueue(
                msg.properties.replyTo,
                Buffer.from(JSON.stringify({ success: true, details })),
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

    async findBookingDetailsByBookingIds(data, msg) {
        try {
            console.log("Handling BOOKING_EVENTS.GET_DETAILS_BOOKING_IDS");
            const { bookingIds } = data;
            const details = await this.bookingService.findBookingDetailsByBookingIds(bookingIds);
            
            this.eventBus.channel.sendToQueue(
                msg.properties.replyTo,
                Buffer.from(JSON.stringify({ success: true, details })),
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

    async findBookingsByIds(data, msg) {
        try {
            const { bookingIds } = data;
            const bookings = await this.bookingService.findBookingsByIds(bookingIds);
            this.eventBus.channel.sendToQueue(
                msg.properties.replyTo,
                Buffer.from(JSON.stringify({ success: true, bookings })),
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

    async confirmBookingFromPayment(data, msg) {
        try {
            const { bookingId, employeeId } = data;
            const booking = await this.bookingService.confirmBookingInternal(bookingId, employeeId ?? null);
            this.eventBus.channel.sendToQueue(
                msg.properties.replyTo,
                Buffer.from(JSON.stringify({ success: true, booking })),
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

    async getActiveBookings(data, msg) {
        try {
            const bookings = await this.bookingService.getActiveBookings();

            this.eventBus.channel.sendToQueue(
                msg.properties.replyTo,
                Buffer.from(JSON.stringify({ success: true, activeBookings: bookings })),
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

    async getLogsForCustomerReport(data, msg) {
        try {
            const { bookingIds } = data;
            const logs = await this.bookingService.getLogsForCustomerReport(bookingIds);

            this.eventBus.channel.sendToQueue(
                msg.properties.replyTo,
                Buffer.from(JSON.stringify({ success: true, logs })),
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

    async getBookingsForCustomerReport(data, msg) {
        try {
            const { start, end } = data;
            const bookings = await this.bookingService.getBookingsForCustomerReport(start, end);

            this.eventBus.channel.sendToQueue(
                msg.properties.replyTo,
                Buffer.from(JSON.stringify({ success: true, bookings })),
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

    async getCalendarData(data, msg) {
        try {
            const { roomIds, startOfDay, endOfDay } = data;
            const { bookingDetails, bookings } = await this.bookingService.getCalendarData(roomIds, startOfDay, endOfDay);

            this.eventBus.channel.sendToQueue(
                msg.properties.replyTo,
                Buffer.from(JSON.stringify({ success: true, bookingDetails, bookings })),
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

    async getTopBookedRoomCategories(data, msg) {
        try {
            const { result } = await this.bookingService.getTopBookedRoomCategories(data);
            
            this.eventBus.channel.sendToQueue(
                msg.properties.replyTo,
                Buffer.from(JSON.stringify({ success: true, result })),
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