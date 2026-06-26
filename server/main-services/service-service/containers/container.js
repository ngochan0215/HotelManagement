import { EventBus } from "../../../shared/messaging/eventBus.js";
import { EventConsumer } from "../../../shared/messaging/eventConsumer.js";
import { ServiceService } from "../services/serviceService.js";
import { AdditionalService } from "../services/additionalService.js";
import { ServiceEventHandler } from "../events/serviceHandler.js";
import { SERVICE_EVENTS } from "../../../shared/events/serviceEvents.js";
import { sendNotificationsToUsers } from "../../../shared/messaging/notificationPublisher.js";

import Service from "../models/Service.js";
import ServiceCategory from "../models/ServiceCategory.js";
import GoodImport from "../models/GoodImport.js";
import GoodTicket from "../models/GoodTicket.js";
import ServiceUsage from "../models/ServiceUsage.js";
import UsageDetail from "../models/UsageDetail.js";
import ServiceAsset from "../models/ServiceAsset.js";
import ServiceSlot from "../models/ServiceSlot.js";

class Container {
    constructor() {
        this.eventBus = new EventBus();

        this.additionalService = new AdditionalService({ ServiceSlot, ServiceAsset, Service });

        this.serviceService = new ServiceService({
            Service,
            ServiceCategory,
            GoodImport,
            GoodTicket,
            ServiceUsage,
            UsageDetail,
            ServiceAsset,
            ServiceSlot,

            additionalService: this.additionalService,
            eventBus: this.eventBus,
            sendNotificationsToUsers,
        });

        this.serviceEventHandler = new ServiceEventHandler(this.serviceService, this.eventBus);
    }

    async init() {
        await this.eventBus.connect({
            queueName: "service-service-events",
            bindEvents: [
                SERVICE_EVENTS.GET_COMPLETED_BY_BOOKING,
                SERVICE_EVENTS.VALIDATE_PENDING_SERVICES,
                SERVICE_EVENTS.FULFILL_PENDING_SERVICES,
            ],
        });

        const handlers = this.serviceEventHandler.handlers();
        const consumer = new EventConsumer(this.eventBus, handlers);
        await consumer.start();
    }
}

export const container = new Container();
