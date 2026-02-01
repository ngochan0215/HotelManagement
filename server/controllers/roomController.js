import mongoose from "mongoose";
import { Room, RoomCategory, RoomLog, BookingDetail, Booking, 
  RoomStatusLog, Equipment, Employee 
} from "../models/index.js";

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
        const validStatuses = ["available", "maintenance", "new"];
        if (room_status && !validStatuses.includes(room_status))
            return res.status(400).json({ success: false, message: "Chỉ được chọn trạng thái trống hoặc bảo trì khi mới tạo phòng hoặc mới (mặc định)!" });

        const room = new Room({ category_id, room_number, room_status: room_status || "new" });

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
            const validStatuses = ["available", "booked", "occupied", "cleaning", "maintenance", "new", "reserved"];
            if (!validStatuses.includes(room_status))
              return res.status(400).json({ success: false, message: "Trạng thái phòng không hợp lệ!" });
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

        // Nếu roomStatusLog không có (không có log active), lấy log mới nhất từ RoomLog
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

// cập nhật phòng
// export const updateRoom = async (req, res) => {
//   try {
//     const { id } = req.params;
//     const { category_id, room_number, room_status, start_time, end_time, note } = req.body;

//     if (!mongoose.Types.ObjectId.isValid(id))
//       return res.status(400).json({ success: false, message: "ID không hợp lệ!" });

//     const room = await Room.findById(id);
//     if (!room)
//       return res.status(404).json({ success: false, message: "Không tìm thấy phòng!" });

//     if (category_id) {
//       if (!mongoose.Types.ObjectId.isValid(category_id))
//         return res.status(400).json({ success: false, message: "ID loại phòng không hợp lệ!" });

//       const category = await RoomCategory.findById(category_id);
//       if (!category)
//         return res.status(404).json({ success: false, message: "Không tìm thấy loại phòng!" });

//       room.category_id = category_id;
//     }

//       if (room_number !== undefined) {
//         const existing = await Room.findOne({ room_number, _id: { $ne: id } });
//         if (existing)
//           return res.status(400).json({ success: false, message: "Số phòng đã tồn tại!" });

//         room.room_number = room_number;
//       }

//       if (room_status) {
//         const validStatuses = ["available", "reserved", "booked", "occupied", "cleaning", "maintenance"];
//         if (!validStatuses.includes(room_status))
//           return res.status(400).json({ success: false, message: "Trạng thái phòng không hợp lệ!" });

//         if (room_status !== "available" && (!start_time || !end_time))
//           return res.status(400).json({
//             success: false,
//             message: "Cần cung cấp start_time và end_time! BE",
//           });

//         if (new Date(end_time) <= new Date(start_time))
//           return res.status(400).json({
//             success: false,
//             message: "end_time phải sau start_time!",
//           });

//         // cắt log cũ
//         await RoomStatusLog.updateMany(
//           {
//             room_id: id,
//             end_time: null,
//           },
//           { $set: { end_time: now } },
//           { session }
//         );

//         // ghi log trạng thái mới
//         await RoomStatusLog.create({
//             room_id: room._id,
//             status: room_status,
//             start_time: start_time || new Date(),
//             end_time: end_time || null,
//             note: note || "",
//             handled_by: req.user?.userId || null,
//         });

//         room.room_status = room_status;
//       }

//       await room.save();

//       const updatedRoom = await Room.findById(id)
//           .populate("category_id", "category_name description max_adults max_children price")
//           .select("-__v");

//       return res.status(200).json({
//           success: true,
//           message: "Cập nhật phòng thành công!",
//           room: updatedRoom,
//       });

//   } catch (err) {
//       console.error(err);
//       return res.status(500).json({
//           success: false,
//           message: "SERVER ERROR" + err.message,
//       });
//   }
// };

export const updateRoom = async (req, res) => {
  const session = await mongoose.startSession();
  session.startTransaction();

  try {
    console.log("IM CALLED");
    const { id } = req.params;
    const { category_id, room_number, room_status, start_time, end_time, note } = req.body;
    const now = new Date();
    const employee = await Employee.findOne({ user_id: req.user.userId });

    if (!mongoose.Types.ObjectId.isValid(id))
      return res.status(400).json({ success: false, message: "ID phòng không hợp lệ!" });

    const room = await Room.findById(id).session(session);
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

    // trạng thái phòng mới
    if (room_status) {
      // chỉ cho phép chỉnh một số trạng thái nhất định
      const ALLOWED_MANUAL_STATUS = ["maintenance", "cleaning", "available", "new"];

      if (!ALLOWED_MANUAL_STATUS.includes(room_status)) {
        return res.status(403).json({
          success: false,
          message: "Không được phép chỉnh trạng thái này thủ công!",
        });
      }

      // Lấy trạng thái hiện tại của phòng từ RoomLog (bảng chính)
      const activeLog = await RoomLog.findOne({
        room_id: id,
        start_time: { $lte: now },
        $or: [{ end_time: null }, { end_time: { $gte: now } }],
      }).sort({ start_time: -1 });

      const currentStatus = activeLog?.status || room.room_status || "new";
      console.log("CURRENT STATUS: ", currentStatus);
      // nếu trạng thái hiện tại là occupied thì không cho đổi
      if (["occupied"].includes(currentStatus)) {
        return res.status(400).json({
          success: false,
          message: "Phòng đang có khách, không thể đổi trạng thái!",
        });
      }

      // Nếu phòng đang ở trạng thái "new", cho phép chuyển sang available, maintenance, cleaning
      if (currentStatus === "new" && !["available", "maintenance", "cleaning"].includes(room_status)) {
        return res.status(400).json({
          success: false,
          message: "Phòng mới chỉ có thể chuyển sang trạng thái: Trống, Bảo trì hoặc Dọn dẹp!",
        });
      }

      // nếu đổi về available thì không cần start_time, end_time
      if (room_status === "available") {
        const bookingExists = await Booking.exists({
          room_id: id,
          status: { $in: ["confirmed", "in_progress"] },
          check_in: { $lte: now },
          check_out: { $gte: now },
        });

        if (bookingExists) {
          return res.status(400).json({
            success: false,
            message: "Phòng đang có booking hiệu lực, không thể chuyển sang available!",
          });
        }
      } else {
        if (!start_time)
          return res.status(400).json({
            success: false,
            message: "start_time là bắt buộc khi cập nhật trạng thái phòng!",
          });

        if (end_time && new Date(end_time) <= new Date(start_time))
          return res.status(400).json({
            success: false,
            message: "end_time phải sau start_time!",
          });
      }

      // Đóng log cũ - RoomLog (bảng chính)
      await RoomLog.updateMany(
        { room_id: id, end_time: null },
        { $set: { end_time: now } },
        { session }
      );

      // Đóng log cũ - RoomStatusLog (bảng dự phòng)
      await RoomStatusLog.updateMany(
        { room_id: id, end_time: null },
        { $set: { end_time: now } },
        { session }
      );

      // Tạo log mới - RoomLog (bảng chính)
      await RoomLog.create(
        [
          {
            room_id: id,
            status: room_status,
            start_time: new Date(start_time),
            end_time: end_time ? new Date(end_time) : null,
            expected_end_time: end_time ? new Date(end_time) : null,
            note: note || "",
            handled_by: employee._id || null,
          },
        ],
        { session }
      );

      // Tạo log mới - RoomStatusLog (bảng dự phòng)
      await RoomStatusLog.create(
        [
          {
            room_id: id,
            status: room_status,
            start_time: new Date(start_time),
            end_time: end_time ? new Date(end_time) : null,
            expected_end_time: end_time ? new Date(end_time) : null,
            note: note || "",
            handled_by: employee._id || null,
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
    const updatedRoom = await Room.findById(id)
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
      const latestLog = await RoomLog.findOne({ room_id: id })
        .sort({ start_time: -1 })
        .select("status start_time end_time note");
      if (latestLog) {
        updatedRoom.roomStatusLog = latestLog;
      }
    }

    return res.status(200).json({
      success: true,
      message: "Cập nhật phòng thành công!",
      room: updatedRoom,
    });
  } catch (err) {
    await session.abortTransaction();
    console.error(err);
    return res.status(500).json({
      success: false,
      message: "SERVER ERROR: " + err.message,
    });
  } finally {
    session.endSession();
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

// xác nhận hoàn thành dọn dẹp
export const completeCleaning = async (req, res) => {
  const { roomId } = req.params;
  const now = new Date();

  const session = await mongoose.startSession();
  session.startTransaction();

  try {
    const room = await Room.findById(roomId).session(session);
    if (!room) {
      throw new Error("Không tìm thấy phòng.");
    }

    if (room.room_status !== "cleaning") {
      throw new Error("Phòng không ở trạng thái đang dọn.");
    }

    // cắt log cleaning hiện tại - RoomLog (bảng chính)
    await RoomLog.updateMany(
      {
        room_id: roomId,
        status: "cleaning",
        end_time: null,
      },
      { $set: { end_time: now } },
      { session }
    );

    // cắt log cleaning hiện tại - RoomStatusLog (bảng dự phòng)
    await RoomStatusLog.updateMany(
      {
        room_id: roomId,
        status: "cleaning",
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
        note: "Housekeeping xác nhận dọn xong",
        handled_by: req.user?.userId || null,
      }],
      { session }
    );

    // tạo log available - RoomStatusLog (bảng dự phòng)
    await RoomStatusLog.create(
      [{
        room_id: roomId,
        status: "available",
        start_time: now,
        end_time: null,
        note: "Housekeeping xác nhận dọn xong",
        handled_by: req.user?.userId || null,
      }],
      { session }
    );

    // update Room
    room.room_status = "available";
    await room.save({ session });

    await session.commitTransaction();
    session.endSession();

    return res.json({
      message: "Phòng đã sẵn sàng để được thuê.",
    });

  } catch (error) {
    await session.abortTransaction();
    session.endSession();

    return res.status(400).json({
      message: error.message || "Không thể xác nhận dọn phòng.",
    });
  }
};

// xác nhận hoàn thành bảo trì
export const completeMaintenance = async (req, res) => {
  const { roomId } = req.params;
  const now = new Date();

  const session = await mongoose.startSession();
  session.startTransaction();

  try {
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

    // cắt log maintenance - RoomStatusLog (bảng dự phòng)
    await RoomStatusLog.updateMany(
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
        handled_by: req.user?._id || null,
      }],
      { session }
    );

    // tạo log available - RoomStatusLog (bảng dự phòng)
    await RoomStatusLog.create(
      [{
        room_id: roomId,
        status: "available",
        start_time: now,
        end_time: null,
        note: "Kỹ thuật xác nhận bảo trì xong",
        handled_by: req.user?._id || null,
      }],
      { session }
    );

    // update Room
    room.room_status = "available";
    await room.save({ session });

    await session.commitTransaction();
    session.endSession();

    return res.json({
      message: "Phòng đã hoàn tất bảo trì.",
    });

  } catch (error) {
    await session.abortTransaction();
    session.endSession();

    return res.status(400).json({
      message: error.message || "Không thể xác nhận bảo trì.",
    });
  }
};

// Group all rooms by category (including categories with zero rooms)
export const getRoomsByCategory = async (req, res) => {
    try {
        const { room_status } = req.query;

        const validStatuses = ["available", "booked", "occupied", "cleaning", "maintenance", "new"];
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
      new: 0,
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
export const getRoomEquipments = async (req, res) => {
  try {
    const { id } = req.params;

    const equipments = await Equipment.find({
      room_id: id,
      status: { $in: ["in-use", "maintenance"] }
    })
      .populate({
        path: "category_id",
        select: "name price"
      })
      .select("category_id condition status note");

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
};
