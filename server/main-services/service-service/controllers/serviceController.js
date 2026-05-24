import { container } from "../containers/container.js";

export class ServiceController {
    constructor() {
        this.service = container.serviceService;
    }

    //---- SERVICE CATEGORY ----//
    createServiceCategory = async (req, res) => {
        try {
            const category = await this.service.createServiceCategory(req.body, req.files);
            return res.status(201).json({ success: true, message: "Tạo danh mục dịch vụ mới thành công", service_category: category });
        } catch (err) {
            return res.status(err.status || 400).json({ success: false, message: err.message });
        }
    };

    updateServiceCategory = async (req, res) => {
        try {
            const category = await this.service.updateServiceCategory(req.params.id, req.body, req.files);
            return res.status(200).json({ success: true, message: "Cập nhật danh mục dịch vụ thành công!", category });
        } catch (err) {
            return res.status(err.status || 400).json({ success: false, message: err.message });
        }
    };

    deleteServiceCategory = async (req, res) => {
        try {
            await this.service.deleteServiceCategory(req.params.id, req.query?.force === "true");
            return res.status(200).json({ success: true, message: "Xóa danh mục dịch vụ thành công." });
        } catch (err) {
            return res.status(err.status || 400).json({ success: false, message: err.message });
        }
    };

    getAllServiceCategories = async (req, res) => {
        try {
            const { categories, total, page, limit } = await this.service.getAllServiceCategories(req.query);
            return res.status(200).json({ success: true, total, page, limit, categories });
        } catch (err) {
            return res.status(err.status || 500).json({ success: false, message: err.message });
        }
    };

    getServicesByCategoryId = async (req, res) => {
        try {
            const { category, services } = await this.service.getServicesByCategoryId(req.params.id);
            return res.status(200).json({ success: true, category, total: services.length, services });
        } catch (err) {
            return res.status(err.status || 400).json({ success: false, message: err.message });
        }
    };

    //---- SERVICE ----//
    createService = async (req, res) => {
        try {
            const service = await this.service.createService(req.body, req.files);
            return res.status(201).json({ success: true, service });
        } catch (err) {
            return res.status(err.status || 400).json({ success: false, message: err.message });
        }
    };

    getServiceById = async (req, res) => {
        try {
            const service = await this.service.getServiceById(req.params.id);
            return res.status(200).json({ success: true, service });
        } catch (err) {
            return res.status(err.status || 400).json({ success: false, message: err.message });
        }
    };

    getAllServices = async (req, res) => {
        try {
            const services = await this.service.getAllServices(req.query);
            return res.status(200).json({ success: true, services });
        } catch (err) {
            return res.status(err.status || 500).json({ success: false, message: err.message });
        }
    };

    updateService = async (req, res) => {
        try {
            const service = await this.service.updateService(req.params.id, req.body, req.files);
            return res.status(200).json({ success: true, service });
        } catch (err) {
            return res.status(err.status || 400).json({ success: false, message: err.message });
        }
    };

    deleteService = async (req, res) => {
        try {
            await this.service.deleteService(req.params.id);
            return res.status(200).json({ success: true, message: "Xóa dịch vụ thành công." });
        } catch (err) {
            return res.status(err.status || 400).json({ success: false, message: err.message });
        }
    };

    //---- GOOD TICKET ----//
    createGoodTicket = async (req, res) => {
        try {
            const data = await this.service.createGoodTicket(req.body, req.user.userId);
            return res.status(201).json({ success: true, message: "Tạo phiếu nhập sản phẩm thành công.", data });
        } catch (err) {
            return res.status(err.status || 400).json({ success: false, message: err.message });
        }
    };

    getAllGoodTickets = async (req, res) => {
        try {
            const tickets_details = await this.service.getAllGoodTickets(req.query);
            return res.status(200).json({ success: true, total_tickets: tickets_details.length, tickets_details });
        } catch (err) {
            return res.status(err.status || 500).json({ success: false, message: err.message });
        }
    };

    getGoodTicketById = async (req, res) => {
        try {
            const data = await this.service.getGoodTicketById(req.params.id);
            return res.status(200).json({ success: true, data });
        } catch (err) {
            return res.status(err.status || 400).json({ success: false, message: err.message });
        }
    };

    getOutOfStockServices = async (req, res) => {
        try {
            const services = await this.service.getOutOfStockServices();
            return res.status(200).json({ success: true, services, count: services.length });
        } catch (err) {
            return res.status(err.status || 500).json({ success: false, message: err.message });
        }
    };

    autoCreateGoodTicket = async (req, res) => {
        try {
            const result = await this.service.autoCreateGoodTicket(req.body, req.user.userId);
            if (result === null) {
                return res.status(200).json({ success: true, message: "Không có sản phẩm nào hết tồn kho.", ticket_id: null, items_count: 0 });
            }
            return res.status(201).json({
                success: true,
                message: `Tự động tạo phiếu nhập thành công cho ${result.items_count} loại sản phẩm hết tồn kho!`,
                data: { ticket: result.ticket, total_items: result.total_items },
                ticket_id: result.ticket_id,
                items_count: result.items_count,
                import_date: result.import_date,
            });
        } catch (err) {
            return res.status(err.status || 400).json({ success: false, message: err.message });
        }
    };

    updateGoodTicket = async (req, res) => {
        try {
            const ticket = await this.service.updateGoodTicket(req.params.id, req.body);
            return res.status(200).json({ success: true, message: "Cập nhật phiếu nhập thành công.", data: ticket });
        } catch (err) {
            return res.status(err.status || 400).json({ success: false, message: err.message });
        }
    };

    deleteGoodTicket = async (req, res) => {
        try {
            await this.service.deleteGoodTicket(req.params.id, req.query?.force === "true");
            return res.status(200).json({ success: true, message: "Đã xóa phiếu nhập sản phẩm." });
        } catch (err) {
            return res.status(err.status || 400).json({ success: false, message: err.message });
        }
    };

    confirmGoodTicket = async (req, res) => {
        try {
            await this.service.confirmGoodTicket(req.params.id, req.user.userId);
            return res.status(200).json({ success: true, message: "Xác nhận nhập kho thành công." });
        } catch (err) {
            return res.status(err.status || 400).json({ success: false, message: err.message });
        }
    };

    //---- SERVICE USAGE ----//
    createServiceUsage = async (req, res) => {
        try {
            const data = await this.service.createServiceUsage(req.body, req.user.userId);
            return res.status(201).json({ success: true, message: "Tạo phiếu sử dụng dịch vụ thành công.", data });
        } catch (err) {
            return res.status(err.status || 400).json({ success: false, message: err.message });
        }
    };

    getAllServiceUsage = async (req, res) => {
        try {
            const data = await this.service.getAllServiceUsage(req.query);
            return res.status(200).json({ success: true, total: data.length, data });
        } catch (err) {
            return res.status(err.status || 500).json({ success: false, message: err.message });
        }
    };

    getServiceUsageById = async (req, res) => {
        try {
            const { service_usage, usage_details, rooms } = await this.service.getServiceUsageById(req.params.id);
            return res.status(200).json({ success: true, data: { service_usage, usage_details, rooms } });
        } catch (err) {
            return res.status(err.status || 400).json({ success: false, message: err.message });
        }
    };

    deleteServiceUsage = async (req, res) => {
        try {
            await this.service.deleteServiceUsage(req.params.id, req.query?.force === "true");
            return res.status(200).json({ success: true, message: "Xóa phiếu sử dụng dịch vụ thành công" });
        } catch (err) {
            return res.status(err.status || 400).json({ success: false, message: err.message });
        }
    };

    updateServiceUsage = async (req, res) => {
        try {
            const data = await this.service.updateServiceUsage(req.params.id, req.body);
            return res.status(200).json({ success: true, message: "Cập nhật phiếu sử dụng dịch vụ thành công.", data });
        } catch (err) {
            return res.status(err.status || 400).json({ success: false, message: err.message });
        }
    };

    confirmServiceUsage = async (req, res) => {
        try {
            await this.service.confirmServiceUsage(req.params.id, req.user.userId);
            return res.status(200).json({ success: true, message: "Xác nhận toàn bộ phiếu sử dụng dịch vụ thành công" });
        } catch (err) {
            return res.status(err.status || 400).json({ success: false, message: err.message });
        }
    };

    cancelServiceUsage = async (req, res) => {
        try {
            await this.service.cancelServiceUsage(req.params.id, req.user.userId);
            return res.status(200).json({ success: true, message: "Hủy toàn bộ phiếu sử dụng dịch vụ thành công" });
        } catch (err) {
            return res.status(err.status || 400).json({ success: false, message: err.message });
        }
    };

    confirmUsageDetail = async (req, res) => {
        try {
            await this.service.confirmUsageDetail(req.params.id, req.user.userId);
            return res.status(200).json({ success: true, message: "Xác nhận sử dụng dịch vụ thành công" });
        } catch (err) {
            return res.status(err.status || 400).json({ success: false, message: err.message });
        }
    };

    cancelUsageDetail = async (req, res) => {
        try {
            await this.service.cancelUsageDetail(req.params.id, req.user.userId);
            return res.status(200).json({ success: true, message: "Hủy dịch vụ thành công" });
        } catch (err) {
            return res.status(err.status || 400).json({ success: false, message: err.message });
        }
    };
}
