import { EventBus } from "../../../shared/messaging/eventBus.js";

class Container {
    constructor() {
        this.eventBus = new EventBus();
    }

    async init() {
        await this.eventBus.connect({
            queueName: "service-service-events",
            bindEvents: [],
        });
    }
}

export const container = new Container();
