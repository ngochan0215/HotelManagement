import { EQUIPMENT_EVENTS } from "../../../shared/events/equipmentEvents.js";

export class EquipmentEventHandler {
    constructor(equipmentService, eventBus) {
        this.equipmentService = equipmentService;
        this.eventBus = eventBus;
    }

    handlers() {
        return {
            [EQUIPMENT_EVENTS.CHECK_EXISTS]: this.checkExists.bind(this),
            [EQUIPMENT_EVENTS.CHECK_EQUIPMENTS_EXISTS]: this.checkEquipmentsExists.bind(this),
            [EQUIPMENT_EVENTS.GET_CATEGORY_INFO]: this.getEquipmentCategoryInfo.bind(this),
            [EQUIPMENT_EVENTS.GET_CATEGORIES_INFO]: this.getEquipmentCategoriesInfo.bind(this),
            [EQUIPMENT_EVENTS.UPDATE_LOG]: this.updateEquipmentLog.bind(this),
            [EQUIPMENT_EVENTS.CREATE_LOG]: this.createEquipmentLog.bind(this),

        }
    }

    // get one equipment category information by id
    async getEquipmentCategoryInfo(data, msg) {
        try {
            const { categoryId } = data;
            const category = await this.equipmentService.getEquipmentCategoryById(categoryId);
            
            this.eventBus.channel.sendToQueue(
                msg.properties.replyTo,
                Buffer.from(JSON.stringify({ success: true, found: !!category, category })),
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

    // get some equipment categories by ids
    async getEquipmentCategoriesInfo(data, msg) {
        try {
            const { categoryIds } = data;
            const categories = await this.equipmentService.getEquipmentCategoriesByIds(categoryIds);

            this.eventBus.channel.sendToQueue(
                msg.properties.replyTo,
                Buffer.from(JSON.stringify({ success: true, found: !!categories, categories })),
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

    // check one equipment existence by id
    async checkExists(data, msg) {
        try {
            const { equipmentId } = data;
            const equipment = await this.equipmentService.getEquipmentById(equipmentId);
            
            this.eventBus.channel.sendToQueue(
                msg.properties.replyTo,
                Buffer.from(JSON.stringify({ success: true, found: !!equipment, equipment })),
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

    async checkEquipmentsExists(data, msg) {
        try {
            const { equipmentIds } = data;
            const equipments = await this.equipmentService.getEquipmentsByIds(equipmentIds);

            this.eventBus.channel.sendToQueue(
                msg.properties.replyTo,
                Buffer.from(JSON.stringify({ success: true, found: !!equipments, equipments })),
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

    // update equipment log
    async updateEquipmentLog(data, msg) {
        try {
            const { equipmentId, updateData } = data;
            const equipmentLog = await this.equipmentService.updateEquipmentLog(equipmentId, updateData);

            this.eventBus.channel.sendToQueue(
                msg.properties.replyTo,
                Buffer.from(JSON.stringify({ success: true, equipmentLog })),
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

    async createEquipmentLog(data, msg) {
        try {
            const equipmentLog = await this.equipmentService.createEquipmentLog(data);

            this.eventBus.channel.sendToQueue(
                msg.properties.replyTo,
                Buffer.from(JSON.stringify({ success: true, equipmentLog })),
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

    async updateEquipmentInternal(data, msg) {
        try {
            const { equipmentId, updateData } = data;
            const equipment = await this.equipmentService.updateEquipmentInternal(equipmentId, updateData);

            this.eventBus.channel.sendToQueue(
                msg.properties.replyTo,
                Buffer.from(JSON.stringify({ success: true, equipment })),
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