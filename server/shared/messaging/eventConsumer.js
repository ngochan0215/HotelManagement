export class EventConsumer {
    constructor (eventBus, handlers) {
        this.eventBus = eventBus;
        this.handlers = handlers;
    }

    async start () {
        await this.eventBus.subscribe(async (message, msg) => {
            const handler = this.handlers[message.event];
            if (!handler) {
                console.log(`No handler for event ${message.event}`);
                return;
            }

            try {
                await handler(message.data, msg);
            } catch (error) {
                console.error(`Handler failed for ${message.event} `, error);
                throw error;
            }
        });
    }
}