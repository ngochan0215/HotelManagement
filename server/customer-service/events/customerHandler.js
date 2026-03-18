import { CUSTOMER_EVENTS } from "../../shared/events/customerEvents.js";

export class CustomerEventHandler {
    constructor(customerService) {
        this.customerService = customerService;
    }

    handlers() {
        return {
            [CUSTOMER_EVENTS.REGISTERED]: this.customerRegistered.bind(this)
        }
    }

    async customerRegistered(data) {
        console.log("Handling CUSTOMER_REGISTERED");
        await this.customerService.createCustomer(data);
    }
}