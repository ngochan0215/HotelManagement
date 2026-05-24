import { payOSpayin } from "../../config/payos.js";
import { BasePaymentGateway } from "./basePaymentGateway.js";

/**
 * Adapter for PayOS pay-in (payment link) API.
 */
export class PayosGateway extends BasePaymentGateway {
    constructor(client = payOSpayin) {
        super();
        this.client = client;
    }

    async createPaymentRequest(paymentData) {
        return this.client.paymentRequests.create(paymentData);
    }

    async getPaymentRequest(paymentId) {
        return this.client.paymentRequests.get(paymentId);
    }
}
