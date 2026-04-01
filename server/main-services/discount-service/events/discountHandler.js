
export class DiscountEventHandler {
    constructor(discountService, eventBus) {
        this.discountService = discountService;
        this.eventBus = eventBus;
    }

    handlers() {
        return {
            // Define event handlers here if needed in the future
        }
    }
};