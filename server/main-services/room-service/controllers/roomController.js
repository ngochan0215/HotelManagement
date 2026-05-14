import { container } from "../containers/container.js";

export class RoomController {
    constructor() {
        this.roomService = container.roomService;
        this.roomStatisticService = container.roomStatisticService;
    }

    // category 

    createRoomCategory = async (req, res) => {
        try {
            const result = await this.roomService.createRoomCategoryService(req.body, req.files);

            return res.status(201).json({ success: true, message: "Add room category successfully!", ...result });

        } catch (err) {
            return res.status(err.status || 400).json({ message: err.message });
        }
    };
      
    updateRoomCategory = async (req, res) => {
        try {
            const category = await this.roomService.updateRoomCategoryService(
                req.params.id,
                req.body,
                req.files
            );

            return res.status(200).json({ message: "Update room category successfully!", category });

        } catch (err) {
            return res.status(err.status || 400).json({ message: err.message });
        }
    };
    
    deleteRoomCategory = async (req, res) => {
        try {
            const result = await this.roomService.deleteRoomCategoryService(
                req.params.id,
                req.query.force === "true"
            );
        
            if (result?.needConfirm) {
                return res.status(409).json({
                    code: "CATEGORY_HAS_ROOMS",
                    roomCount: result.roomCount,
                    message: `Loại phòng này đang có ${result.roomCount} phòng. Bạn có muốn xóa tất cả phòng liên quan không?`
                });
            }
        
            return res.status(200).json({ message: "Delete room category successfully!" });
        } catch (err) {
            return res.status(err.status || 400).json({ message: err.message });
        }
    };
    
    getAllRoomCategories = async (req, res) => {
        try {
            const { data, pagination } = await this.roomService.getAllRoomCategoriesService(req.query);

            return res.status(200).json(data);

        } catch (err) {
            return res.status(err.status || 400).json({ message: err.message });
        }
    };
      
    getRoomCategoryById = async (req, res) => {
        try {
            const data = await this.roomService.getRoomCategoryByIdService(req.params.id);
            
            return res.status(200).json(data);

        } catch (err) {
            return res.status(err.status || 400).json({ message: err.message });
        }
    };
      
    getDefaultEquipmentsByCategory = async (req, res) => {
        try {
            const data = await this.roomService.getDefaultEquipmentsService(req.params.id);
        
            return res.status(200).json({
                success: true,
                count: data.length,
                default_equipments: data
            });

        } catch (err) {
            return res.status(err.status || 400).json({ message: err.message });
        }
    };
    
    getAvailableRoomCategories = async (req, res) => {
        try {
            const data = await this.roomService.getAvailableRoomCategoriesService(req.query);
            
            return res.status(200).json(data);

        } catch (err) {
            return res.status(err.status || 400).json({ message: err.message });
        }
    };

    // room

    getRoomById = async (req, res) => {
        try {
            const room = await this.roomService.getRoomById(req.params.id);
            
            return res.status(200).json({ room });

        } catch (err) {
            return res.status(err.status || 400).json({ message: err.message });
        }
    }

    createRoom = async (req, res) => {
        try {
            const room = await this.roomService.createRoom(req.body);

            return res.status(201).json({ success: true, message: "Add new room successfully!", room });

        } catch (err) {
            return res.status(err.status || 400).json({ message: err.message });
        }
    };
    
    getAllRooms = async (req, res) => {
        try {
            const { data, pagination } = await this.roomService.getAllRooms(req.query);
            
            return res.status(200).json({ success: true, data, pagination });
    
        } catch (err) {
            return res.status(err.status || 400).json({ message: err.message });
        }
    };
    
    updateRoom = async (req, res) => {
        try {
            const updatedRoom = await this.roomService.updateRoom(req.body, req.params.id, req.user.userId);
        
            return res.status(200).json({
                success: true,
                message: "Cập nhật phòng thành công!",
                room: updatedRoom,
            });
        
        } catch (err) {
            return res.status(err.status || 400).json({ message: err.message });
        } 
    };
    
    deleteRoom = async (req, res) => {
        try {
            await this.roomService.deleteRoom(req.params.id);
            return res.status(200).json({ success: true, message: "Xóa phòng thành công!" });
    
        } catch (err) {
            return res.status(err.status || 400).json({ message: err.message });
        }
    };
    
    completeMaintenance = async (req, res) => {
        try {
            await this.roomService.completeMaintenance(req.params.id, req.user.userId);
            
            return res.status(200).json({ success: true, message: "Phòng đã hoàn tất bảo trì."});
        
        } catch (err) {
            return res.status(err.status || 400).json({ message: err.message });
        }
    };
    
    completeCleaning = async (req, res) => {
        try {
            await this.roomService.completeCleaning(req.params.id, req.user.userId);
            
            return res.status(200).json({ success: true, message: "Phòng đã hoàn tất dọn dẹp."});
        
        } catch (err) {
            return res.status(err.status || 400).json({ message: err.message });
        }
    };
    
    getRoomsByCategory = async (req, res) => {
        try {
            const categoriesWithRooms = await this.roomService.getRoomsByCategory(req.query);
    
            return res.status(200).json({
                success: true,
                category_count: categoriesWithRooms.length,
                categories: categoriesWithRooms,
            });

        } catch (err) {
            return res.status(err.status || 400).json({ message: err.message });
        }
    };

    // statistics
    
    getRoomStatusSummary = async (req, res) => {
        try {
            const summary = await this.roomStatisticService.getRoomStatusSummary();
            
            return res.status(200).json({ success: true, ...summary });
        
        } catch (err) {
            return res.status(err.status || 400).json({ message: err.message });
        }
    };
    
    getTopBookedRoomCategories = async (req, res) => {
        try {
            const result = await this.roomStatisticService.getTopBookedRoomCategories(req.query);
            
            return res.status(200).json({ success: true, result });
        
        } catch (err) {
            return res.status(err.status || 400).json({ message: err.message });
        }
    };
    
    getLatestStatusOfAllRooms = async (req, res) => {
        try {
            const result = await this.roomStatisticService.getLatestStatusOfAllRooms();
            
            return res.status(200).json({ success: true, data: result });

        } catch (err) {
            return res.status(err.status || 400).json({ message: err.message });
        }
    };

    getCalendarRooms = async (req, res) => {
        try {
            const { rooms, events } = await this.roomStatisticService.getCalendarRooms(req.query);
            
            return res.status(200).json({ success: true, rooms, events });

        } catch (err) {
            return res.status(err.status || 400).json({ message: err.message });
        }
    };

    generateRoomReport = async (req, res) => {
        try {
            const { from, to } = req.query;
            const report = await this.roomStatisticService.generateRoomReport(from, to);
            
            return res.status(201).json(report);

        } catch (err) {
            return res.status(err.status || 400).json({ message: err.message });
        }
    };

    exportRoomReportExcel = async (req, res, next) => {
        try {
            const { from, to } = req.query;
            const workbook = await this.roomStatisticService.exportRoomReportExcel(from, to);
        
            res.setHeader(
                "Content-Type",
                "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet"
            );
            res.setHeader(
                "Content-Disposition",
                "attachment; filename=bao_cao_phong.xlsx"
            );
        
            await workbook.xlsx.write(res);
            res.end();

        } catch (error) {
            next(error);
        }
    };

    exportRoomReportPDF = async (req, res, next) => {
        try {
            const { from, to } = req.query;
            const doc = await this.roomStatisticService.exportRoomReportPDF(from, to);

            res.setHeader("Content-Type", "application/pdf");

            res.setHeader(
                "Content-Disposition",
                `attachment; filename=bao_cao_phong_${Date.now()}.pdf`
            );

            doc.pipe(res);
            
        } catch (err) {
            next(err);
        }
    };
}