import { PayosGateway } from "./gateways/payosGateway.js";

const DEFAULT_PROVIDER = "payos";

const registry = {
    [DEFAULT_PROVIDER]: () => new PayosGateway(),
};

export class PaymentGatewayFactory {
    /**
     * @param {string} [provider="payos"]
     * @returns {import("./gateways/basePaymentGateway.js").BasePaymentGateway}
     */
    static getGateway(provider = DEFAULT_PROVIDER) {
        const factory = registry[provider];
        if (!factory) {
            throw new Error(`Unsupported payment provider: ${provider}`);
        }
        return factory();
    }
}
