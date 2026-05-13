import { container } from "../containers/container.js";

export class EquipmentInstallController {
    constructor() {
        this.equipmentInstallService = container.equipmentInstallService;
    }

    createInstallTicket = async (req, res) => {
        try {
            const install = await this.equipmentInstallService.createInstallTicket(req.user.userId, req.body);
            
            return res.status(201).json({ success: true, message: "Tạo phiếu lắp đặt thiết bị thành công.", data: { install } });
    
        } catch (error) {
            return res.status(err.status || 400).json({ message: err.message });
        }
    };
    
    createUninstallTicket = async (req, res) => {
        try {
            const install = await this.equipmentInstallService.createUninstallTicket(req.user.userId, req.body);
            
            return res.status(201).json({ success: true, message: "Tạo phiếu tháo dỡ thiết bị thành công.", data: { install } });
    
        } catch (error) {
            return res.status(err.status || 400).json({ message: err.message });
        }
    };
    
    getAllEquipmentInstalls = async (req, res) => {
      try {
        const { counts, installs } = await this.equipmentInstallService.getAllEquipmentInstalls(req.query);
    
        res.status(200).json({ success: true, counts, installs });
    
      } catch (error) {
          return res.status(err.status || 400).json({ message: err.message });
      }
    };

    getSmartInstallSuggestions = async (req, res) => {
      try {
          const { roomId } = req.params;

          const result = await this.equipmentInstallService.getSmartInstallSuggestions(roomId);

          return res.status(200).json({ success: true, ...result });

      } catch (err) {
          return res.status(err.status || 400).json({ success: false, message: err.message });
      }
    };
    
    getMyInstallTickets = async (req, res) => {
      try {
        const { count, installs } = await this.equipmentInstallService.getMyInstallTickets(req.user.userId, req.query);
    
        res.status(200).json({ 
          success: true, 
          count, installs 
        });

      } catch (error) {
          return res.status(err.status || 400).json({ message: err.message });
      }
    };
    
    getEquipmentInstallById = async (req, res) => {
        try {
          const install = await this.equipmentInstallService.getEquipmentInstallById(req.params.id);
          
          res.status(200).json({ success: true, install });
      
        } catch (error) {
          return res.status(err.status || 400).json({ message: err.message });
        }
    };
    
    updateEquipmentInstall = async (req, res) => {
        try {
            const { install_ticket, details } = await this.equipmentInstallService.updateEquipmentInstall(req.params.id, req.body);

            return res.status(200).json({
              success: true,
              message: "Cập nhật phiếu lắp đặt thiết bị thành công.",
              data: {
                install_ticket,
                equipment_count: details.length,
              },
            });
    
        } catch (error) {
            return res.status(err.status || 400).json({ message: err.message });
        }
    };
    
    deleteEquipmentInstall = async (req, res) => {
      try {
        await this.equipmentInstallService.deleteEquipmentInstall(req.params.id);
    
        return res.status(200).json({
          success: true,
          message: "Đã xóa phiếu lắp đặt thiết bị thành công.",
        });
    
      } catch (error) {
          return res.status(err.status || 400).json({ message: err.message });
      }
    };

    confirmEquipmentInstall = async (req, res) => {
      try {
        const { install_id, equipment_count } = await this.equipmentInstallService.confirmEquipmentInstall(req.params.id);
        
        return res.status(200).json({
          success: true,
          message: "Xác nhận lắp đặt thiết bị thành công.",
          data: { install_id, equipment_count },
        });
    
      } catch (error) {
          return res.status(err.status || 400).json({ message: err.message });
      }
    };
    
    startInstallTicket = async (req, res) => {
      try {
        const { data } = await this.equipmentInstallService.startInstallTicket(req.params.id, req.user.userId);
    
        res.status(200).json({
          success: true,
          message: "Đã bắt đầu công việc.",
          data
        });

      } catch (error) {
          return res.status(err.status || 400).json({ message: err.message });
      }
    };
    
    completeInstallTicket = async (req, res) => {
      try {
        const { data } = await this.equipmentInstallService.completeInstallTicket(req.params.id, req.user.userId);

        res.status(200).json({
          success: true,
          message: "Đã hoàn thành công việc. Đang chờ admin xác nhận.",
          data
        });

      } catch (error) {
          return res.status(err.status || 400).json({ message: err.message });
      }
    };
}