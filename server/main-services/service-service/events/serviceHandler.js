import { SERVICE_EVENTS } from "../../../shared/events/serviceEvents.js";

export class ServiceEventHandler {
    constructor(serviceService, eventBus) {
        this.serviceService = serviceService;
        this.eventBus = eventBus;
    }

    handlers() {
        return {
            [SERVICE_EVENTS.GET_COMPLETED_BY_BOOKING]: this.getCompletedByBooking.bind(this),
            [SERVICE_EVENTS.VALIDATE_PENDING_SERVICES]: this.validatePendingServices.bind(this),
            [SERVICE_EVENTS.FULFILL_PENDING_SERVICES]: this.fulfillPendingServices.bind(this),
        };
    }

    async getCompletedByBooking(data, msg) {
        try {
            const { bookingId } = data;
            const usages = await this.serviceService.getCompletedByBooking(bookingId);

            this.eventBus.channel.sendToQueue(
                msg.properties.replyTo,
                Buffer.from(JSON.stringify({ success: true, usages })),
                {
                    correlationId: msg.properties.correlationId,
                    persistent: false,
                }
            );
        } catch (err) {
            this.eventBus.channel.sendToQueue(
                msg.properties.replyTo,
                Buffer.from(JSON.stringify({ success: false, message: err.message })),
                {
                    correlationId: msg.properties.correlationId,
                    persistent: false,
                }
            );
        }
    }

    async validatePendingServices(data, msg) {
        try {
            const { services } = data;
            const result = await this.serviceService.validatePendingServices(services);

            this.eventBus.channel.sendToQueue(
                msg.properties.replyTo,
                Buffer.from(JSON.stringify({ success: true, ...result })),
                {
                    correlationId: msg.properties.correlationId,
                    persistent: false,
                }
            );
        } catch (err) {
            this.eventBus.channel.sendToQueue(
                msg.properties.replyTo,
                Buffer.from(JSON.stringify({ success: false, message: err.message })),
                {
                    correlationId: msg.properties.correlationId,
                    persistent: false,
                }
            );
        }
    }

    async fulfillPendingServices(data, msg) {
        try {
            const { booking_id, customer_id, orders, employee_id } = data;
            const result = await this.serviceService.fulfillPendingServices(
                { booking_id, customer_id, orders },
                employee_id ?? null,
            );

            this.eventBus.channel.sendToQueue(
                msg.properties.replyTo,
                Buffer.from(JSON.stringify({ success: true, ...result })),
                {
                    correlationId: msg.properties.correlationId,
                    persistent: false,
                }
            );
        } catch (err) {
            this.eventBus.channel.sendToQueue(
                msg.properties.replyTo,
                Buffer.from(JSON.stringify({ success: false, message: err.message })),
                {
                    correlationId: msg.properties.correlationId,
                    persistent: false,
                }
            );
        }
    }
}
