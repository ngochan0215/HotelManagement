import { EQUIPMENT_EVENTS } from "../../../shared/events/equipmentEvents.js";

export class EquipmentEventHandler {
    constructor(equipmentService, eventBus) {
        this.equipmentService = equipmentService;
        this.eventBus = eventBus;
    }

    handlers() {
        return {
            [EQUIPMENT_EVENTS.CHECK_EXISTS]: this.checkExists.bind(this),
            [EQUIPMENT_EVENTS.GET_CATEGORY_INFO]: this.getEquipmentCategoryInfo.bind(this),
            [EQUIPMENT_EVENTS.GET_CATEGORIES_INFO]: this.getEquipmentCategoriesInfo.bind(this),
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

    async checkExists(data, msg) {
    }
}