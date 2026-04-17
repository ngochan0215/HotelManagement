import { container } from "../containers/container.js";

export class ReceiptController {
    constructor() {
        this.receiptService = container.receiptService;
    }

    createReceipt = async (req, res) => {
        try {
            const receipt = await this.receiptService.createReceipt(req.user.userId, req.body);
            
            return res.status(201).json({
                message: "Tạo hóa đơn thành công.",
                receipt: receipt,
            });

        } catch (err) {
            return res.status(500).json({
                message: err.message || "Không thể tạo hóa đơn.",
            });
        }
    };

    getReceiptById = async (req, res) => {
        try {
            const receipt = await this.receiptService.getReceiptById(req.params.id);
        
            return res.status(200).json({ receipt });

        } catch (err) {
            return res.status(500).json({
                message: err.message || "Không thể lấy thông tin hóa đơn.",
            });
        }
    };

    getAllReceipts = async (req, res) => {
        try {
            const { total, receipts } = await this.receiptService.getAllReceipts(req.query);

            return res.status(200).json({ total, receipts });

        } catch (err) {
            return res.status(500).json({
                message: err.message || "Không thể lấy danh sách hóa đơn.",
            });
        }
    };

    updateReceipt = async (req, res) => {
        try {
            const receipt = await this.receiptService.updateReceipt(req.params.id, req.body);

            return res.status(200).json({
                success: true,
                data: receipt
            });

        } catch (error) {
            return res.status(500).json({
                success: false,
                message: error.message
            });
        }
    };

    refreshReceiptAfterCheckout = async (req, res) => {
        try {
            const receipt = await this.receiptService.refreshReceiptAfterCheckout(req.params.id);
            
            return res.status(200).json({
                message: "Cập nhật hóa đơn thành công.",
                receipt
            });

        } catch (error) {
            return res.status(500).json({
                message: error.message || "Không thể cập nhật hóa đơn."
            });
        }
    };

    markReceiptAsPaid = async (req, res) => {
        try {
            const receipt = await this.receiptService.markReceiptAsPaid(req.user.userId, req.params.id, req.body.payment);
        
            return res.status(200).json({
                message: "Thanh toán hóa đơn thành công.",
                receipt
            });

        } catch (error) {
            return res.status(500).json({
                message: error.message || "Không thể thanh toán hóa đơn."
            });
        }
    };
};