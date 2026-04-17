import Equipment from "../models/Equipment.js";
import EquipmentCategory from "../models/EquipmentCategory.js";
import EquipmentLog from "../models/EquipmentLog.js";
import ImportTicket from "../models/ImportTicket.js";
import ImportDetail from "../models/ImportDetail.js";
import InstallDetail from "../models/InstallDetail.js";
import InstallTicket from "../models/InstallTicket.js";

import { sendNotification, sendNotificationsToUsers } from "../../../shared/messaging/notificationPublisher.js";

import { EquipmentService } from "../services/equipmentService.js";
import { EquipmentImportService } from "../services/equipmentImportService.js";
import { EquipmentInstallService } from "../services/equipmentInstallService.js";

import { EquipmentEventHandler } from "../events/equipmentHandler.js";

import { EventBus } from "../../../shared/messaging/eventBus.js";
import { EventConsumer } from "../../../shared/messaging/eventConsumer.js";
import { EQUIPMENT_EVENTS } from "../../../shared/events/equipmentEvents.js";

class Container {
    constructor() {
        this.eventBus = new EventBus();

        this.equipmentService = new EquipmentService({
            Equipment, 
            EquipmentCategory,
            EquipmentLog,
            eventBus: this.eventBus
        });
        
        this.equipmentImportService = new EquipmentImportService({
            Equipment, EquipmentCategory, EquipmentLog,
            ImportTicket, ImportDetail,
            eventBus: this.eventBus
        });

        this.equipmentInstallService = new EquipmentInstallService({
            Equipment, EquipmentCategory, EquipmentLog,
            InstallTicket, InstallDetail,
            eventBus: this.eventBus,
            sendNotification, sendNotificationsToUsers
        });

        this.equipmentEventHandler = new EquipmentEventHandler(this.equipmentService, this.eventBus);
    }

    async init() {
        await this.eventBus.connect({
            queueName: "equipment-service-events",
            bindEvents: [
                EQUIPMENT_EVENTS.CHECK_EXISTS,
                EQUIPMENT_EVENTS.CHECK_EQUIPMENTS_EXISTS,
                EQUIPMENT_EVENTS.GET_CATEGORY_INFO,
                EQUIPMENT_EVENTS.GET_CATEGORIES_INFO,
                EQUIPMENT_EVENTS.UPDATE_LOG,
                EQUIPMENT_EVENTS.CREATE_LOG,
                EQUIPMENT_EVENTS.UPDATE_INTERNAL
            ]
        });

        const handlers = this.equipmentEventHandler.handlers();
        const consumer = new EventConsumer(this.eventBus, handlers);
        await consumer.start();
    }
}

export const container = new Container();