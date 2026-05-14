import Incident from "../models/Incident.js";
import IncidentLog from "../models/IncidentLog.js";
import CompensateTicket from "../models/CompensateTicket.js";
import CompensateDetail from "../models/CompensateDetail.js";

import { IncidentService } from "../services/incidentService.js";
import { CompensateService } from "../services/compensationService.js";

import { EventBus } from "../../../shared/messaging/eventBus.js";
import { EventConsumer } from "../../../shared/messaging/eventConsumer.js";
import { IncidentEventHandler } from "../events/incidentHandler.js";
import { INCIDENT_EVENTS } from "../../../shared/events/incidentEvents.js";

class Container {
    constructor() {
        this.eventBus = new EventBus();

        this.incidentService = new IncidentService({
            Incident, IncidentLog,
            CompensateTicket,
            eventBus: this.eventBus,
        });

        this.compensationService = new CompensateService({
            CompensateTicket, CompensateDetail,
            Incident, IncidentLog,
            eventBus: this.eventBus,
        });

        this.incidentEventHandler = new IncidentEventHandler(
            this.incidentService, this.compensationService, this.eventBus
        );
    }

    async init() {
        await this.eventBus.connect({
            queueName: "incident-service-events",
            bindEvents: [
                INCIDENT_EVENTS.FIND_PENDING_COMPENSATION,
                INCIDENT_EVENTS.GET_COMPENSATION_BY_ID,
                INCIDENT_EVENTS.GET_ALL_INCIDENTS_INTERNAL,
            ]
        });

        const handlers = this.incidentEventHandler.handlers();
        const consumer = new EventConsumer(this.eventBus, handlers);
        await consumer.start();
    }
}

export const container = new Container();