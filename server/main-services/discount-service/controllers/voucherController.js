import { container } from "../containers/container.js";

export class VoucherController {
    constructor() {
        this.voucherService = container.voucherService;
    }

    createVoucher = async (req, res) => {
        try {
            const newVoucher = await this.voucherService.createVoucher(req.body);

            return res.status(201).json({
                success: true,
                message: "Create voucher successfully!",
                data: newVoucher
            });

        } catch (err) {
            return res.status(err.status || 400).json({ message: err.message });
        }
    };

    getAllVouchers = async (req, res) => {
        try {
            const vouchers = await this.voucherService.getAllVouchers(req.query);

            return res.status(200).json({
                success: true,
                total: vouchers.length,
                vouchers
            });

        } catch (err) {
            return res.status(err.status || 400).json({ message: err.message });
        }
    };

    getVoucherById = async (req, res) => {
        try {
            const voucher = await this.voucherService.getVoucherById(req.params.id);
            
            return res.status(200).json({
                success: true,
                data: voucher
            });

        } catch (err) {
            return res.status(err.status || 400).json({ message: err.message });
        }
    };

    deleteVoucher = async (req, res) => {
        try {
            await this.voucherService.deleteVoucher(req.params.id);
            
            return res.status(200).json({ success: true, message: "Delete voucher successfully!"});

        } catch (err) {
            return res.status(err.status || 400).json({ message: err.message });
        }
    };

    unactivateVoucher = async (req, res) => {
        try {
            await this.voucherService.unactivateVoucher(req.params.id);
    
            return res.status(200).json({
                success: true,
                message: "Unactivate voucher successfully!"
            });

        } catch (err) {
            return res.status(err.status || 400).json({ message: err.message });
        }
    };

    updateVoucher = async (req, res) => {
        try {
            const voucher = await this.voucherService.updateVoucher(req.params.id, req.body);

            return res.status(200).json({ 
                success: true, 
                message: "Update voucher successfully!",
                data: voucher
            });

        } catch (err) { 
            return res.status(err.status || 400).json({ message: err.message });
        }
    };

    getAvailableVouchers = async (req, res) => {
        try {
            const { order_value } = req.query;
            const customerId = req.user.customerId;

            const orderValue = order_value ? parseFloat(order_value) : 0;

            if (isNaN(orderValue) || orderValue < 0) {
                return res.status(400).json({
                    success: false,
                    message: "Giá trị đơn hàng không hợp lệ"
                });
            }

            const vouchers = await this.voucherService.getAvailableVouchers(customerId, orderValue);

            return res.status(200).json({
                success: true,
                data: vouchers
            });

        } catch (err) {
            return res.status(err.status || 400).json({ message: err.message });
        }
    };
}