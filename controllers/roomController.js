import mongoose from "mongoose";
import { Room, RoomCategory, DefaultEquipment, BookingDetail, Booking, CheckInOut, RoomStatusLog } from "../models/index.js";

// ROOM
export const createRoom = async (req, res) => {
    try {
        const { category_id, room_number, room_status } = req.body;

        if (!category_id || !room_number)
            return res.status(400).json({ success: false, message: "Vui lòng nhập đầy đủ thông tin bắt buộc (category_id, room_number)!" });

        // Validate category_id
        if (!mongoose.Types.ObjectId.isValid(category_id))
            return res.status(400).json({ success: false, message: "ID loại phòng không hợp lệ!" });

        const category = await RoomCategory.findById(category_id);
        if (!category)
            return res.status(404).json({ success: false, message: "Không tìm thấy loại phòng!" });

        // Check duplicate room_number
        const existing = await Room.findOne({ room_number });
        if (existing)
            return res.status(400).json({ success: false, message: "Số phòng đã tồn tại!" });

        // Validate room_status if provided
        const validStatuses = ["available", "booked", "occupied", "cleaning", "maintenance"];
        if (room_status && !validStatuses.includes(room_status))
            return res.status(400).json({ success: false, message: "Trạng thái phòng không hợp lệ!" });

        const room = new Room({ category_id, room_number, room_status: room_status || "available" });

        await room.save();
        const populatedRoom = await Room.findById(room._id).populate("category_id", "category_name description max_adults max_children price").select("-__v");

        return res.status(201).json({ success: true, message: "Thêm phòng thành công!", room: populatedRoom });

    } catch (err) {
        console.error(err);
        return res.status(500).json({ success: false, message: "SERVER ERROR", err: err.message });
    }
};

export const getAllRooms = async (req, res) => {
    try {
        const { category_id, room_status, room_number } = req.query;
        const filter = {};

        if (category_id) {
            if (!mongoose.Types.ObjectId.isValid(category_id))
                return res.status(400).json({ success: false, message: "ID loại phòng không hợp lệ!" });
            filter.category_id = category_id;
        }

        if (room_status) {
            const validStatuses = ["available", "booked", "occupied", "cleaning", "maintenance"];
            if (!validStatuses.includes(room_status))
                return res.status(400).json({ success: false, message: "Trạng thái phòng không hợp lệ!" });
            filter.room_status = room_status;
        }

        if (room_number) {
            filter.room_number = parseInt(room_number);
        }

        const rooms = await Room.find(filter)
            .populate("category_id", "category_name description max_adults max_children price")
            .populate({
                path: "roomStatusLog",
                match: {
                start_time: { $lte: new Date() },
                end_time: { $gte: new Date() },
                },
                select: "status start_time end_time note",
            })
            .select("-__v")
            .sort({ room_number: 1 });

        return res.status(200).json({ success: true, count: rooms.length, rooms });

    } catch (err) {
        console.error(err);
        return res.status(500).json({ success: false, message: "SERVER ERROR", err: err.message });
    }
};

export const getRoomById = async (req, res) => {
    try {
        const { id } = req.params;

        if (!mongoose.Types.ObjectId.isValid(id))
            return res.status(400).json({ success: false, message: "ID không hợp lệ!" });

        const room = await Room.findById(id)
            .populate("category_id", "category_name description max_adults max_children price")
            .populate({
                path: "roomStatusLog",
                match: {
                start_time: { $lte: new Date() },
                end_time: { $gte: new Date() },
                },
                select: "status start_time end_time note",
            })
            .select("-__v")

        if (!room)
            return res.status(404).json({ success: false, message: "Không tìm thấy phòng!" });

        return res.status(200).json({
            success: true,
            room
        });

    } catch (err) {
        console.error(err);
        return res.status(500).json({ success: false, message: "SERVER ERROR", err: err.message });
    }
};

export const updateRoom = async (req, res) => {
    try {
        const { id } = req.params;
        const { category_id, room_number, room_status, start_time, end_time, note } = req.body;

        if (!mongoose.Types.ObjectId.isValid(id))
            return res.status(400).json({ success: false, message: "ID không hợp lệ!" });

        const room = await Room.findById(id);
        if (!room)
            return res.status(404).json({ success: false, message: "Không tìm thấy phòng!" });

        if (category_id) {
            if (!mongoose.Types.ObjectId.isValid(category_id))
                return res.status(400).json({ success: false, message: "ID loại phòng không hợp lệ!" });

            const category = await RoomCategory.findById(category_id);
            if (!category)
                return res.status(404).json({ success: false, message: "Không tìm thấy loại phòng!" });

            room.category_id = category_id;
        }

        if (room_number !== undefined) {
            const existing = await Room.findOne({ room_number, _id: { $ne: id } });
            if (existing)
                return res.status(400).json({ success: false, message: "Số phòng đã tồn tại!" });

            room.room_number = room_number;
        }

        if (room_status) {
            const validStatuses = ["available", "booked", "occupied", "cleaning", "maintenance"];
            if (!validStatuses.includes(room_status))
                return res.status(400).json({ success: false, message: "Trạng thái phòng không hợp lệ!" });

            // Nếu là cleaning / maintenance thì bắt buộc có timeline
            if (["cleaning", "maintenance"].includes(room_status)) {
                if (!start_time || !end_time)
                    return res.status(400).json({
                        success: false,
                        message: "Cần cung cấp start_time và end_time cho cleaning / maintenance!",
                    });

                if (new Date(end_time) <= new Date(start_time))
                    return res.status(400).json({
                        success: false,
                        message: "end_time phải sau start_time!",
                    });

                // Ghi log trạng thái phòng
                await RoomStatusLog.create({
                    room_id: room._id,
                    status: room_status,
                    start_time,
                    end_time,
                    note: note || "",
                    handled_by: req.user?._id || null,
                });
            }

            room.room_status = room_status;
        }

        await room.save();

        const updatedRoom = await Room.findById(id)
            .populate("category_id", "category_name description max_adults max_children price")
            .select("-__v");

        return res.status(200).json({
            success: true,
            message: "Cập nhật phòng thành công!",
            room: updatedRoom,
        });

    } catch (err) {
        console.error(err);
        return res.status(500).json({
            success: false,
            message: "SERVER ERROR",
            err: err.message,
        });
    }
};

export const deleteRoom = async (req, res) => {
    try {
        const { id } = req.params;

        if (!mongoose.Types.ObjectId.isValid(id))
            return res.status(400).json({ success: false, message: "ID không hợp lệ!" });

        const room = await Room.findById(id);
        if (!room)
            return res.status(404).json({ success: false, message: "Không tìm thấy phòng!" });

        // Check if room is currently booked or occupied
        if (room.room_status === "booked" || room.room_status === "occupied") {
            return res.status(400).json({ 
                success: false, 
                message: `Không thể xóa phòng đang ở trạng thái "${room.room_status}". Vui lòng thay đổi trạng thái trước khi xóa!` 
            });
        }

        await Room.findByIdAndDelete(id);
        return res.status(200).json({ success: true, message: "Xóa phòng thành công!" });

    } catch (err) {
        console.error(err);
        return res.status(500).json({ success: false, message: "SERVER ERROR", err: err.message });
    }
};


// Group all rooms by category (including categories with zero rooms)
export const getRoomsByCategory = async (req, res) => {
    try {
        const { room_status } = req.query;

        const validStatuses = ["available", "booked", "occupied", "cleaning", "maintenance"];
        if (room_status && !validStatuses.includes(room_status)) {
            return res.status(400).json({ success: false, message: "Trạng thái phòng không hợp lệ!" });
        }

        const pipeline = [
            {
                $lookup: {
                    from: "rooms",
                    localField: "_id",
                    foreignField: "category_id",
                    as: "rooms",
                },
            },
            // Optional filter rooms by status if provided
            ...(room_status
                ? [
                    {
                        $addFields: {
                            rooms: {
                                $filter: {
                                    input: "$rooms",
                                    as: "r",
                                    cond: { $eq: ["$$r.room_status", room_status] },
                                },
                            },
                        },
                    },
                ]
                : []),
            {
                $addFields: {
                room_count: { $size: "$rooms" },
                available_count: {
                    $size: {
                    $filter: {
                        input: "$rooms",
                        as: "r",
                        cond: { $eq: ["$$r.room_status", "available"] },
                    },
                    },
                },
                booked_count: {
                    $size: {
                    $filter: {
                        input: "$rooms",
                        as: "r",
                        cond: { $eq: ["$$r.room_status", "booked"] },
                    },
                    },
                },
                occupied_count: {
                    $size: {
                    $filter: {
                        input: "$rooms",
                        as: "r",
                        cond: { $eq: ["$$r.room_status", "occupied"] },
                    },
                    },
                },
                cleaning_count: {
                    $size: {
                    $filter: {
                        input: "$rooms",
                        as: "r",
                        cond: { $eq: ["$$r.room_status", "cleaning"] },
                    },
                    },
                },
                maintenance_count: {
                    $size: {
                    $filter: {
                        input: "$rooms",
                        as: "r",
                        cond: { $eq: ["$$r.room_status", "maintenance"] },
                    },
                    },
                },
                },
            },
            {
                $project: {
                    __v: 0,
                    created_at: 0,
                    updated_at: 0,
                    max_adults: 0,
                    max_children: 0,
                    default_equipment: 0,
                    "rooms.__v": 0,
                    "rooms.category_id": 0,
                    "rooms.created_at": 0,
                    "rooms.updated_at": 0
                },
            },
            { $sort: { price: 1, category_name: 1 } },
        ];

        const categoriesWithRooms = await RoomCategory.aggregate(pipeline);

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
    const result = await Room.aggregate([
      {
        $group: {
          _id: "$room_status",
          count: { $sum: 1 },
        },
      },
    ]);

    const summary = {
      available: 0,
      booked: 0,
      occupied: 0,
      cleaning: 0,
      maintenance: 0,
      total: 0,
    };

    result.forEach(item => {
      summary[item._id] = item.count;
      summary.total += item.count;
    });

    return res.json(summary);

  } catch (error) {
    return res.status(500).json({
      message: "Không thống kê được tình trạng các phòng ở hiện tại.",
      error: error.message,
    });
  }
};

// trả về những phòng được đặt nhiều nhất
export const getTopBookedRoomCategories = async (req, res) => {
  try {
    const limit = parseInt(req.query.limit, 10) || 5;

    const result = await BookingDetail.aggregate([
      // join sang Room
      {
        $lookup: {
          from: "rooms",
          localField: "room_id",
          foreignField: "_id",
          as: "room",
        },
      },
      { $unwind: "$room" },

      // group theo category
      {
        $group: {
          _id: "$room.category_id",
          totalBooked: { $sum: 1 },
        },
      },

      // sort giảm dần
      { $sort: { totalBooked: -1 } },

      // limit
      { $limit: limit },

      // join sang RoomCategory
      {
        $lookup: {
          from: "roomcategories",
          localField: "_id",
          foreignField: "_id",
          as: "category",
        },
      },
      { $unwind: "$category" },

      // kết quả trả về cúi cùm
      {
        $project: {
          _id: 0,
          category_id: "$_id",
          name: "$category.category_name",
          price: "$category.price",
          totalBooked: 1,
        },
      },
    ]);

    return res.json(result);

  } catch (error) {
    return res.status(500).json({
      message: "Không lấy được danh sách các loại phòng được đặt nhiều nhất.",
      error: error.message,
    });
  }
};