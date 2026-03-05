import mongoose from "mongoose";
import { Room, RoomCategory, RoomLog, BookingDetail, Booking, 
  RoomStatusLog, Equipment, Employee 
} from "../models/index.js";

// ROOM
export const createRoom = async (data) => {
    const { category_id, room_number, room_status } = data;

    if (!category_id || !room_number)
        throw new Error("Vui lòng nhập đầy đủ thông tin bắt buộc (loại phòng, số phòng)!");

    if (!mongoose.Types.ObjectId.isValid(category_id))
        throw new Error("ID loại phòng không hợp lệ!");

    const category = await RoomCategory.findById(category_id);
    if (!category)
        throw new Error("Không tìm thấy loại phòng!");

    const existing = await Room.findOne({ room_number });
    if (existing)
        throw new Error("Số phòng đã tồn tại!");

    const validStatuses = ["available", "maintenance", "new"];
    if (room_status && !validStatuses.includes(room_status))
        throw new Error("Chỉ được chọn trạng thái trống hoặc bảo trì khi mới tạo phòng hoặc mới (mặc định)!");

    const room = new Room({ category_id, room_number, room_status: room_status || "new" });

    await room.save();
    const populatedRoom = await Room.findById(room._id).populate("category_id", "category_name description max_adults max_children price").select("-__v");

    return populatedRoom;
};

export const getAllRooms = async (query = {}) => {
    const { category_id, room_status, room_number } = query;
    const filter = {};

    if (category_id) {
        if (!mongoose.Types.ObjectId.isValid(category_id))
            throw new Error("ID loại phòng không hợp lệ!");
        filter.category_id = category_id;
    }

    if (room_status) {
        const validStatuses = ["available", "booked", "occupied", "cleaning", "maintenance", "new", "reserved"];
        if (!validStatuses.includes(room_status))
            throw new Error("Trạng thái phòng không hợp lệ!");
        filter.room_status = room_status;
    }

    if (room_number) {
        filter.room_number = parseInt(room_number);
    }

    const now = new Date();

    const rooms = await Room.find(filter)
        .populate("category_id", "category_name description max_adults max_children price")
        .populate({
            path: "roomStatusLog",
            match: {
            start_time: { $lte: now },
            end_time: { $gte: now },
            },
            //options: { sort: { start_time: -1 }, limit: 1 },
            select: "status start_time end_time note",
        })
        .select("-__v")
        .sort({ room_number: 1 });

    for (const room of rooms) {
        if (!room.roomStatusLog) {
        const latestLog = await RoomLog.findOne({ room_id: room._id })
            .sort({ start_time: -1 })
            .select("status start_time end_time note");
        if (latestLog) {
            room.roomStatusLog = latestLog;
        }
        }
    }

    return { count: rooms.length, rooms };
};

export const getRoomById = async (id) => {
    if (!mongoose.Types.ObjectId.isValid(id))
        throw new Error("ID không hợp lệ!");

    const now = new Date();

    const room = await Room.findById(id)
        .populate("category_id", "category_name description max_adults max_children price")
        .populate({
            path: "roomStatusLog",
            match: {
                start_time: { $lte: now },
                $or: [
                    { end_time: { $gte: now } },
                    { end_time: null }
                ],
            },
            select: "status start_time end_time note",
        })
        .select("-__v")

    if (!room)
        throw new Error("Không tìm thấy phòng!")

    return room;
};

export const updateRoom = async (data, roomId, userId) => {
  const session = await mongoose.startSession();

  try {
    session.startTransaction();

    const { category_id, room_number, room_status, start_time, end_time, note } = data;
    const now = new Date();

    if (!mongoose.Types.ObjectId.isValid(roomId))
      throw new Error("ID phòng không hợp lệ!");

    const employee = await Employee.findOne({ user_id: userId });

    const room = await Room.findById(roomId).session(session);
    if (!room) throw new Error("Không tìm thấy phòng!");

    if (category_id) {
      if (!mongoose.Types.ObjectId.isValid(category_id))
        throw new Error("ID loại phòng không hợp lệ!");

      const category = await RoomCategory.findById(category_id);
      if (!category) throw new Error("Không tìm thấy loại phòng!");

      room.category_id = category_id;
    }

    if (room_number !== undefined) {
      const existing = await Room.findOne({
        room_number,
        _id: { $ne: roomId },
      });

      if (existing) throw new Error("Số phòng đã tồn tại!");

      room.room_number = room_number;
    }

    if (room_status) {
        const ALLOWED = ["maintenance", "cleaning", "available", "new"];

        if (!ALLOWED.includes(room_status)) {
            throw new Error(`Chỉ được chỉnh: ${ALLOWED.join(", ")}`);
        }

        const activeLog = await RoomLog.findOne({
            room_id: roomId,
            start_time: { $lte: now },
            $or: [{ end_time: null }, { end_time: { $gte: now } }],
        }).sort({ start_time: -1 });

        const currentStatus = activeLog?.status || room.room_status || "new";

        if (currentStatus === "occupied")
            throw new Error("Phòng đang có khách!");

        // Nếu phòng đang ở trạng thái "new", cho phép chuyển sang available, maintenance, cleaning
        if (currentStatus === "new" && !["available", "maintenance", "cleaning"].includes(room_status)) {
            throw new Error("Phòng mới chỉ có thể chuyển sang trạng thái: Trống, Bảo trì hoặc Dọn dẹp!");
        }

        if (room_status !== "available") {
            if (!start_time)
                throw new Error("Bắt buộc có thời gian bắt đầu!");

            if (end_time && new Date(end_time) <= new Date(start_time))
                throw new Error("Thời gian kết thúc phải sau thời gian bắt đầu!");
        } else {
            const bookingExists = await Booking.exists({
                room_id: roomId,
                status: { $in: ["confirmed", "in_progress"] },
                check_in: { $lte: now },
                check_out: { $gte: now },
            });

            if (bookingExists) {
                throw new Error("Phòng đang có booking hiệu lực, không thể chuyển sang available!");
            }
        }

      // Close old logs
      await RoomLog.updateMany(
        { room_id: roomId, end_time: null },
        { $set: { end_time: now } },
        { session }
      );

      // Create new log
      await RoomLog.create(
        [
          {
            room_id: roomId,
            status: room_status,
            start_time: start_time ? new Date(start_time) : now,
            end_time: end_time ? new Date(end_time) : null,
            note: note || "",
            handled_by: employee?._id || null,
          },
        ],
        { session }
      );

      room.room_status = room_status;
    }

    await room.save({ session });

    await session.commitTransaction();

    // Populate roomStatusLog (virtual field tham chiếu RoomLog) để frontend có thể hiển thị
    const nowForPopulate = new Date();
    const updatedRoom = await Room.findById(roomId)
        .populate("category_id", "category_name description max_adults max_children price")
        .populate({
            path: "roomStatusLog",
            match: {
                start_time: { $lte: nowForPopulate },
                $or: [
                { end_time: { $gte: nowForPopulate } },
                { end_time: null }
                ],
            },
            select: "status start_time end_time note",
        })
        .select("-__v");
    
    // Nếu roomStatusLog không có (không có log active), lấy log mới nhất từ RoomLog
    if (!updatedRoom.roomStatusLog) {
        const latestLog = await RoomLog.findOne({ room_id: roomId })
        .sort({ start_time: -1 })
        .select("status start_time end_time note");
        if (latestLog) {
        updatedRoom.roomStatusLog = latestLog;
        }
    }

    return updatedRoom;
  } catch (error) {
    await session.abortTransaction();
    session.endSession();
    throw error;
  }
};

export const deleteRoom = async (roomId) => {
  try {
    if (!mongoose.Types.ObjectId.isValid(roomId))
      throw new Error("ID không hợp lệ!");

    const room = await Room.findById(roomId);
    if (!room)
      throw new Error("Không tìm thấy phòng!");

    // Check if room is currently booked or occupied
    if (room.room_status === "booked" || room.room_status === "occupied" || room.room_status === "reserved") {
      throw new Error("Không thể xóa phòng đang ở trạng thái booked hoặc occupied hoặc reserved!");
    }

    await Room.findByIdAndDelete(roomId);

    return { success: true };
  } catch (err) {
    console.error(err);
    throw err;
  }
};

// xác nhận hoàn thành dọn dẹp
export const completeCleaning = async (roomId, userId) => {
  const now = new Date();
  const session = await mongoose.startSession();

  try {
    session.startTransaction();
    const room = await Room.findById(roomId).session(session);
    if (!room) {
      throw new Error("Không tìm thấy phòng.");
    }

    if (room.room_status !== "cleaning") {
      throw new Error("Phòng không ở trạng thái đang dọn.");
    }

    // cắt log cleaning hiện tại
    await RoomLog.updateMany(
      {
        room_id: roomId,
        status: "cleaning",
        end_time: null,
      },
      { $set: { end_time: now } },
      { session }
    );

    // tạo log available
    await RoomLog.create(
      [{
        room_id: roomId,
        status: "available",
        start_time: now,
        end_time: null,
        note: "Housekeeper xác nhận dọn xong",
        handled_by: userId || null,
      }],
      { session }
    );

    // update Room
    room.room_status = "available";
    await room.save({ session });

    await session.commitTransaction();
    
    return { success: true };

  } catch (error) {
    await session.abortTransaction();
    session.endSession();
    throw error;
  }
};

// xác nhận hoàn thành bảo trì
export const completeMaintenance = async (roomId, userId) => {
  const now = new Date();
  const session = await mongoose.startSession();

  try {
    session.startTransaction();

    const room = await Room.findById(roomId).session(session);
    if (!room) {
      throw new Error("Không tìm thấy phòng.");
    }

    if (room.room_status !== "maintenance") {
      throw new Error("Phòng không ở trạng thái bảo trì.");
    }

    // cắt log maintenance - RoomLog (bảng chính)
    await RoomLog.updateMany(
      {
        room_id: roomId,
        status: "maintenance",
        end_time: null,
      },
      { $set: { end_time: now } },
      { session }
    );

    // tạo log available - RoomLog (bảng chính)
    await RoomLog.create(
      [{
        room_id: roomId,
        status: "available",
        start_time: now,
        end_time: null,
        note: "Kỹ thuật xác nhận bảo trì xong",
        handled_by: userId || null,
      }],
      { session }
    );

    // update Room
    room.room_status = "available";
    await room.save({ session });

    await session.commitTransaction();

    return { success: true };

  } catch (error) {
    await session.abortTransaction();
    session.endSession();
    throw error;
  }
};

// Group all rooms by category (including categories with zero rooms)
export const getRoomsByCategory = async (query = {}) => {
    try {
        const { room_status } = query;

        const validStatuses = ["available", "booked", "occupied", "cleaning", "maintenance", "new"];
        if (room_status && !validStatuses.includes(room_status)) {
            throw new Error("Trạng thái phòng không hợp lệ!");
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

        return categoriesWithRooms;

    } catch (err) {
        console.error(err);
        throw err;
    }
};

// trả về số lượng phòng group by tình trạng
export const getRoomStatusSummary = async () => {
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
      new: 0,
      available: 0,
      booked: 0,
      occupied: 0,
      cleaning: 0,
      maintenance: 0,
      reserved: 0,
      total: 0,
    };

    result.forEach(item => {
      summary[item._id] = item.count;
      summary.total += item.count;
    });

    return { summary };

  } catch (error) {
    return res.status(500).json({
      message: "Không thống kê được tình trạng các phòng ở hiện tại.",
      error: error.message,
    });
  }
};

// trả về những phòng được đặt nhiều nhất
export const getTopBookedRoomCategories = async (query = {}) => {
  try {
    const limit = parseInt(query.limit, 10) || 5;

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

    return { result };

  } catch (error) {
    console.log(error);
    throw error;
  }
};

// trả về các log trạng thái mới nhất của các phòng
export const getLatestStatusOfAllRooms = async () => {
  return await RoomLog.aggregate([
    {
      $sort: {
        room_id: 1,
        start_time: -1,
      },
    },

    // gom theo phòng, lấy bản ghi đầu tiên
    {
      $group: {
        _id: "$room_id",
        latestStatus: { $first: "$$ROOT" },
      },
    },

    // trả về document gốc
    {
      $replaceRoot: { newRoot: "$latestStatus" },
    },

    // populate phòng
    {
      $lookup: {
        from: "rooms",
        localField: "room_id",
        foreignField: "_id",
        as: "room",
      },
    },
    {
      $unwind: {
        path: "$room",
        preserveNullAndEmptyArrays: true,
      },
    },
  ]);
};

// trả về danh sách thiết bị trong phòng
export const getRoomEquipments = async (roomId) => {
  try {
    const equipments = await Equipment.find({
      room_id: roomId,
      status: { $in: ["in-use", "maintenance"] }
    })
      .populate({
        path: "category_id",
        select: "name price"
      })
      .select("category_id condition status note");

    return { equipments };

  } catch (err) {
    console.error(err);
    throw err;
  }
};

// update tình trạng phòng dựa trên status+condition của thiết bị
export const reevaluateRoomStatus = async (room_id) => {
  if (!room_id) return;

  // Lấy tất cả thiết bị critical của phòng
  const equipments = await Equipment.find({ room_id })
    .populate("category_id", "is_critical");

  const hasCriticalProblem = equipments.some((eq) => {
    if (!eq.category_id?.is_critical) return false;

    return (
      ["maintenance", "broken"].includes(eq.condition) ||
      ["maintenance", "disposed", "lost"].includes(eq.status)
    );
  });

  const status = hasCriticalProblem ? "maintenance" : "available";
  await Room.findByIdAndUpdate(room_id, { status });

  // Ghi log trạng thái phòng - RoomLog (bảng chính)
  await RoomLog.create({
    room_id: room_id,
    status,
    start_time: new Date(),
    end_time: null,
    note: "Update status phòng theo sự cố + phiếu đền bù",
    handled_by: null,
  });

  // Ghi log trạng thái phòng - RoomStatusLog (bảng dự phòng)
  await RoomStatusLog.create({
    room_id: room_id,
    status,
    start_time: new Date(),
    end_time: null,
    note: "Update status phòng theo sự cố + phiếu đền bù",
    handled_by: null,
  });

  return { success: true };
};
