import Incident from "../models/Incident.js";
import IncidentLog from "../models/IncidentLog.js";
import CompensateTicket from "../models/CompensateTicket.js";
import CompensateDetail from "../models/CompensateDetail.js";

import { IncidentService } from "../services/incidentService.js";
import { CompensateService } from "../services/compensationService.js";
import { EventBus } from "../../../shared/messaging/eventBus.js";

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
        })
    }

    async init() {
        await this.eventBus.connect({
        });
        // const handlers = this.roomEventHandler.handlers();
        
        // const consumer = new EventConsumer(this.eventBus, handlers);
        // await consumer.start();
    }
}

export const container = new Container();