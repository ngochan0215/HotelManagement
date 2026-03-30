import { container } from "../containers/container.js";

export class EquipmentImportController {
    constructor() {
        this.equipmentImportService = container.equipmentImportService;
    }

    createEquipmentTicket = async (req, res) => {
        try {
            const ticket = await this.equipmentImportService.createEquipmentTicket(req.user.userId, req.body);
            return res.status(201).json({ success: true, message: "Tạo phiếu nhập thành công!", ticket_id: ticket._id });
    
        } catch (err) {
            return res.status(500).json({ success: false, message: "ERROR: " + err.message });
        }
    };
    
    getAllEquipmentTickets = async (req, res) => {
        try {
            const { total_tickets, tickets } = await this.equipmentImportService.getAllEquipmentTickets(req.query);
            
            return res.status(200).json({ success: true, total_tickets, tickets });

        } catch (err) {
            return res.status(500).json({ success: false, message: "SERVER ERROR: " + err.message });
        }
    };
    
    getEquipmentTicketById = async (req, res) => {
        try {
            const { ticket, ticket_details } = await this.equipmentImportService.getEquipmentTicketById(req.params.id);
            
            return res.status(200).json({ success: true, ticket, ticket_details });

        } catch (err) {
            return res.status(500).json({ success: false, message: "SERVER ERROR: " + err.message });
        }
    };
    
    updateEquipmentTicket = async (req, res) => {
        try {
            await this.equipmentImportService.updateEquipmentTicket(req.params.id, req.body);
    
            return res.status(200).json({
                success: true,
                message: "Cập nhật phiếu nhập thiết bị thành công",
            });

        } catch (err) {
            return res.status(500).json({ success: false, message: "SERVER ERROR: " + err.message });
        }
    };
    
    deleteEquipmentTicket = async (req, res) => {
      try {
        const force = req.query?.force === "true";
        await this.equipmentImportService.deleteEquipmentTicket(req.params.id, force);
        
        return res.status(200).json({
          success: true,
          message: "Xóa phiếu nhập thiết bị thành công!",
        });

      } catch (err) {
        return res.status(500).json({
          success: false,
          message: "SERVER ERROR: " + err.message,
        });
      }
    };

    confirmEquipmentImportTicket = async (req, res) => {
        try {
            await this.equipmentImportService.confirmEquipmentImportTicket(req.params.id, req.user.userId);

            return res.json({
                success: true,
                message: "Xác nhận nhập kho thành công",
            });
        } catch (error) {
            return res.status(500).json({
                success: false,
                message: "SERVER ERROR: " + error.message,
            });
        }
    };
    
    getOutOfStockCategories = async (req, res) => {
        try {
            const { categories, count } = await this.equipmentImportService.getOutOfStockCategories();
    
            return res.status(200).json({
                success: true,
                categories, 
                count 
            });

        } catch (err) {
            return res.status(500).json({ success: false, message: "ERROR: " + err.message });
        }
    };

    autoCreateImportTicket = async (req, res) => {
        try {
            const { ticket_id, items_count, import_date } = await this.equipmentImportService.autoCreateImportTicket(req.user.userId, req.body);
    
            return res.status(201).json({
                success: true,
                message: `Tự động tạo phiếu nhập thành công cho ${items_count} loại thiết bị hết tồn kho!`,
                ticket_id, items_count, import_date
            });
    
        } catch (err) {
            return res.status(500).json({ success: false, message: "ERROR: " + err.message });
        }
    };
}