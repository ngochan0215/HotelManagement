import { INCIDENT_EVENTS } from "../../../shared/events/incidentEvents.js";

export class IncidentEventHandler {
    constructor(incidentService, compensationService, eventBus) {
        this.incidentService = incidentService;
        this.compensationService = compensationService;
        this.eventBus = eventBus;
    }

    handlers() {
        return {
            [INCIDENT_EVENTS.FIND_PENDING_COMPENSATION]: this.findPendingCompensationTicket.bind(this),
            [INCIDENT_EVENTS.GET_COMPENSATION_BY_ID]: this.getCompensationById.bind(this),
            [INCIDENT_EVENTS.GET_ALL_INCIDENTS_INTERNAL]: this.getAllIncidentsInternal.bind(this),
        }
    }

    async findPendingCompensationTicket(data, msg) {
        try {
            const { bookingId } = data;
            const tickets = await this.compensationService.findPendingCompensationTicket(bookingId);
            
            this.eventBus.channel.sendToQueue(
                msg.properties.replyTo,
                Buffer.from(JSON.stringify({ success: true, tickets })),
                {
                    correlationId: msg.properties.correlationId,
                    persistent: false
                }
            );

        } catch (err) {
            this.eventBus.channel.sendToQueue(
                msg.properties.replyTo,
                Buffer.from(JSON.stringify({ success: false, message: err.message })),
                {
                    correlationId: msg.properties.correlationId,
                    persistent: false
                }
            );
        }
    }

    async getCompensationById(data, msg) {
        try {
            const { ticketId } = data;
            const result = await this.compensationService.getCompensateTicketById(ticketId);
            const ticket = result?.data ?? result;
            this.eventBus.channel.sendToQueue(
                msg.properties.replyTo,
                Buffer.from(JSON.stringify({ success: true, ticket })),
                {
                    correlationId: msg.properties.correlationId,
                    persistent: false
                }
            );
        } catch (err) {
            this.eventBus.channel.sendToQueue(
                msg.properties.replyTo,
                Buffer.from(JSON.stringify({ success: false, message: err.message })),
                {
                    correlationId: msg.properties.correlationId,
                    persistent: false
                }
            );
        }
    }

    async getAllIncidentsInternal(data, msg) {
        try {
            const incidents = await this.incidentService.getAllIncidentsForTasks(data);

            this.eventBus.channel.sendToQueue(
                msg.properties.replyTo,
                Buffer.from(JSON.stringify({ success: true, incidents })),
                {
                    correlationId: msg.properties.correlationId,
                    persistent: false
                }
            );

        } catch (err) {
            this.eventBus.channel.sendToQueue(
                msg.properties.replyTo,
                Buffer.from(JSON.stringify({ success: false, message: err.message })),
                {
                    correlationId: msg.properties.correlationId,
                    persistent: false
                }
            );
        }
    }
}