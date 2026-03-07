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
            res.status(500).json({ message: error.message });
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
            return res.status(500).json({
                success: false,
                message: error.message,
            });
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
            return res.status(500).json({
                success: false,
                message: error.message,
            });
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
            return res.status(500).json({
                success: false,
                message: error.message,
            });
        }
    };

    getCustomerById = async (req, res) => {
        const customer = await this.customerService.getCustomerById(req.params.id);
        res.json(customer);
    };

    findCustomerByPhone = async (req, res) => {
        const customer = await this.customerService.findCustomerByPhone(req.params.phone);
        res.json(customer);
    };

    findCustomerByCCCD = async (req, res) => {
        const customer = await this.customerService.findCustomerByPhone(req.params.cccd);
        res.json(customer);
    };

    createCustomer = async (req, res) => {
        const customer = await this.customerService.updateUser(req.params.id, req.body);
        res.json(customer);
    };
}
