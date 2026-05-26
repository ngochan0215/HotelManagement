import { EventBus } from "../../../shared/messaging/eventBus.js";
import { ServiceService } from "../services/serviceService.js";
import { AdditionalService } from "../services/additionalService.js";
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
    }

    async init() {
        await this.eventBus.connect({
            queueName: "service-service-events",
            bindEvents: [],
        });
    }
}

export const container = new Container();
