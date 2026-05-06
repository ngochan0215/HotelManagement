import { CleaningService } from "../services/cleaningService.js";
import { CleaningController } from "../controllers/cleaningController.js";
import { EventBus } from "../../shared/messaging/eventBus.js";
import CleaningTask from "../models/cleaningTask.js";

class Container {
    constructor() {
        this.eventBus = new EventBus();

        this.cleaningService = new CleaningService({
            CleaningTask,
            eventBus: this.eventBus
        });

        this.cleaningController = new CleaningController({
            cleaningService: this.cleaningService
        });
    }

    async init() {
        await this.eventBus.connect();
    }
}

export const container = new Container();