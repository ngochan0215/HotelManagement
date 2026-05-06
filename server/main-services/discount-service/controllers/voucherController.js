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
            return res.status(500).json({
                success: false,
                message: "SERVER ERROR: " + err.message
            });
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
            res.status(500).json({
                success: false,
                message: "SERVER ERROR: " + err.message
            });
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
            return res.status(500).json({
                success: false,
                message: "SERVER ERROR: " + err.message
            });
        }
    };

    deleteVoucher = async (req, res) => {
        try {
            await this.voucherService.deleteVoucher(req.params.id);
            
            return res.status(200).json({ success: true, message: "Delete voucher successfully!"});

        } catch (err) {
            return res.status(500).json({ success: false, message: "SERVER ERROR: " + err.message });
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
            return res.status(500).json({
                success: false,
                message: "SERVER ERROR: " + err.message
            });
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
            return res.status(500).json({ 
                success: false, 
                message: "SERVER ERROR: " + err.message 
            });
        }
    };

    getAvailableVouchers = async (req, res) => {
        try {
            const availableVouchers = await this.voucherService.getAvailableVouchers(req.user.customerId, req.body);

            return res.status(200).json({
                success: true,
                data: availableVouchers
            });
        
        } catch (err) {
            return res.status(500).json({
                success: false,
                message: "SERVER ERROR: " + err.message
            });
        }
    };
}