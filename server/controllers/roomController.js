import mongoose from "mongoose";
import { Room, RoomCategory, RoomLog, BookingDetail, Booking, 
  RoomStatusLog, Equipment, Employee 
} from "../models/index.js";
import * as roomService from "../services/roomService.js";

// ROOM
export const createRoom = async (req, res) => {
    try {
        const room = await roomService.createRoom(req.body);
        return res.status(201).json({ success: true, message: "Thêm phòng thành công!", room });
    } catch (err) {
        console.error(err);
        return res.status(500).json({ success: false, message: "SERVER ERROR", err: err.message });
    }
};

export const getAllRooms = async (req, res) => {
    try {
        const { count, rooms } = await roomService.getAllRooms(req.query);
        return res.status(200).json({ success: true, count, rooms });

    } catch (err) {
        console.error(err);
        return res.status(500).json({ success: false, message: "SERVER ERROR", err: err.message });
    }
};

export const getRoomById = async (req, res) => {
    try {
        const { id } = req.params;
        const room = await roomService.getRoomById(id);

        return res.status(200).json({ success: true, room });

    } catch (err) {
        console.error(err);
        return res.status(500).json({ success: false, message: "SERVER ERROR", err: err.message });
    }
};

export const updateRoom = async (req, res) => {
  const session = await mongoose.startSession();
  session.startTransaction();

  try {
    const updatedRoom = await roomService.updateRoom(req.params.id, req.body);

    return res.status(200).json({
      success: true,
      message: "Cập nhật phòng thành công!",
      room: updatedRoom,
    });

  } catch (err) {
    await session.abortTransaction();
    console.error(err);
    return res.status(500).json({ success: false, message: "SERVER ERROR: " + err.message });
  } finally {
    session.endSession();
  }
};

export const deleteRoom = async (req, res) => {
    try {
        await roomService.deleteRoom(req.params.id);
        return res.status(200).json({ success: true, message: "Xóa phòng thành công!" });

    } catch (err) {
        console.error(err);
        return res.status(500).json({ success: false, message: "SERVER ERROR", err: err.message });
    }
};

// xác nhận hoàn thành bảo trì
export const completeMaintenance = async (req, res) => {
  try {
    await roomService.completeMaintenance(req.params.id, req.user._id);
    return res.status(200).json({ success: true, message: "Phòng đã hoàn tất bảo trì."});

  } catch (error) {
    await session.abortTransaction();
    session.endSession();
    return res.status(400).json({ message: error.message || "Không thể xác nhận bảo trì." });
  }
};

// xác nhận hoàn thành dọn dẹp
export const completeCleaning = async (req, res) => {
  try {
    await roomService.completeCleaning(req.params.id, req.user._id);
    return res.status(200).json({ success: true, message: "Phòng đã hoàn tất dọn dẹp."});

  } catch (error) {
    await session.abortTransaction();
    session.endSession();
    return res.status(400).json({ message: error.message || "Không thể xác nhận dọn dẹp." });
  }
};

// Group all rooms by category (including categories with zero rooms)
export const getRoomsByCategory = async (req, res) => {
    try {
        const categoriesWithRooms = await roomService.getRoomsByCategory(req.query);

        return res.status(200).json({
            success: true,
            category_count: categoriesWithRooms.length,
            categories: categoriesWithRooms,
        });
    } catch (err) {
        console.error(err);
        return res.status(500).json({ success: false, message: "SERVER ERROR", err: err.message });
    }
};

// trả về số lượng phòng group by tình trạng
export const getRoomStatusSummary = async (req, res) => {
  try {
    const summary = await roomService.getRoomStatusSummary();
    return res.status(200).json({ success: true, summary });

  } catch (error) {
    return res.status(500).json({
      success: false,
      message: "Không thống kê được tình trạng các phòng ở hiện tại.",
      error: error.message,
    });
  }
};

// trả về những phòng được đặt nhiều nhất
export const getTopBookedRoomCategories = async (req, res) => {
  try {
    const result = await roomService.getTopBookedRoomCategories(req.query);
    return res.status(200).json({ success: true, result: result.result });

  } catch (error) {
    return res.status(500).json({
      success: false,
      message: "Không lấy được danh sách các loại phòng được đặt nhiều nhất.",
      error: error.message,
    });
  }
};

// trả về các log trạng thái mới nhất của các phòng
export const getLatestStatusOfAllRooms = async (req, res) => {
  try {
    const result = await roomService.getLatestStatusOfAllRooms();
    return res.status(200).json({ success: true, data: result });
  } catch (error) {
    return res.status(500).json({
      success: false,
      message: "Không lấy được danh sách log trạng thái mới nhất của các phòng.",
      error: error.message,
    });
  }
};

// trả về danh sách thiết bị trong phòng
export const getRoomEquipments = async (req, res) => {
  try {
    const equipments = await roomService.getRoomEquipments(req.params.id);
    return res.status(200).json({
      message: "Lấy danh sách thiết bị thành công.",
      data: equipments
    });
  } catch (err) {
    return res.status(500).json({
      message: err.message || "Lỗi khi lấy danh sách thiết bị."
    });
  }
};

// update tình trạng phòng dựa trên status+condition của thiết bị
export const reevaluateRoomStatus = async (req, res) => {
  try {
    await roomService.reevaluateRoomStatus(req.params.id);
    return res.status(200).json({
      success: true,
      message: "Đánh giá lại tình trạng phòng thành công!",
    });
  } catch (err) {
    console.error(err);
    return res.status(500).json({ success: false, message: "SERVER ERROR", err: err.message });
  }
};
