import { container } from "../containers/container.js";

export class CustomerController {
    constructor() {
        this.customerService = container.customerService;
    }

    getAllCustomers = async (req, res) => {
        try {
            const { total, customers } = await this.customerService.getAllCustomers(req.query);

            res.status(200).json({
                success: true,
                total,
                customers
            });
        } catch (error) {
            return res.status(err.status || 400).json({ message: err.message });
        }
    };

    getCustomerById = async (req, res) => {
        try {
            const customer = await this.customerService.getCustomerById(req.params.id);
            return res.status(200).json(customer);
        } catch (err) {
            return res.status(err.status || 400).json({ message: err.message });
        }
    };

    updateCustomer = async (req, res) => {
        try {
            const customer = await this.customerService.updateCustomer(req.params.id, req.body);

            return res.status(200).json({
                success: true,
                message: "Cập nhật thông tin khách hàng thành công.",
                data: customer,
            });
        } catch (error) {
            return res.status(err.status || 400).json({ message: err.message });
        }
    };

    banCustomer = async (req, res) => {
        try {
            await this.customerService.banCustomer(req.params.id);

            return res.status(200).json({
                success: true,
                message: "Đã vô hiệu hóa tài khoản khách hàng.",
            });

        } catch (error) {
            return res.status(err.status || 400).json({ message: err.message });
        }
    };

    unbanCustomer = async (req, res) => {
        try {
            await this.customerService.unbanCustomer(req.params.id);

            return res.status(200).json({
                success: true,
                message: "Đã mở khóa tài khoản khách hàng.",
            });
        } catch (error) {
            return res.status(err.status || 400).json({ message: err.message });
        }
    };

    createCustomer = async (req, res) => {
        try {
            const customer = await this.customerService.createCustomer(req.params.userId, req.body);
            
            res.status(201).json(customer);

        } catch (error) {
            return res.status(err.status || 400).json({ message: err.message });
        }
    };
}
