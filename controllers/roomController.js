
import mongoose from "mongoose";
import { Room, RoomCategory} from "../models/index.js";

//-------ROOM CATEGORY------//

export const createRoomCategory = async (req, res) => {
    try {
        const { category_name, description, max_adults, max_children, bed_count, default_equipment, price } = req.body;

        if (!category_name || !description || !max_adults || !default_equipment || !price)
            return res.status(400).json({ success: false, message: "Vui lòng nhập đầy đủ thông tin bắt buộc!" });

        // Check duplicate
        const existing = await RoomCategory.findOne({ category_name });
        if (existing)
            return res.status(400).json({ success: false, message: "Tên loại phòng đã tồn tại!" });

        const roomCategory = new RoomCategory({
            category_name,
            description,
            max_adults,
            max_children,
            default_equipment,
            price,
        });

        await roomCategory.save();
        return res.status(200).json({ success: true, message: "Thêm loại phòng thành công!", roomCategory });

    } catch (err) {
        console.error(err);
        return res.status(500).json({ success: false, message: "SERVER ERROR", err: err.message });
    }
};

export const updateRoomCategory = async (req, res) => {
    try {
        const { id } = req.params;
        const updateData = req.body;

        if (!mongoose.Types.ObjectId.isValid(id))
            return res.status(400).json({ success: false, message: "ID không hợp lệ!" });

        const roomCategory = await RoomCategory.findById(id);
        if (!roomCategory)
            return res.status(404).json({ success: false, message: "Không tìm thấy loại phòng!" });

        // Prevent duplicate name
        if (updateData.category_name) {
            const duplicate = await RoomCategory.findOne({ category_name: updateData.category_name, _id: { $ne: id } });
            if (duplicate)
            return res.status(400).json({ success: false, message: "Tên loại phòng đã tồn tại!" });
        }

        const updated = await RoomCategory.findByIdAndUpdate(id, updateData, { new: true });
        return res.status(200).json({ success: true, message: "Cập nhật thành công!", roomCategory: updated });

    } catch (err) {
        console.error(err);
        return res.status(500).json({ success: false, message: "SERVER ERROR", err: err.message });
    }
};

export const deleteRoomCategory = async (req, res) => {
    try {
        const { id } = req.params;
        const force = req.query?.force === 'true';

        const deleted = await RoomCategory.findById(id);
        if (!deleted)
            return res.status(404).json({ success: false, message: "Không tìm thấy loại phòng!" });

        const relatedRoomCount = await Room.countDocuments({ category_id: id });
        if (relatedRoomCount > 0 && !force) {
            return res.status(400).json({ success: false, message: `Loại phòng này có ${relatedServiceCount} phòng. Dùng ?force=true để xóa tất cả các phòng thuộc loại phòng này.` });
        }
        if (force) {
            await Room.deleteMany({ category_id: id });
        }

        await RoomCategory.findByIdAndDelete(id);
        return res.status(200).json({ success: true, message: "Xóa loại phòng thành công!" });

    } catch (err) {
        console.error(err);
        return res.status(500).json({ success: false, message: "SERVER ERROR", err: err.message });
    }
};

export const getAllRoomCategories = async (req, res) => {
  try {
    const categories = await RoomCategory.find().populate("default_equipment.equipment", "name type").select("-created_at -updated_at -__v");
    return res.status(200).json({ success: true, count: categories.length, categories });

  } catch (err) {
    console.error(err);
    return res.status(500).json({ success: false, message: "SERVER ERROR", err: err.message });
  }
};

export const getRoomCategoryById = async (req, res) => {
  try {
    const { id } = req.params;

    const category = await RoomCategory.findById(id).populate("default_equipment.equipment", "name type").select("-created_at -updated_at -__v");
    if (!category)
      return res.status(404).json({ success: false, message: "Không tìm thấy loại phòng!" });

    return res.status(200).json({ success: true, category });
    
  } catch (err) {
    console.error(err);
    return res.status(500).json({ success: false, message: "SERVER ERROR", err: err.message });
  }
};


//------ ROOM ------//

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
            .select("-__v");

        if (!room)
            return res.status(404).json({ success: false, message: "Không tìm thấy phòng!" });

        return res.status(200).json({ success: true, room });

    } catch (err) {
        console.error(err);
        return res.status(500).json({ success: false, message: "SERVER ERROR", err: err.message });
    }
};

export const updateRoom = async (req, res) => {
    try {
        const { id } = req.params;
        const { category_id, room_number, room_status } = req.body;

        if (!mongoose.Types.ObjectId.isValid(id))
            return res.status(400).json({ success: false, message: "ID không hợp lệ!" });

        const room = await Room.findById(id);
        if (!room)
            return res.status(404).json({ success: false, message: "Không tìm thấy phòng!" });

        // Validate category_id if provided
        if (category_id) {
            if (!mongoose.Types.ObjectId.isValid(category_id))
                return res.status(400).json({ success: false, message: "ID loại phòng không hợp lệ!" });

            const category = await RoomCategory.findById(category_id);
            if (!category)
                return res.status(404).json({ success: false, message: "Không tìm thấy loại phòng!" });

            room.category_id = category_id;
        }

        // Validate and update room_number if provided
        if (room_number !== undefined) {
            const existing = await Room.findOne({ room_number, _id: { $ne: id } });
            if (existing)
                return res.status(400).json({ success: false, message: "Số phòng đã tồn tại!" });
            room.room_number = room_number;
        }

        // Validate and update room_status if provided
        if (room_status) {
            const validStatuses = ["available", "booked", "occupied", "cleaning", "maintenance"];
            if (!validStatuses.includes(room_status))
                return res.status(400).json({ success: false, message: "Trạng thái phòng không hợp lệ!" });
            room.room_status = room_status;
        }

        await room.save();
        const updatedRoom = await Room.findById(id)
            .populate("category_id", "category_name description max_adults max_children price")
            .select("-__v");

        return res.status(200).json({ success: true, message: "Cập nhật phòng thành công!", room: updatedRoom });

    } catch (err) {
        console.error(err);
        return res.status(500).json({ success: false, message: "SERVER ERROR", err: err.message });
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

