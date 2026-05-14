import { CLEANING_EVENTS } from "../../../shared/events/cleaningEvents.js";

export class CleaningEventHandler {
    constructor(cleaningService, eventBus) {
        this.cleaningService = cleaningService;
        this.eventBus = eventBus;
    }

    handlers() {
        return {
            [CLEANING_EVENTS.CREATE_TASK]: this.createTask.bind(this),
        };
    }

    async createTask(data, msg) {
        try {
            console.log("Handling CLEANING_EVENTS.CREATE_TASK");
            const task = await this.cleaningService.createTaskFromBooking(data);
            this.eventBus.channel.sendToQueue(
                msg.properties.replyTo,
                Buffer.from(JSON.stringify({ success: true, task })),
                { correlationId: msg.properties.correlationId, persistent: false }
            );
        } catch (error) {
            this.eventBus.channel.sendToQueue(
                msg.properties.replyTo,
                Buffer.from(JSON.stringify({ success: false, message: error.message })),
                { correlationId: msg.properties.correlationId, persistent: false }
            );
        }
    }
}
