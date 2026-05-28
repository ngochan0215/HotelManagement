import { DISCOUNT_EVENTS } from "../../../shared/events/discountEvents.js";

export class DiscountEventHandler {
    constructor(discountService, voucherService, eventBus) {
        this.discountService = discountService;
        this.voucherService = voucherService;
        this.eventBus = eventBus;
    }

    handlers() {
        return {
            [DISCOUNT_EVENTS.CHECK_EXISTS]: this.getDiscountById.bind(this),
            [DISCOUNT_EVENTS.GET_ACTIVE_DISCOUNTS]: this.getActiveDiscounts.bind(this),
            [DISCOUNT_EVENTS.VALIDATE_VOUCHER]: this.validateVoucher.bind(this),
            [DISCOUNT_EVENTS.REDEEM_VOUCHER]: this.redeemVoucher.bind(this),
            [DISCOUNT_EVENTS.RELEASE_VOUCHER]: this.releaseVoucher.bind(this),
        };
    }

    reply(msg, payload) {
        this.eventBus.channel.sendToQueue(
            msg.properties.replyTo,
            Buffer.from(JSON.stringify(payload)),
            { correlationId: msg.properties.correlationId, persistent: false }
        );
    }

    async getDiscountById(data, msg) {
        try {
            const { discountId } = data;
            const discount = await this.discountService.getDiscountById(discountId);
            this.reply(msg, { success: true, found: !!discount, discount });
        } catch (error) {
            this.reply(msg, { success: false, message: error.message });
        }
    }

    async getActiveDiscounts(data, msg) {
        try {
            const { orderValue = 0 } = data;
            const discounts = await this.discountService.getApplicableDiscounts(orderValue);
            this.reply(msg, { success: true, discounts });
        } catch (error) {
            this.reply(msg, { success: false, message: error.message });
        }
    }

    async validateVoucher(data, msg) {
        try {
            const { voucherCodes = [], customerId, orderValue = 0 } = data;
            const vouchers = await this.voucherService.validateVouchers(voucherCodes, customerId, orderValue);
            this.reply(msg, { success: true, vouchers });
        } catch (error) {
            this.reply(msg, { success: false, message: error.message });
        }
    }

    async redeemVoucher(data, msg) {
        try {
            const { voucherCodes = [], customerId, bookingId } = data;
            const result = await this.voucherService.redeemVouchers(voucherCodes, customerId, bookingId);
            this.reply(msg, { success: true, ...result });
        } catch (error) {
            this.reply(msg, { success: false, message: error.message });
        }
    }

    async releaseVoucher(data, msg) {
        try {
            const { voucherCodes = [], customerId, bookingId } = data;
            const result = await this.voucherService.releaseVouchers(voucherCodes, customerId, bookingId);
            this.reply(msg, { success: true, ...result });
        } catch (error) {
            this.reply(msg, { success: false, message: error.message });
        }
    }
}
