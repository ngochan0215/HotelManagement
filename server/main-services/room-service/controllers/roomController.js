import { container } from "../containers/container.js";

export class RoomController {
    constructor() {
        this.roomService = container.roomService;
    }

    createRoomCategory = async (req, res) => {
        try {
            const result = await this.roomService.createRoomCategoryService(req.body, req.files);

            res.status(201).json({ success: true, message: "Thêm danh mục phòng thành công", ...result });

        } catch (err) {
            res.status(400).json({ success: false, message: err.message });
        }
    };
    
    
    updateRoomCategory = async (req, res) => {
        try {
            const category = await this.roomService.updateRoomCategoryService(
                req.params.id,
                req.body,
                req.files
            );
            res.status(200).json({ message: "Cập nhật danh mục phòng thành công", category });

        } catch (err) {
            res.status(400).json({ message: err.message });
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
                    roomCount: result.roomCount
                });
            }
        
            res.status(200).json({ message: "Xóa thành công" });
        } catch (err) {
            res.status(400).json({ message: err.message });
        }
    };
    
    
    getAllRoomCategories = async (req, res) => {
        try {
            const data = await this.roomService.getAllRoomCategoriesService();
            res.status(200).json(data);
        } catch (err) {
            res.status(500).json({ message: err.message });
        }
    };
    
    
    getRoomCategoryById = async (req, res) => {
        try {
            const data = await this.roomService.getRoomCategoryByIdService(req.params.id);
            res.status(200).json(data);
        } catch (err) {
            res.status(400).json({ message: err.message });
        }
    };
    
    
    getDefaultEquipmentsByCategory = async (req, res) => {
        try {
            const data = await this.roomService.getDefaultEquipmentsService(req.params.category_id);
        
            res.status(200).json({
                success: true,
                count: data.length,
                default_equipments: data
            });

        } catch (err) {
            res.status(400).json({ message: err.message });
        }
    };
    
    // getAvailableRoomCategories = async (req, res) => {
    //     try {
    //         const data = await this.roomService.getAvailableRoomCategoriesService(req.query);
    //         res.status(200).json(data);
    //     } catch (err) {
    //         res.status(400).json({ message: err.message });
    //     }
    // };

    getRoomById = async (req, res) => {
        try {
            const room = await this.roomService.getRoomById(req.params.id);
            return res.status(200).json({ room });
        } catch (error) {
            return res.status(500).json({ message: "SERVER ERROR: " + error.message });
        }
    }

    createRoom = async (req, res) => {
        try {
            const room = await this.roomService.createRoom(req.body);

            return res.status(201).json({ success: true, message: "Thêm phòng thành công!", room });

        } catch (err) {
            console.error(err);
            return res.status(500).json({ success: false, message: "SERVER ERROR", err: err.message });
        }
    };
    
    getAllRooms = async (req, res) => {
        try {
            const { count, rooms } = await this.roomService.getAllRooms(req.query);
            return res.status(200).json({ success: true, count, rooms });
    
        } catch (err) {
            console.error(err);
            return res.status(500).json({ success: false, message: "SERVER ERROR", err: err.message });
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
            return res.status(500).json({ success: false, message: "SERVER ERROR: " + err.message });
        } 
    };
    
    deleteRoom = async (req, res) => {
        try {
            await this.roomService.deleteRoom(req.params.id);
            return res.status(200).json({ success: true, message: "Xóa phòng thành công!" });
    
        } catch (err) {
            return res.status(500).json({ success: false, message: "SERVER ERROR", err: err.message });
        }
    };
    
    completeMaintenance = async (req, res) => {
        try {
            await this.roomService.completeMaintenance(req.params.id, req.user.userId);
            return res.status(200).json({ success: true, message: "Phòng đã hoàn tất bảo trì."});
        
        } catch (error) {
            return res.status(400).json({ message: error.message || "Không thể xác nhận bảo trì." });
        }
    };
    
    completeCleaning = async (req, res) => {
        try {
            await this.roomService.completeCleaning(req.params.id, req.user.userId);
            return res.status(200).json({ success: true, message: "Phòng đã hoàn tất dọn dẹp."});
        
        } catch (error) {
            return res.status(400).json({ message: error.message || "Không thể xác nhận dọn dẹp." });
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
            return res.status(500).json({ success: false, message: "SERVER ERROR", err: err.message });
        }
    };
    
    getRoomStatusSummary = async (req, res) => {
        try {
            const summary = await this.roomService.getRoomStatusSummary();
            return res.status(200).json({ success: true, summary });
        
        } catch (error) {
            return res.status(500).json({
                success: false,
                message: "Không thống kê được tình trạng các phòng ở hiện tại.",
                error: error.message,
            });
        }
    };
    
    getTopBookedRoomCategories = async (req, res) => {
        try {
            const result = await this.roomService.getTopBookedRoomCategories(req.query);
            return res.status(200).json({ success: true, result: result.result });
        
        } catch (error) {
            return res.status(500).json({
                success: false,
                message: "Không lấy được danh sách các loại phòng được đặt nhiều nhất.",
                error: error.message,
            });
        }
    };
    
    getLatestStatusOfAllRooms = async (req, res) => {
        try {
            const result = await this.roomService.getLatestStatusOfAllRooms();
            return res.status(200).json({ success: true, data: result });

        } catch (error) {
            return res.status(500).json({
                success: false,
                message: "Không lấy được danh sách log trạng thái mới nhất của các phòng.",
                error: error.message,
            });
        }
    };
    
    // getRoomEquipments = async (req, res) => {
    //   try {
    //     const equipments = await this.roomService.getRoomEquipments(req.params.id);
    //     return res.status(200).json({
    //       message: "Lấy danh sách thiết bị thành công.",
    //       data: equipments
    //     });
    //   } catch (err) {
    //     return res.status(500).json({
    //       message: err.message || "Lỗi khi lấy danh sách thiết bị."
    //     });
    //   }
    // };
    
    // // update tình trạng phòng dựa trên status+condition của thiết bị
    // reevaluateRoomStatus = async (req, res) => {
    //   try {
    //     await roomService.reevaluateRoomStatus(req.params.id);
    //     return res.status(200).json({
    //       success: true,
    //       message: "Đánh giá lại tình trạng phòng thành công!",
    //     });
    //   } catch (err) {
    //     console.error(err);
    //     return res.status(500).json({ success: false, message: "SERVER ERROR", err: err.message });
    //   }
    // };
}