import { CleaningService } from "../services/cleaningService.js";
import { EventBus } from "../../../shared/messaging/eventBus.js";
import CleaningTask from "../models/CleaningTask.js";

class Container {
    constructor() {
        this.eventBus = new EventBus();

        this.cleaningService = new CleaningService({
            CleaningTask,
            eventBus: this.eventBus
        });
    }

    async init() {
        await this.eventBus.connect();
    }
}

export const container = new Container();