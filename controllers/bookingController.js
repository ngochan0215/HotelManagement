import mongoose from "mongoose";
import { Booking, BookingDetail, Customer, Room, RoomCancellation, Employee, RoomStatusLog } from "../models/index.js";
import { CANCELLATION_REASON_LABELS } from "../constants/cancellationReason.js";

// BOOKING //
// thêm bản ghi đặt phòng
export const createBooking = async (req, res) => {
  const session = await mongoose.startSession();
  session.startTransaction();

  try {
    const { customer_id, handled_by, adults, children, deposit, rooms } = req.body;

    if (!customer_id || !handled_by || !adults ) {
      return res.status(400).json({ message: "Phải điền đầy đủ các thông tin bắt buộc!"});
    }

    if (!mongoose.Types.ObjectId.isValid(customer_id) || !mongoose.Types.ObjectId.isValid(handled_by)){
      return res.status(400).json({ message: "customer_id hoặc employee_id (handled_by) không hợp lệ!"});
    }

    const customer = await Customer.findById(customer_id);
    if (!customer)
    return res.status(404).json({ message: "Không tìm thấy khách hàng." });
    let employee = await Employee.findOne({ user_id: handled_by });
    if (!employee) {
        employee = await Employee.findById(handled_by);
    }

    if (!employee) {
      return res.status(404).json({ message: `Không tìm thấy hồ sơ Nhân viên (User/Emp ID: ${handled_by}).` });
    }

    if (!Array.isArray(rooms) || rooms.length === 0) {
      return res.status(400).json({ message: "Phải đặt ít nhất một phòng!" });
    }

    for (const room of rooms) {
      if ( !room.room_id || !room.expected_checkin || !room.expected_checkout) {
        return res.status(400).json({ message: "Phải điền đầy đủ thông tin check-in, check-out dự kiến của mỗi phòng đặt." });
      }
      if ( new Date(room.expected_checkout) <= new Date(room.expected_checkin) ) {
        return res.status(400).json({ message: "Ngày check-out dự kiến phải sau ngày check-in dự kiến." });
      }
      if ( new Date(room.expected_checkout) <= new Date() ) {
        return res.status(400).json({ message: "Ngày check-out dự kiến không được trong quá khứ." });
      }
      if ( new Date(room.expected_checkin) <= new Date() ) {
        return res.status(400).json({ message: "Ngày check-in dự kiến không được trong quá khứ." });
      }
      const roomExists = await Room.exists({ _id: room.room_id });
      if (!roomExists) {
        return res.status(404).json({ message: `Không tìm thấy phòng với ID: ${room.room_id}.`});
      }
    }

    const expected_checkin = new Date(Math.min(...rooms.map(r => new Date(r.expected_checkin))));
    const expected_checkout = new Date(Math.max(...rooms.map(r => new Date(r.expected_checkout))));

    // tạo booking
    const booking = await Booking.create(
      [
        {
          customer_id,
          handled_by: employee._id,
          adults,
          children,
          deposit,
          expected_checkin,
          expected_checkout,
          status: "pending",
        },
      ],
      { session }
    );

    // tạo bookingDetail
    const bookingDetails = rooms.map(room => ({
      booking_id: booking[0]._id,
      room_id: room.room_id,
      expected_checkin: room.expected_checkin,
      expected_checkout: room.expected_checkout,
      base_fee: room.base_fee,
      status: "reserved",
    }));

    await BookingDetail.insertMany(bookingDetails, { session });

    await session.commitTransaction();
    session.endSession();

    return res.status(201).json({
      message: "Đặt phòng thành công.",
      booking_id: booking[0]._id,
    });

  } catch (error) {
    await session.abortTransaction();
    session.endSession();
    return res.status(500).json({
      message: error.message || "Không thể đặt phòng.",
    });
  }
};

// xác nhận thanh toán tiền cọc thành công
export const confirmBooking = async (req, res) => {
  const { booking_id } = req.params;
  const session = await mongoose.startSession();
  session.startTransaction();

  try {
    const booking = await Booking.findById(booking_id).session(session);
    if (!booking) {
      return res.status(404).json({ message: "Không tìm thấy dữ liệu đặt phòng." });
    }

    if (booking.status !== "pending") {
      return res.status(400).json({ message: "Trạng thái đặt phòng không hợp lệ." });
    }

    const bookingDetails = await BookingDetail.find({ booking_id })
      .session(session);

    if (bookingDetails.length === 0) {
      return res.status(400).json({ message: "Booking không có phòng nào." });
    }

    const roomIds = bookingDetails.map(bd => bd.room_id);

    // update trạng thái phòng thành booked
    await Room.updateMany(
      { _id: { $in: roomIds } },
      { $set: { room_status: "booked" } },
      { session }
    );

    for (const bd of bookingDetails) {
      const conflict = await RoomStatusLog.findOne({
        room_id: bd.room_id,
        status: { $in: ["booked", "occupied"] },
        start_time: { $lt: bd.expected_checkout },
        end_time: { $gt: bd.expected_checkin },
      }).session(session);

      if (conflict) {
        throw new Error(`Phòng ${bd.room_id} đã được giữ trong khoảng thời gian này`);
      }
    }

    // tạo log booked
    const roomStatusLogs = bookingDetails.map(bd => ({
      room_id: bd.room_id,
      status: "booked",
      start_time: bd.expected_checkin,
      end_time: bd.expected_checkout,
      note: `Booking confirmed: ${booking._id}`,
      handled_by: booking.handled_by,
    }));

    await RoomStatusLog.insertMany(roomStatusLogs, { session });

    // update trạng thái booking
    booking.status = "confirmed";
    await booking.save({ session });

    await session.commitTransaction();
    session.endSession();

    return res.json({
      message: "Xác nhận booking thành công, phòng đã được giữ chỗ.",
    });

  } catch (error) {
    await session.abortTransaction();
    session.endSession();

    return res.status(500).json({
      message: error.message || "Không thể xác nhận booking.",
    });
  }
};

// lấy thông tin của một phiếu đặt phòng
export const getBookingDetail = async (req, res) => {
  try {
    const { id } = req.params;
    if (!mongoose.Types.ObjectId.isValid(id)) {
      return res.status(400).json({
        message: "Booking ID không hợp lệ.",
      });
    }
    const booking = await Booking.findById(id)
      .populate("customer_id", "full_name CCCD avatar")
      .populate("handled_by", "full_name position")
      .lean();

    if (!booking) {
      return res.status(404).json({
        message: "Không tìm thấy booking.",
      });
    }

    const bookingDetails = await BookingDetail.find({
      booking_id: booking._id,
    })
      .populate({
        path: "room_id",
        populate: {
          path: "category_id",
          select: "name price description",
        },
      })
      .lean();

    // format data cho frontend
    const rooms = bookingDetails.map((item) => ({
      room_id: item.room_id._id,
      room_number: item.room_id.room_number,
      category: item.room_id.category_id
        ? {
            id: item.room_id.category_id._id,
            name: item.room_id.category_id.name,
            price: item.room_id.category_id.price,
            capacity: item.room_id.category_id.capacity,
            description: item.room_id.category_id.description,
          }
        : null,
      expected_checkin: item.expected_checkin,
      expected_checkout: item.expected_checkout,
      base_fee: item.base_fee,
      status: item.status,
    }));

    return res.status(200).json({
      booking: {
        id: booking._id,
        status: booking.status,
        adults: booking.adults,
        children: booking.children,
        deposit: booking.deposit,
        expected_checkin: booking.expected_checkin,
        expected_checkout: booking.expected_checkout,
        created_at: booking.created_at,
      },
      customer: booking.customer_id,
      handled_by: booking.handled_by,
      rooms,
    });
  } catch (error) {
    return res.status(500).json({
      message: error.message || "Không thể lấy thông tin booking.",
    });
  }
};

// cập nhật trạng thái phiếu đặt phòng
export const updateBookingStatus = async (req, res) => {
  const { booking_id } = req.params;
  const { status } = req.query;

  const session = await mongoose.startSession();
  session.startTransaction();

  try {
    const allowedStatuses = [
      "pending",
      "confirmed",
      "checked_in",
      "checked_out",
      "cancelled",
      "expired",
    ];

    if (!allowedStatuses.includes(status)) {
      return res.status(400).json({ message: "Trạng thái đặt phòng không hợp lệ." });
    }

    console.log(booking_id);
    const booking = await Booking.findById(booking_id).session(session);
    if (!booking) {
      return res.status(404).json({ message: "Không tìm thấy dữ liệu đặt phòng." });
    }

    const currentStatus = booking.status;

    // rule chuyển trạng thái
    const transitionRules = {
      pending: ["confirmed", "cancelled", "expired"],
      confirmed: ["checked_in", "cancelled"],
      checked_in: ["checked_out"],
      checked_out: [],
      cancelled: [],
      expired: [],
    };

    if (!transitionRules[currentStatus].includes(status)) {
      return res.status(400).json({
        message: `Không thể chuyển từ '${currentStatus}' sang '${status}'.`,
      });
    }

    const bookingDetails = await BookingDetail.find({ booking_id })
      .populate("room_id")
      .session(session);

    const now = new Date();

    const roomIds = bookingDetails.map(bd => bd.room_id);

    // hàm kiểm tra nếu như 
    const hasConflict = async (roomId, start, end, statuses) => {
      return RoomStatusLog.findOne({
        room_id: roomId,
        status: { $in: statuses },
        start_time: { $lt: end },
        end_time: { $gt: start },
      }).session(session);
    };

    switch (status) {
      case "cancelled":
      case "expired":
        for (const bd of bookingDetails) {
          await RoomStatusLog.updateMany(
            {
              room_id: bd.room_id._id,
              status: "booked",
              end_time: { $gt: now },
            },
            { $set: { end_time: now } },
            { session }
          );
        }
        
        await Room.updateMany(
          { _id: { $in: roomIds } },
          { $set: { room_status: "available" } },
          { session }
        );
        break;

      case "confirmed": {
        for (const bd of bookingDetails) {
          const conflict = await hasConflict(
            bd.room_id._id,
            bd.expected_checkin,
            bd.expected_checkout,
            ["booked", "occupied", "maintenance"]
          );

          if (conflict) {
            throw new Error(`Phòng ${bd.room_id.room_number} đã có lịch`);
          }

          await RoomStatusLog.create(
            [{
              room_id: bd.room_id._id,
              status: "booked",
              start_time: bd.expected_checkin,
              end_time: bd.expected_checkout,
              note: `Booking ${booking._id} confirmed`,
            }],
            { session }
          );
        }

        await Room.updateMany(
          { _id: { $in: bookingDetails.map(b => b.room_id._id) } },
          { $set: { room_status: "booked" } },
          { session }
        );
        break;
      }

      case "checked_in": {
        for (const bd of bookingDetails) {
          const conflict = await hasConflict(
            bd.room_id._id,
            now,
            bd.expected_checkout,
            ["occupied"]
          );

          if (conflict) {
            throw new Error(`Phòng ${bd.room_id.room_number} đang được sử dụng`);
          }

          await RoomStatusLog.create(
            [{
              room_id: bd.room_id._id,
              status: "occupied",
              start_time: now,
              end_time: bd.expected_checkout,
              note: `Booking ${booking._id} checked-in`,
            }],
            { session }
          );
        }

        await Room.updateMany(
          { _id: { $in: bookingDetails.map(b => b.room_id._id) } },
          { $set: { room_status: "occupied" } },
          { session }
        );
        break;
      }

      case "checked_out": {
        for (const bd of bookingDetails) {
          // đóng log mà ghi nhận phòng occupied
          await RoomStatusLog.findOneAndUpdate(
            {
              room_id: bd.room_id._id,
              status: "occupied",
              end_time: { $gt: now },
            },
            { $set: { end_time: now } },
            { session }
          );

          // tạo cleaning log
          const cleaningEnd = new Date(now.getTime() + 2 * 60 * 60 * 1000);

          await RoomStatusLog.create(
            [{
              room_id: bd.room_id._id,
              status: "cleaning",
              start_time: now,
              end_time: cleaningEnd,
              note: `Cleaning after checkout booking ${booking._id}`,
            }],
            { session }
          );
        }

        await Room.updateMany(
          { _id: { $in: bookingDetails.map(b => b.room_id._id) } },
          { $set: { room_status: "cleaning" } },
          { session }
        );
        break;
      }
    }

    booking.status = status;
    await booking.save({ session });

    await session.commitTransaction();
    session.endSession();

    return res.json({
      message: `Cập nhật trạng thái booking thành '${status}' thành công.`,
    });

  } catch (error) {
    await session.abortTransaction();
    session.endSession();

    return res.status(500).json({
      message: error.message || "Không thể cập nhật trạng thái booking.",
    });
  }
};

// đặt thêm phòng trước ngày checkin (cập nhật)
export const addRoomsToBooking = async (req, res) => {
  const session = await mongoose.startSession();
  session.startTransaction();

  try {
    const { bookingId } = req.params;
    const { rooms } = req.body;

    const booking = await Booking.findById(bookingId).session(session);
    if (!booking)
      return res.status(404).json({ message: "Không tìm thấy dữ liệu đặt phòng." });

    if (!["pending", "confirmed"].includes(booking.status))
      return res.status(400).json({ message: "Không thể đặt thêm phòng." });

    if (new Date() >= new Date(booking.expected_checkin))
      return res.status(400).json({ message: "Không thể thêm phòng sau ngày check-in." });

    if (!Array.isArray(rooms) || rooms.length === 0)
      return res.status(400).json({ message: "Danh sách phòng không hợp lệ." });

    const bookingDetails = [];

    for (const room of rooms) {
      const exists = await Room.exists({ _id: room.room_id });
      if (!exists)
        return res.status(404).json({ message: `Không tìm thấy phòng ${room.room_id}` });

      bookingDetails.push({
        booking_id: booking._id,
        room_id: room.room_id,
        expected_checkin: room.expected_checkin,
        expected_checkout: room.expected_checkout,
        base_fee: room.base_fee,
        status: "reserved",
      });
    }

    await BookingDetail.insertMany(bookingDetails, { session });

    // cập nhật khoảng thời gian booking tổng
    booking.expected_checkin = new Date(
      Math.min(booking.expected_checkin, ...rooms.map(r => new Date(r.expected_checkin)))
    );

    booking.expected_checkout = new Date(
      Math.max(booking.expected_checkout, ...rooms.map(r => new Date(r.expected_checkout)))
    );

    await booking.save({ session });

    await session.commitTransaction();
    session.endSession();

    res.json({ message: "Thêm phòng thành công." });

  } catch (err) {
    await session.abortTransaction();
    session.endSession();
    res.status(500).json({ message: err.message });
  }
};

// lấy mọi booking
export const getAllBookings = async (req, res) => {
  try {
    const totalBookings = await Booking.countDocuments();

    const bookings = await Booking.find()
      .populate("customer_id", "full_name phone_number CCCD")
      .populate("handled_by", "full_name position")
      .sort({ created_at: -1 })
      .lean();

    if (bookings.length === 0) {
      return res.json([]);
    }

    const bookingIds = bookings.map(b => b._id);

    // lấy chi tiết phòng cho các booking
    const bookingDetails = await BookingDetail.find({
      booking_id: { $in: bookingIds }
    })
      .populate("room_id", "room_number category_id")
      .lean();

    // group bookingDetails theo booking_id
    const bookingDetailMap = {};
    bookingDetails.forEach(detail => {
      const key = detail.booking_id.toString();
      if (!bookingDetailMap[key]) bookingDetailMap[key] = [];
      bookingDetailMap[key].push(detail);
    });

    // gắn detail vào từng booking
    const result = bookings.map(booking => ({
      ...booking,
      rooms: bookingDetailMap[booking._id.toString()] || []
    }));

    return res.status(200).json({total: totalBookings, result});

  } catch (error) {
    return res.status(500).json({
      message: error.message || "Không thể lấy danh sách booking."
    });
  }
};

const calculateBookingStatus = (details) => {
  if (details.every(d => d.status === "cancelled")) {
    return "cancelled";
  }

  if (details.every(d =>
    ["checked_out", "cancelled"].includes(d.status)
  )) {
    return "completed";
  }

  if (details.some(d => d.status === "checked_in")) {
    return "in_progress";
  }

  return "confirmed";
};

// checkin 1 phòng trong booking
export const checkinBookingDetail = async (req, res) => {
  const { bookingId, detailId } = req.params;
  const now = new Date();

  const session = await mongoose.startSession();
  session.startTransaction();

  try {
    const booking = await Booking.findById(bookingId).session(session);
    if (!booking) {
      throw new Error("Không tìm thấy booking.");
    }

    const detail = await BookingDetail.findOne({
      _id: detailId,
      booking_id: bookingId,
    }).session(session);

    if (!detail) {
      throw new Error("Không tìm thấy phòng trong booking.");
    }

    if (detail.status !== "confirmed") {
      throw new Error("Phòng này không ở trạng thái có thể check-in.");
    }

    // check conflict phòng
    const conflict = await RoomStatusLog.findOne({
      room_id: detail.room_id,
      start_time: { $lt: detail.expected_checkout },
      end_time: { $gt: now },
      status: { $in: ["booked", "occupied", "maintenance", "cleaning"] },
    }).session(session);

    if (conflict) {
      throw new Error("Phòng đang không trong trạng thái có thể checkin trong khoảng thời gian này.");
    }

    // cắt log booked hiện tại (nếu có)
    await RoomStatusLog.updateMany(
      {
        room_id: detail.room_id,
        status: "booked",
        end_time: { $gt: now },
      },
      { $set: { end_time: now } },
      { session }
    );

    // tạo log occupied
    await RoomStatusLog.create(
      [{
        room_id: detail.room_id,
        status: "occupied",
        start_time: now,
        end_time: detail.expected_checkout,
        note: `Check-in booking ${booking._id}`,
        handled_by: req.user?._id || null,
      }],
      { session }
    );

    // update BookingDetail
    detail.status = "checked_in";
    detail.actual_checkin = now;
    await detail.save({ session });

    // update room hiện tại
    await Room.findByIdAndUpdate(
      detail.room_id,
      { room_status: "occupied" },
      { session }
    );

    // cập nhật trạng thái (chung) của booking
    const allDetails = await BookingDetail
      .find({ booking_id: bookingId })
      .session(session);

    booking.status = calculateBookingStatus(allDetails);
    await booking.save({ session });

    await session.commitTransaction();
    session.endSession();

    return res.json({
      message: "Check-in phòng thành công.",
    });

  } catch (error) {
    await session.abortTransaction();
    session.endSession();

    return res.status(400).json({
      message: error.message || "Không thể check-in phòng.",
    });
  }
};

// checkout 1 phòng trong booking
export const checkoutBookingDetail = async (req, res) => {
  const { bookingId, detailId } = req.params;
  const now = new Date();

  const session = await mongoose.startSession();
  session.startTransaction();

  try {
    const booking = await Booking.findById(bookingId).session(session);
    if (!booking) {
      throw new Error("Không tìm thấy booking.");
    }

    const detail = await BookingDetail.findOne({
      _id: detailId,
      booking_id: bookingId,
    }).session(session);

    if (!detail) {
      throw new Error("Không tìm thấy phòng trong booking.");
    }

    if (detail.status !== "checked_in") {
      throw new Error("Phòng này chưa được check-in.");
    }

    // cắt log occupied hiện tại
    await RoomStatusLog.updateMany(
      {
        room_id: detail.room_id,
        status: "occupied",
        end_time: { $gt: now },
      },
      { $set: { end_time: now } },
      { session }
    );

    // tạo log cleaning
    await RoomStatusLog.create(
      [{
        room_id: detail.room_id,
        status: "cleaning",
        start_time: now,
        end_time: null,
        note: `Checkout booking ${booking._id} and is currently in cleaning session.`,
        handled_by: req.user?._id || null,
      }],
      { session }
    );

    // update BookingDetail
    detail.status = "checked_out";
    detail.actual_checkout = now;
    await detail.save({ session });

    // update room hiện tại
    await Room.findByIdAndUpdate(
      detail.room_id,
      { room_status: "cleaning" },
      { session }
    );

    // cập nhật trạng thái chung của booking (expect completed)
    const allDetails = await BookingDetail
      .find({ booking_id: bookingId })
      .session(session);

    booking.status = calculateBookingStatus(allDetails);
    await booking.save({ session });

    await session.commitTransaction();
    session.endSession();

    return res.json({
      message: "Checkout phòng thành công.",
    });

  } catch (error) {
    await session.abortTransaction();
    session.endSession();

    return res.status(400).json({
      message: error.message || "Không thể checkout phòng.",
    });
  }
};

// BOOKING CANCELLATION//

// hủy một phòng cụ thể trong booking
export const cancelBookingDetail = async (req, res) => {
  const { bookingId, detailId } = req.params;
  const { reason } = req.body;
  const now = new Date();

  const session = await mongoose.startSession();
  session.startTransaction();

  try {
    const booking = await Booking.findById(bookingId).session(session);
    if (!booking) {
      throw new Error("Không tìm thấy booking.");
    }

    if (!["pending", "confirmed"].includes(booking.status)) {
      throw new Error("Không thể hủy phòng trong booking này.");
    }

    const detail = await BookingDetail.findOne({
      _id: detailId,
      booking_id: bookingId,
    })
      .populate("room_id")
      .session(session);

    if (!detail) {
      throw new Error("Không tìm thấy phòng trong booking.");
    }

    if (detail.status === "cancelled") {
      throw new Error("Phòng này đã bị hủy trước đó.");
    }

    if (now >= new Date(detail.expected_checkin)) {
      throw new Error("Không thể hủy phòng sau ngày check-in.");
    }

    const roomId = detail.room_id._id;

    detail.status = "cancelled";
    await detail.save({ session });

    // cắt RoomStatusLog booked/confirmed trong tương lai
    await RoomStatusLog.updateMany(
      {
        room_id: roomId,
        status: { $in: ["booked", "confirmed"] },
        start_time: { $gte: now },
      },
      { $set: { start_time: now, end_time: now } },
      { session }
    );

    // nếu phòng đang booked thì trả về available
    const room = await Room.findById(roomId).session(session);
    if (room && room.room_status === "booked") {
      room.room_status = "available";
      await room.save({ session });

      await RoomStatusLog.create(
        [{
          room_id: roomId,
          status: "available",
          start_time: now,
          end_time: null,
          note: "Hủy phòng khỏi booking",
          handled_by: req.user?._id || null,
        }],
        { session }
      );
    }

    // log hủy
    await RoomCancellation.create(
      [{
        booking_id: booking._id,
        room_id: roomId,
        user_id: req.user._id,
        cancelled_by:
          req.user.system_role === "customer" ? "customer" : "employee",
        reason,
      }],
      { session }
    );

    await session.commitTransaction();
    session.endSession();

    return res.json({
      message: "Đã hủy phòng khỏi booking thành công.",
    });

  } catch (error) {
    await session.abortTransaction();
    session.endSession();

    return res.status(400).json({
      message: error.message || "Không thể hủy phòng.",
    });
  }
};

// hủy toàn bộ phòng = nguyên cái booking
export const cancelBooking = async (req, res) => {
  const session = await mongoose.startSession();
  session.startTransaction();

  try {
    const { bookingId } = req.params;
    const { reason } = req.body;

    const booking = await Booking.findById(bookingId).session(session);
    if (!booking)
      return res.status(404).json({ message: "Không tìm thấy booking." });

    const status = booking.status;

    if (!["pending", "confirmed"].includes(booking.status))
      return res.status(400).json({ message: "Không thể hủy booking này." });

    if (new Date() >= new Date(booking.expected_checkin))
      return res.status(400).json({ message: "Không thể hủy booking sau ngày check-in." });

    booking.status = "cancelled";
    await booking.save({ session });

    const details = await BookingDetail.find({ booking_id: bookingId }).session(session);

    for (const d of details) {
      d.status = "cancelled";
      await d.save({ session });

      await RoomCancellation.create([{
        booking_id: booking._id,
        room_id: d.room_id,
        user_id: req.user._id,
        cancelled_by: req.user.system_role === "customer" ? "customer" : "employee",
        reason,
        booking_status: status
      }], { session });
    }

    await session.commitTransaction();
    session.endSession();

    res.json({ message: "Đã hủy toàn bộ booking." });

  } catch (err) {
    await session.abortTransaction();
    session.endSession();
    res.status(500).json({ message: err.message });
  }
};

// thống kê lý do hủy phòng
export const getCancellationReasonStats = async (req, res) => {
  try {
    const { fromDate, toDate, cancelledBy } = req.query;
    const match = {};

    if (fromDate && isNaN(new Date(fromDate))) {
      return res.status(400).json({ message: "fromDate không hợp lệ" });
    }
    if (toDate && isNaN(new Date(toDate))) {
      return res.status(400).json({ message: "toDate không hợp lệ" });
    }

    if (fromDate || toDate) {
      match.cancelled_at = {};
      if (fromDate) match.cancelled_at.$gte = new Date(fromDate);
      if (toDate) match.cancelled_at.$lte = new Date(toDate);
    }

    const ALLOWED_CANCELLED_BY = ["user", "system", "admin"];
    if (cancelledBy && !ALLOWED_CANCELLED_BY.includes(cancelledBy)) {
      return res.status(400).json({ message: "cancelledBy không hợp lệ" });
    }

    if (cancelledBy) {
      match.cancelled_by = cancelledBy;
    }

    const stats = await RoomCancellation.aggregate([
      { $match: match },
      {
        $group: {
          _id: "$reason",
          total: { $sum: 1 },
        },
      },
    ]);

    const result = Object.keys(CANCELLATION_REASON_LABELS).map(code => {
      const found = stats.find(s => s._id === code);
      return {
        reason_code: code,
        reason_label: CANCELLATION_REASON_LABELS[code],
        total: found ? found.total : 0,
      };
    });

    res.status(200).json({ success: true, data: result });

  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
};
