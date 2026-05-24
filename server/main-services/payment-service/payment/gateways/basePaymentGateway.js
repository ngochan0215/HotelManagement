/**
 * Strategy interface for external payment providers.
 */
export class BasePaymentGateway {
    async createPaymentRequest(_paymentData) {
        throw new Error("createPaymentRequest is not implemented");
    }

    async getPaymentRequest(_paymentId) {
        throw new Error("getPaymentRequest is not implemented");
    }
}
