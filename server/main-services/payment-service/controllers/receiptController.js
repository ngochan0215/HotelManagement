import { container } from "../containers/container.js";

export class ReceiptController {
    constructor() {
        this.receiptService = container.receiptService;
    }

    createReceipt = async (req, res) => {
        try {
            const receipt = await this.receiptService.createReceipt(req.user.userId, req.body);
            
            return res.status(201).json({
                message: "Create receipt successfully!",
                receipt: receipt,
            });

        } catch (err) {
            return res.status(err.status || 400).json({ message: err.message });
        }
    };

    getReceiptById = async (req, res) => {
        try {
            const receipt = await this.receiptService.getReceiptById(req.params.id);
        
            return res.status(200).json({ receipt });

        } catch (err) {
            return res.status(err.status || 400).json({ message: err.message });
        }
    };

    getAllReceipts = async (req, res) => {
        try {
            const { total, receipts } = await this.receiptService.getAllReceipts(req.query);

            return res.status(200).json({ total, receipts });

        } catch (err) {
            return res.status(err.status || 400).json({ message: err.message });
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
            return res.status(err.status || 400).json({ message: err.message });
        }
    };

    refreshReceiptAfterCheckout = async (req, res) => {
        try {
            const receipt = await this.receiptService.refreshReceiptAfterCheckout(req.params.id);
            
            return res.status(200).json({
                message: "Update receipt successfully!",
                receipt
            });

        } catch (error) {
            return res.status(err.status || 400).json({ message: err.message });
        }
    };

    markReceiptAsPaid = async (req, res) => {
        try {
            const receipt = await this.receiptService.markReceiptAsPaid(req.user.userId, req.params.id, req.body.payment);
        
            return res.status(200).json({
                message: "Receipt paid successfully!",
                receipt
            });

        } catch (error) {
            return res.status(err.status || 400).json({ message: err.message });
        }
    };
};