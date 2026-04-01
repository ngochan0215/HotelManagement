import { container } from "../containers/container.js";

export class DiscountController {
    constructor() {
        this.discountService = container.discountService;
    }

    createDiscount = async (req, res) => {
        try {
            const newDiscount = await this.discountService.createDiscount(req.body);

            return res.status(201).json({
                success: true,
                message: "Tạo discount thành công",
                data: newDiscount
            });

        } catch (err) {
            return res.status(500).json({
                success: false,
                message: "SERVER ERROR: " + err.message
            });
        }
    };

    getAllDiscounts = async (req, res) => {
        try {
            const discounts = await this.discountService.getAllDiscounts(req.query);

            return res.json({
                success: true,
                total: discounts.length,
                discounts
            });

        } catch (err) {
            res.status(500).json({
                success: false,
                message: "SERVER ERROR: " + err.message
            });
        }
    };

    getDiscountById = async (req, res) => {
        try {
            const discount = await this.discountService.getDiscountById(req.params.id);
            
            return res.status(200).json({
                success: true,
                data: discount
            });

        } catch (err) {
            return res.status(500).json({
                success: false,
                message: "SERVER ERROR: " + err.message
            });
        }
    };

    deleteDiscount = async (req, res) => {
        try {
            await this.discountService.deleteDiscount(req.params.id);
            return res.status(200).json({ success: true, message: "Xóa khuyến mãi thành công!"});

        } catch (err) {
            return res.status(500).json({ success: false, message: "SERVER ERROR: " + err.message });
        }
    };

    unactivateDiscount = async (req, res) => {
        try {
            await this.discountService.unactivateDiscount(req.params.id);
    
            return res.status(200).json({
                success: true,
                message: "Dừng hoạt động discount thành công"
            });

        } catch (err) {
            return res.status(500).json({
                success: false,
                message: "SERVER ERROR: " + err.message
            });
        }
    };

    updateDiscount = async (req, res) => {
        try {
            const discount = await this.discountService.updateDiscount(req.params.id, req.body);

            return res.status(200).json({ 
                success: true, 
                message: "Cập nhật khuyến mãi thành công",
                data: discount
            });

        } catch (err) { 
            return res.status(500).json({ 
                success: false, 
                message: "SERVER ERROR: " + err.message 
            });
        }
    };

    getAvailableDiscounts = async (req, res) => {
        try {
            const discountsWithAvailability = await this.discountService.getAvailableDiscounts(req.query);

            return res.status(200).json({
                success: true,
                total: discountsWithAvailability.length,
                available_count: discountsWithAvailability.filter(d => d.is_available).length,
                discounts: discountsWithAvailability
            });
        
        } catch (err) {
            return res.status(500).json({
                success: false,
                message: "SERVER ERROR: " + err.message
            });
        }
    };
}