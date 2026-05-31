import { SERVICE_EVENTS } from "../../../shared/events/serviceEvents.js";

export class ServiceEventHandler {
    constructor(serviceService, eventBus) {
        this.serviceService = serviceService;
        this.eventBus = eventBus;
    }

    handlers() {
        return {
            [SERVICE_EVENTS.GET_COMPLETED_BY_BOOKING]: this.getCompletedByBooking.bind(this),
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
}
