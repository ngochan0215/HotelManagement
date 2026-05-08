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
    
    // getSmartInstallSuggestions = async (req, res) => {
    //   try {
    //     const { room_id } = req.query;
    
    //     if (!room_id) {
    //       return res.status(400).json({
    //         success: false,
    //         message: "Vui lòng cung cấp room_id"
    //       });
    //     }
    
    //     // Lấy thông tin phòng
    //     const room = await Room.findById(room_id).populate("category_id", "_id category_name");
    //     if (!room) {
    //       return res.status(404).json({
    //         success: false,
    //         message: "Không tìm thấy phòng"
    //       });
    //     }
    
    //     if (!room.category_id) {
    //       return res.status(400).json({
    //         success: false,
    //         message: "Phòng này chưa có loại phòng"
    //       });
    //     }
    
    //     // Lấy danh sách thiết bị mặc định của loại phòng này
    //     const defaultEquipments = await DefaultEquipment.find({
    //       category_id: room.category_id._id
    //     }).populate("equipment_category_id", "name description unit");
    
    //     if (defaultEquipments.length === 0) {
    //       return res.status(200).json({
    //         success: true,
    //         suggestions: [],
    //         message: "Loại phòng này không có thiết bị mặc định"
    //       });
    //     }
    
    //     // Lấy danh sách thiết bị hiện có trong phòng (status = "in-use")
    //     const currentEquipments = await Equipment.find({
    //       room_id: room_id,
    //       status: "in-use"
    //     }).populate("category_id", "_id name");
    
    //     // Đếm số lượng từng loại thiết bị hiện có trong phòng
    //     const currentEquipmentCount = {};
    //     currentEquipments.forEach(eq => {
    //       const catId = eq.category_id?._id?.toString() || eq.category_id?.toString();
    //       if (catId) {
    //         currentEquipmentCount[catId] = (currentEquipmentCount[catId] || 0) + 1;
    //       }
    //     });
    
    //     // Kiểm tra số lượng thiết bị có sẵn trong kho (status = "in-stock")
    //     const stockEquipmentCount = {};
    //     const stockEquipments = await Equipment.find({
    //       status: "in-stock",
    //       room_id: null,
    //       condition: { $in: ["new", "good"] }
    //     }).populate("category_id", "_id name");
        
    //     stockEquipments.forEach(eq => {
    //       const catId = eq.category_id?._id?.toString() || eq.category_id?.toString();
    //       if (catId) {
    //         stockEquipmentCount[catId] = (stockEquipmentCount[catId] || 0) + 1;
    //       }
    //     });
    
    //     // So sánh với thiết bị mặc định và tạo danh sách gợi ý
    //     const suggestions = [];
    //     for (const defaultEq of defaultEquipments) {
    //       const equipmentCategoryId = defaultEq.equipment_category_id?._id?.toString() || defaultEq.equipment_category_id?.toString();
    //       const requiredQuantity = defaultEq.quantity || 0;
    //       const currentQuantity = currentEquipmentCount[equipmentCategoryId] || 0;
    //       const neededQuantity = requiredQuantity - currentQuantity;
    //       const availableInStock = stockEquipmentCount[equipmentCategoryId] || 0;
    
    //       // Chỉ gợi ý nếu thiếu thiết bị (neededQuantity > 0) và có sẵn trong kho
    //       if (neededQuantity > 0 && availableInStock > 0) {
    //         // Số lượng gợi ý = min(neededQuantity, availableInStock)
    //         const suggestedQuantity = Math.min(neededQuantity, availableInStock);
            
    //         suggestions.push({
    //           category_id: equipmentCategoryId,
    //           category_name: defaultEq.equipment_category_id?.name || "Unknown",
    //           category_description: defaultEq.equipment_category_id?.description || "",
    //           category_unit: defaultEq.equipment_category_id?.unit || "item",
    //           required_quantity: requiredQuantity,
    //           current_quantity: currentQuantity,
    //           needed_quantity: neededQuantity,
    //           available_in_stock: availableInStock,
    //           suggested_quantity: suggestedQuantity,
    //           reason: currentQuantity === 0 
    //             ? `Thiết bị chưa có trong phòng (cần ${requiredQuantity}, có ${availableInStock} trong kho)` 
    //             : `Thiếu ${neededQuantity} ${defaultEq.equipment_category_id?.unit || "cái"} (hiện có ${currentQuantity}/${requiredQuantity}, có ${availableInStock} trong kho)`
    //         });
    //       }
    //     }
    
    //     // Sắp xếp theo thứ tự ưu tiên: thiết bị chưa có trước, sau đó là thiết bị thiếu
    //     suggestions.sort((a, b) => {
    //       if (a.current_quantity === 0 && b.current_quantity > 0) return -1;
    //       if (a.current_quantity > 0 && b.current_quantity === 0) return 1;
    //       return b.needed_quantity - a.needed_quantity;
    //     });
    
    //     return res.status(200).json({
    //       success: true,
    //       room_id: room_id,
    //       room_number: room.room_number,
    //       room_category: room.category_id.category_name,
    //       suggestions: suggestions,
    //       total_suggestions: suggestions.length
    //     });
    
    //   } catch (error) {
    //     console.error("Error in getSmartInstallSuggestions:", error);
    //     return res.status(500).json({
    //       success: false,
    //       message: "Lỗi server: " + error.message
    //     });
    //   }
    // };
    
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