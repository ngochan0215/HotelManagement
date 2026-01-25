import mongoose from "mongoose";
import { Room, RoomCategory, DefaultEquipment, Booking, BookingDetail, RoomLog 
} from "../models/index.js";

export const createRoomCategory = async (req, res) => {
    try {
        const { category_name, description, max_adults, max_children, default_equipments, price } = req.body;

        if (!category_name || !description || !max_adults || !price)
            return res.status(400).json({ success: false, message: "Vui lòng nhập đầy đủ thông tin bắt buộc!" });

        // Check duplicate
        const existing = await RoomCategory.findOne({ category_name });
        if (existing)
            return res.status(400).json({ success: false, message: "Tên loại phòng đã tồn tại!" });

        let equipmentList = [];
        if (typeof default_equipments === "string") {
            try {
                equipmentList = JSON.parse(default_equipments);
            } catch (e) {
                return res.status(400).json({ message: "Dữ liệu thiết bị mặc định (default_equipments) không phải là chuỗi JSON hợp lệ." });
            }
        }
        else if (Array.isArray(default_equipments)) {
            equipmentList = default_equipments;
        }
        else {
            return res.status(400).json({ message: "Danh sách thiết bị mặc định không hợp lệ" });
        }

        if (!equipmentList || equipmentList.length === 0) {
            return res.status(400).json({
                success: false,
                message: "Vui lòng chọn ít nhất một thiết bị mặc định"
            });
        }

        let images = [];
        if (req.files && req.files.length > 0) {
            images = req.files.map((file) => file.path); 
        }

        const roomCategory = new RoomCategory({
            category_name,
            description,
            max_adults,
            max_children,
            price,
            images
        });
        await roomCategory.save();

        const items = equipmentList.map(eq => ({
            category_id: roomCategory._id,
            equipment_category_id: eq.equipment_category_id,
            quantity: eq.quantity
        }));

        if (items.length > 0) {
            await DefaultEquipment.insertMany(items);
        }

        return res.status(200).json({ success: true, message: "Thêm loại phòng thành công!", RoomCategory: roomCategory, DefaultEquipment: items });

    } catch (err) {
        console.error(err);
        return res.status(500).json({ success: false, message: "SERVER ERROR", err: err.message });
    }
};

export const updateRoomCategory = async (req, res) => {
    try {
        const { id } = req.params;
        const { category_name, description, max_adults, max_children, default_equipments, price } = req.body;

        const category = await RoomCategory.findById(id);
        if (!category) 
            return res.status(404).json({ message: "Không tìm thấy loại phòng" });

        const existing = await RoomCategory.findOne({ category_name: category_name, _id: { $ne: id } });
        if (existing)
            return res.status(400).json({ success: false, message: "Tên loại phòng đã tồn tại!" });

        // update các thông tin cơ bản
        category.category_name = category_name ?? category.category_name;
        category.description = description ?? category.description;
        category.max_adults = max_adults ?? category.max_adults;
        category.max_children = max_children ?? category.max_children;
        category.price = price ?? category.price;

        await category.save();

        let equipmentList = [];
        if (typeof default_equipments === "string") {
            try {
                equipmentList = JSON.parse(default_equipments);
            } catch (e) {
                return res.status(400).json({ message: "Dữ liệu thiết bị mặc định (default_equipments) không phải là chuỗi JSON hợp lệ." });
            }
        }
        else if (Array.isArray(default_equipments)) {
            equipmentList = default_equipments;
        }
        else {
            return res.status(400).json({ message: "Danh sách thiết bị mặc định không hợp lệ" });
        }

        // update thiết bị mặc định
        await DefaultEquipment.deleteMany({ category_id: id });
        const items = equipmentList.map(eq => ({
            category_id: id,
            equipment_category_id: eq.equipment_category_id,
            quantity: eq.quantity
        }));
        await DefaultEquipment.insertMany(items);

        // update ảnh
        let images = [];
        if (req.files && req.files.length > 0) {
            images = req.files.map((file) => file.path); 
        }
        category.images = images.length > 0 ? images : category.images;

        res.json({ message: "Cập nhật thành công", category });

    } catch (error) {
        res.status(500).json({ message: error.message });
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
            return res.status(409).json({ 
                success: false, 
                code: "CATEGORY_HAS_ROOMS",
                roomCount: relatedRoomCount,
                message: `Loại phòng này có ${relatedRoomCount} phòng. Bạn có muốn xóa tất cả các phòng thuộc loại phòng này không?` });
        }
        if (force) {
            await Room.deleteMany({ category_id: id });
        }

        await RoomCategory.findByIdAndDelete(id);
        await DefaultEquipment.deleteMany({ category_id: id });

        return res.status(200).json({ success: true, message: "Xóa loại phòng thành công!" });

    } catch (err) {
        console.error(err);
        return res.status(500).json({ success: false, message: "SERVER ERROR", err: err.message });
    }
};

export const getAllRoomCategories = async (req, res) => {
    try {
        const categories = await RoomCategory.find();

        const result = await Promise.all(
            categories.map(async cat => {
                const equipments = await DefaultEquipment.find({
                    category_id: cat._id
                })
                    .select("-_id")
                    .populate("equipment_category_id", "name");

                return {
                    ...cat.toObject(),
                    default_equipments: equipments
                };
            })
        );

        res.json(result);

    } catch (error) {
        res.status(500).json({ message: error.message });
    }
};

export const getRoomCategoryById = async (req, res) => {
    try {
        const { id } = req.params;

        const category = await RoomCategory.findById(id);
        if (!category) return res.status(404).json({ message: "Không tìm thấy loại phòng" });

        const defaultEquipments = await DefaultEquipment.find({
            category_id: id
        }).populate("equipment_category_id", "name unit price");

        res.json({
            ...category.toObject(),
            default_equipments: defaultEquipments
        });

    } catch (error) {
        res.status(500).json({ message: error.message });
    }
};

// Lấy danh sách thiết bị mặc định theo room category_id
export const getDefaultEquipmentsByCategory = async (req, res) => {
    try {
        const { category_id } = req.params;

        if (!mongoose.Types.ObjectId.isValid(category_id)) {
            return res.status(400).json({ success: false, message: "ID loại phòng không hợp lệ!" });
        }

        const defaultEquipments = await DefaultEquipment.find({
            category_id: category_id
        }).populate("equipment_category_id", "name unit price");

        return res.status(200).json({
            success: true,
            count: defaultEquipments.length,
            default_equipments: defaultEquipments
        });

    } catch (error) {
        return res.status(500).json({ success: false, message: error.message });
    }
};

// trả về thông tin các loại phòng còn trống trong khoảng thời gian nhất định
export const getAvailableRoomCategories = async (req, res) => {
  try {
    const { checkin, checkout, adults, children, minPrice, maxPrice } = req.query;

    if (!checkin || !checkout) {
      return res.status(400).json({
        message: "Phải điền thời gian nhận và trả phòng.",
      });
    }

    const start = new Date(checkin);
    const end = new Date(checkout);

    if (start >= end) {
      return res.status(400).json({ message: "Ngày trả phòng phải sau ngày nhận phòng." });
    }

    // Validate số lượng người
    if (adults && (isNaN(Number(adults)) || Number(adults) < 1)) {
      return res.status(400).json({ message: "Số lượng người lớn không hợp lệ." });
    }
    if (children && (isNaN(Number(children)) || Number(children) < 0)) {
      return res.status(400).json({ message: "Số lượng trẻ em không hợp lệ." });
    }

    // Lấy tất cả booking có status active (pending, confirmed, in_progress)
    // pending: đã đặt nhưng chưa cọc (có thể đã giữ phòng)
    // confirmed: đã cọc, chắc chắn giữ phòng
    // in_progress: đang ở
    const activeBookings = await Booking.find({
      status: { $in: ["pending", "confirmed", "in_progress"] },
    }).select("_id");

    const activeBookingIds = activeBookings.map(b => b._id);

    // Query các phòng bị chiếm bởi booking active trong khoảng thời gian
    // Chỉ lấy các booking detail chưa bị hủy
    const busyBookingDetails = await BookingDetail.find({
      booking_id: { $in: activeBookingIds },
      status: { $ne: "cancelled" }, // Loại trừ các booking đã hủy
      expected_checkin: { $lt: end }, // Check-in trước thời điểm checkout yêu cầu
      expected_checkout: { $gt: start }, // Check-out sau thời điểm checkin yêu cầu
    }).select("room_id");

    const busyRoomIdsFromBookings = [...new Set(busyBookingDetails.map(b => b.room_id.toString()))];

    // Kiểm tra RoomLog để tìm các phòng bị chiếm trong khoảng thời gian
    // Phòng có log với status "booked", "occupied", "reserved" trong khoảng thời gian này
    const busyRoomLogs = await RoomLog.find({
      status: { $in: ["booked", "occupied", "reserved"] },
      start_time: { $lt: end },
      $or: [
        { end_time: { $gt: start } },
        { end_time: null } // Log chưa kết thúc
      ]
    }).select("room_id");

    const busyRoomIdsFromLogs = [...new Set(busyRoomLogs.map(log => log.room_id.toString()))];

    // Hợp nhất danh sách phòng bận từ cả BookingDetail và RoomLog
    const allBusyRoomIds = [...new Set([...busyRoomIdsFromBookings, ...busyRoomIdsFromLogs])];

    // Tập hợp các điều kiện lọc loại phòng
    const categoryFilter = {};

    if (adults) {
      categoryFilter["category.max_adults"] = { $gte: Number(adults) };
    }
    if (children) {
        categoryFilter["category.max_children"] = { $gte: Number(children) };
    }

    if (minPrice || maxPrice) {
      categoryFilter["category.price"] = {};
      if (minPrice) categoryFilter["category.price"].$gte = Number(minPrice);
      if (maxPrice) categoryFilter["category.price"].$lte = Number(maxPrice);
    }

    // Lấy tất cả phòng và kiểm tra từng phòng xem có available trong khoảng thời gian không
    const allRooms = await Room.find({
      _id: { $nin: allBusyRoomIds },
    }).select("_id category_id room_number room_status");

    // Kiểm tra từng phòng xem có RoomLog conflict không
    const availableRooms = [];
    for (const room of allRooms) {
      // Kiểm tra xem phòng có log conflict trong khoảng thời gian không
      const conflictingLog = await RoomLog.findOne({
        room_id: room._id,
        status: { $in: ["booked", "occupied", "reserved", "maintenance"] }, // maintenance cũng không thể sử dụng
        start_time: { $lt: end },
        $or: [
          { end_time: { $gt: start } },
          { end_time: null }
        ]
      });

      // Nếu không có conflict và phòng không ở trạng thái không thể sử dụng
      if (!conflictingLog && !["maintenance", "new"].includes(room.room_status)) {
        // Kiểm tra xem phòng có đang cleaning nhưng sẽ sẵn sàng trước check-in không
        if (room.room_status === "cleaning") {
          const cleaningLog = await RoomLog.findOne({
            room_id: room._id,
            status: "cleaning",
            start_time: { $lte: start },
            $or: [
              { end_time: { $lte: start } }, // Cleaning sẽ kết thúc trước check-in
              { end_time: null }
            ]
          }).sort({ start_time: -1 });

          // Nếu có log cleaning và sẽ kết thúc trước check-in, phòng có thể sử dụng
          if (cleaningLog && cleaningLog.end_time && cleaningLog.end_time <= start) {
            availableRooms.push(room);
          } else if (!cleaningLog || (cleaningLog.end_time && cleaningLog.end_time <= start)) {
            availableRooms.push(room);
          }
        } else {
          // Phòng available hoặc các trạng thái khác có thể sử dụng
          availableRooms.push(room);
        }
      }
    }

    // Group theo category
    const roomsByCategory = {};
    for (const room of availableRooms) {
      const categoryId = room.category_id.toString();
      if (!roomsByCategory[categoryId]) {
        roomsByCategory[categoryId] = [];
      }
      roomsByCategory[categoryId].push({
        room_id: room._id,
        room_number: room.room_number,
      });
    }

    // Lấy thông tin category và filter
    const categoryIds = Object.keys(roomsByCategory);
    const categories = await RoomCategory.find({
      _id: { $in: categoryIds }
    });

    // Áp dụng filter và format kết quả
    let result = categories
      .filter(cat => {
        if (adults && cat.max_adults < Number(adults)) return false;
        if (children && cat.max_children < Number(children)) return false;
        if (minPrice && cat.price < Number(minPrice)) return false;
        if (maxPrice && cat.price > Number(maxPrice)) return false;
        return true;
      })
      .map(cat => ({
        category_id: cat._id,
        name: cat.category_name,
        price: cat.price,
        adults: cat.max_adults,
        children: cat.max_children,
        description: cat.description,
        availableRooms: roomsByCategory[cat._id.toString()]?.length || 0,
        rooms: roomsByCategory[cat._id.toString()] || [],
      }))
      .filter(item => item.availableRooms > 0) // Chỉ trả về category có phòng available
      .sort((a, b) => a.price - b.price);

    res.json(result);
  } catch (error) {
    console.error("Error in getAvailableRoomCategories:", error);
    res.status(500).json({
      message: error.message,
    });
  }
};
