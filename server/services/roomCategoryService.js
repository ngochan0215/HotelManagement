import mongoose from "mongoose";
import {
  Room,
  RoomCategory,
  DefaultEquipment,
  Booking,
  BookingDetail,
  RoomLog
} from "../models/index.js";


const parseEquipmentList = (default_equipments) => {
  let equipmentList = [];

  if (typeof default_equipments === "string") {
    equipmentList = JSON.parse(default_equipments);
  } else if (Array.isArray(default_equipments)) {
    equipmentList = default_equipments;
  } else {
    throw new Error("Danh sách thiết bị mặc định không hợp lệ");
  }

  if (!equipmentList || equipmentList.length === 0) {
    throw new Error("Vui lòng chọn ít nhất một thiết bị mặc định");
  }

  return equipmentList;
};


export const createRoomCategoryService = async (data, files) => {
  const { category_name, description, max_adults, max_children, default_equipments, price } = data;

  if (!category_name || !description || !max_adults || !price) {
    throw new Error("Vui lòng nhập đầy đủ thông tin bắt buộc!");
  }

  const existing = await RoomCategory.findOne({ category_name });
  if (existing) throw new Error("Tên loại phòng đã tồn tại!");

  const equipmentList = parseEquipmentList(default_equipments);

  let images = [];
  if (files?.length > 0) {
    images = files.map((f) => f.path);
  }

  const roomCategory = await RoomCategory.create({
    category_name,
    description,
    max_adults,
    max_children,
    price,
    images
  });

  const items = equipmentList.map(eq => ({
    category_id: roomCategory._id,
    equipment_category_id: eq.equipment_category_id,
    quantity: eq.quantity
  }));

  if (items.length) {
    await DefaultEquipment.insertMany(items);
  }

  return { roomCategory, items };
};


export const updateRoomCategoryService = async (id, data, files) => {
  const category = await RoomCategory.findById(id);
  if (!category) 
    throw new Error("Không tìm thấy loại phòng");

  const { category_name, description, max_adults, max_children, default_equipments, price } = data;

  const existing = await RoomCategory.findOne({
    category_name,
    _id: { $ne: id }
  });

  if (existing) 
    throw new Error("Tên loại phòng đã tồn tại!");

  Object.assign(category, {
    category_name: category_name ?? category.category_name,
    description: description ?? category.description,
    max_adults: max_adults ?? category.max_adults,
    max_children: max_children ?? category.max_children,
    price: price ?? category.price
  });

  await category.save();

  if (default_equipments) {
    const equipmentList = parseEquipmentList(default_equipments);

    await DefaultEquipment.deleteMany({ category_id: id });

    const items = equipmentList.map(eq => ({
      category_id: id,
      equipment_category_id: eq.equipment_category_id,
      quantity: eq.quantity
    }));

    await DefaultEquipment.insertMany(items);
  }

  if (files?.length > 0) {
    category.images = files.map(f => f.path);
    await category.save();
  }

  return category;
};


export const deleteRoomCategoryService = async (id, force) => {
  const category = await RoomCategory.findById(id);
  if (!category) 
    throw new Error("Không tìm thấy loại phòng!");

  const relatedRoomCount = await Room.countDocuments({ category_id: id });

  if (relatedRoomCount > 0 && !force) {
    return {
        needConfirm: true,
        roomCount: relatedRoomCount
    };
  }

  if (force) {
    await Room.deleteMany({ category_id: id });
  }

  await RoomCategory.findByIdAndDelete(id);
  await DefaultEquipment.deleteMany({ category_id: id });

  return { deleted: true };
};


export const getAllRoomCategoriesService = async () => {
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

  return result;
};


export const getRoomCategoryByIdService = async (id) => {
  const category = await RoomCategory.findById(id);
  if (!category) 
    throw new Error("Không tìm thấy loại phòng");

  const defaultEquipments = await DefaultEquipment.find({
    category_id: id
  }).populate("equipment_category_id", "name unit price");

  return {
    ...category.toObject(),
    default_equipments: defaultEquipments
  };
};

// get default equipment list according to categories
export const getDefaultEquipmentsService = async (category_id) => {
  if (!mongoose.Types.ObjectId.isValid(category_id)) {
    throw new Error("ID loại phòng không hợp lệ!");
  }

  const defaultEquipments = await DefaultEquipment.find({
    category_id
  }).populate("equipment_category_id", "name unit price");

  return defaultEquipments;
};

// return list of available room categories with available rooms based on search criteria
export const getAvailableRoomCategoriesService = async (query) => {
    const { checkin, checkout, adults, children, minPrice, maxPrice } = query;

    if (!checkin || !checkout) {
        throw new Error("Phải điền thời gian nhận và trả phòng.");
    }

    const start = new Date(checkin);
    const end = new Date(checkout);

    if (start >= end) {
        throw new Error("Ngày trả phòng phải sau ngày nhận phòng.");
    }

    if (adults && (isNaN(Number(adults)) || Number(adults) < 1)) {
        throw new Error("Số lượng người lớn không hợp lệ.");
    }

    if (children && (isNaN(Number(children)) || Number(children) < 0)) {
        throw new Error("Số lượng trẻ em không hợp lệ.");
    }

    // get active bookings 
    const activeBookings = await Booking.find({
        status: { $in: ["pending", "confirmed", "in_progress"] },
    }).select("_id");

    const activeBookingIds = activeBookings.map((b) => b._id);

    // get busy rooms from both bookings and room logs
    const busyBookingDetails = await BookingDetail.find({
        booking_id: { $in: activeBookingIds },
        status: { $ne: "cancelled" },
        expected_checkin: { $lt: end },
        expected_checkout: { $gt: start },
    }).select("room_id");

    const busyRoomIdsFromBookings = [
        ...new Set(busyBookingDetails.map((b) => b.room_id.toString())),
    ];

    const busyRoomLogs = await RoomLog.find({
        status: { $in: ["booked", "occupied", "reserved"] },
        start_time: { $lt: end },
        $or: [{ end_time: { $gt: start } }, { end_time: null }],
    }).select("room_id");

    const busyRoomIdsFromLogs = [
        ...new Set(busyRoomLogs.map((log) => log.room_id.toString())),
    ];

    const allBusyRoomIds = [
        ...new Set([...busyRoomIdsFromBookings, ...busyRoomIdsFromLogs]),
    ];

    // get all rooms that are not in busyRoomIds and not in maintenance/new status
    const allRooms = await Room.find({
        _id: { $nin: allBusyRoomIds },
    }).select("_id category_id room_number room_status");

    const availableRooms = [];

    for (const room of allRooms) {
        const conflictingLog = await RoomLog.findOne({
        room_id: room._id,
        status: { $in: ["booked", "occupied", "reserved", "maintenance"] },
        start_time: { $lt: end },
        $or: [{ end_time: { $gt: start } }, { end_time: null }],
        });

        if (!conflictingLog && !["maintenance", "new"].includes(room.room_status)) {
        if (room.room_status === "cleaning") {
            const cleaningLog = await RoomLog.findOne({
            room_id: room._id,
            status: "cleaning",
            start_time: { $lte: start },
            $or: [
                { end_time: { $lte: start } }, 
                { end_time: null }
            ],
            }).sort({ start_time: -1 });

            // Nếu có log cleaning và sẽ kết thúc trước check-in, phòng có thể sử dụng
            if (
            !cleaningLog ||
            (cleaningLog.end_time && cleaningLog.end_time <= start)
            ) {
            availableRooms.push(room);
            }
        } else {
            availableRooms.push(room);
        }
        }
    }

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

    const categoryIds = Object.keys(roomsByCategory);
    const categories = await RoomCategory.find({
        _id: { $in: categoryIds },
    });

    let result = categories
        .filter((cat) => {
            if (adults && cat.max_adults < Number(adults)) return false;
            if (children && cat.max_children < Number(children)) return false;
            if (minPrice && cat.price < Number(minPrice)) return false;
            if (maxPrice && cat.price > Number(maxPrice)) return false;
            return true;
        })
        .map((cat) => ({
            category_id: cat._id,
            name: cat.category_name,
            price: cat.price,
            adults: cat.max_adults,
            children: cat.max_children,
            description: cat.description,
            availableRooms:
                roomsByCategory[cat._id.toString()]?.length || 0,
            rooms: roomsByCategory[cat._id.toString()] || [],
        }))
        .filter((item) => item.availableRooms > 0)
        .sort((a, b) => a.price - b.price);

    return result;
};