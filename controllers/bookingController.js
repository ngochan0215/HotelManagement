import mongoose from "mongoose";
import { Booking, BookingDetail, Customer, Room, RoomCancellation, 
  Employee, RoomStatusLog, Discount, RoomCategory, BookingStatusLog } from "../models/index.js";
import { CANCELLATION_REASON_LABELS } from "../constants/cancellationReason.js";

// hàm tính số đêm
const calcNights = (expected_checkin, expected_checkout) => {
  const diffMs = new Date(expected_checkout) - new Date(expected_checkin);

  if (diffMs <= 0) {
    throw new Error("Thời gian checkout phải lớn hơn checkin");
  }

  const diffHours = diffMs / (1000 * 60 * 60);
  const days = diffHours / 24;

  // làm tròn lên 2 chữ số thập phân
  return Math.ceil(days * 100) / 100;
};

// hàm tính tổng tiền booking đối với booking chỉ cho phép checkin, checkout một lượt
export const calculateBookingPrice = async ({ customer_id, bookingDetails, expected_checkin, expected_checkout }) => {
  const nights = calcNights(expected_checkin, expected_checkout);

  const baseTotal = bookingDetails.reduce(
    (sum, d) => sum + (d.base_fee + (d.extra_fee || 0)) * nights, 0 );

  const now = new Date();

  // Lấy discount BOOKING đang active
  let discounts = await Discount.find({
    scope: "booking",
    begin_date: { $lte: now },
    end_date: { $gte: now },
  });

  // Filter theo rule nghiệp vụ
  const applicable = [];

  for (const d of discounts) {
    if (d.type === "FIRST_BOOKING") {
      const existed = await Booking.exists({
        customer_id,
        status: { $in: ["confirmed", "in_progress", "completed"] },
      });
      if (existed) continue;
    }
    applicable.push(d);
  }


  let price = baseTotal;
  const appliedDiscounts = [];

  const nonStackable = applicable.filter(d => !d.stackable);
  const stackable = applicable.filter(d => d.stackable);

  // Non-stackable: lấy cái % cao nhất
  if (nonStackable.length) {
    const best = nonStackable.sort((a, b) => b.percentage - a.percentage)[0];
    const amount = Math.round(price * best.percentage / 100);
    price -= amount;

    appliedDiscounts.push({
      discount_id: best._id,
      name: best.description,
      //description: best.description,
      percentage: best.percentage,
      applied_amount: amount,
    });
  }

  // Stackable: áp tuần tự
  for (const d of stackable) {
    const amount = Math.round(price * d.percentage / 100);
    price -= amount;

    appliedDiscounts.push({
      discount_id: d._id,
      name: d.description,
      //description: d.description,
      percentage: d.percentage,
      applied_amount: amount,
    });
  }

  const deposit = Math.round(price * 30 / 100);

  return {
    base_total: baseTotal,
    discounts: appliedDiscounts,
    final_total: price,
    deposit: deposit
  };
};

// hàm tính tổng tiền booking đối với booking cho phép checkin, checkout từng phòng khác nhau
export const calculateBookingPricee = async ({
  customer_id,
  bookingDetails,
}) => {
  let baseTotal = 0;
  const roomBreakdown = [];

  for (const d of bookingDetails) {
    const {
      base_fee,
      extra_fee = 0,
      expected_checkin,
      expected_checkout,
    } = d;

    if (
      typeof base_fee !== "number" ||
      base_fee < 0 ||
      !expected_checkin ||
      !expected_checkout
    ) {
      throw new Error("Dữ liệu phòng không hợp lệ");
    }

    const baseTotal = bookingDetails.reduce(
      (sum, d) => sum + (d.base_fee + (d.extra_fee || 0)) * nights, 0 );

    if (nights <= 0) {
      throw new Error("Thời gian check-in/check-out không hợp lệ");
    }

    const roomTotal = (base_fee + extra_fee) * nights;
    baseTotal += roomTotal;

    roomBreakdown.push({
      nights,
      base_fee,
      extra_fee,
      room_total: roomTotal,
    });
  }

  const now = new Date();

  // Lấy discount BOOKING đang active
  let discounts = await Discount.find({
    scope: "booking",
    begin_date: { $lte: now },
    end_date: { $gte: now },
    status: "active",
  });

  // Filter nghiệp vụ
  const applicable = [];

  for (const d of discounts) {
    if (d.type === "FIRST_BOOKING") {
      const existed = await Booking.exists({
        customer_id,
        status: { $in: ["confirmed", "checked_in", "completed"] },
      });
      if (existed) continue;
    }
    applicable.push(d);
  }

  let price = baseTotal;
  const appliedDiscounts = [];

  const nonStackable = applicable.filter(d => !d.stackable);
  const stackable = applicable.filter(d => d.stackable);

  // Non-stackable → lấy % cao nhất
  if (nonStackable.length) {
    const best = nonStackable.sort(
      (a, b) => b.percentage - a.percentage
    )[0];

    const amount = Math.round(price * best.percentage / 100);
    price -= amount;

    appliedDiscounts.push({
      discount_id: best._id,
      name: best.name,
      percentage: best.percentage,
      applied_amount: amount,
    });
  }

  // Stackable → áp tuần tự
  for (const d of stackable) {
    const amount = Math.round(price * d.percentage / 100);
    price -= amount;

    appliedDiscounts.push({
      discount_id: d._id,
      name: d.name,
      percentage: d.percentage,
      applied_amount: amount,
    });
  }

  const deposit = Math.round(price * 30 / 100);

  return {
    base_total: baseTotal,
    room_breakdown: roomBreakdown,
    discounts: appliedDiscounts,
    final_total: price,
    deposit: deposit
  };
};

// hàm check trạng thái
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

// hàm hiển thị thông tin khuyến mãi áp dụng và tổng tiền đặt phòng (checkin-out chung)
export const previewBookingPrice = async (req, res) => {
  try {
    const { customer_id, rooms, expected_checkin, expected_checkout } = req.body;

    if (!customer_id || !Array.isArray(rooms) || rooms.length === 0) {
      return res.status(400).json({ message: "Dữ liệu không hợp lệ." });
    }

    for (const r of rooms) {
      if ( !r.room_id || r.base_fee < 0) {
        return res.status(400).json({ message: "Thông tin phòng không hợp lệ." });
      }
    }

    if ( !expected_checkin || !expected_checkout) {
      return res.status(400).json({ message: "Phải điền đầy đủ thông tin check-in, check-out dự kiến." });
    }

    if ( new Date(expected_checkout) < new Date(expected_checkin) ) {
      return res.status(400).json({ message: "Ngày check-out dự kiến phải sau ngày check-in dự kiến." });
    }

    if ( new Date(expected_checkout) < new Date() ) {
      return res.status(400).json({ message: "Ngày check-out dự kiến không được trong quá khứ." });
    }

    if ( new Date(expected_checkin) < new Date() ) {
      return res.status(400).json({ message: "Ngày check-in dự kiến không được trong quá khứ." });
    }

    const result = await calculateBookingPrice({ customer_id, bookingDetails: rooms, expected_checkin, expected_checkout });

    return res.json(result);
    
  } catch (err) {
    return res.status(500).json({
      message: err.message || "Lỗi preview giá booking.",
    });
  }
};

// hàm hiển thị thông tin khuyến mãi áp dụng và tổng tiền đặt phòng (checkin-out riêng)
export const previewBookingPricee = async (req, res) => {
  try {
    const { customer_id, rooms } = req.body;

    if (!customer_id || !mongoose.Types.ObjectId.isValid(customer_id)) {
      return res.status(400).json({ message: "customer_id không hợp lệ." });
    }

    if (!Array.isArray(rooms) || rooms.length === 0) {
      return res.status(400).json({ message: "Phải chọn ít nhất một phòng." });
    }

    for (const [index, r] of rooms.entries()) {
      if (!r.room_id || !mongoose.Types.ObjectId.isValid(r.room_id)) {
        return res.status(400).json({
          message: `room_id không hợp lệ (phòng #${index + 1})`,
        });
      }

      if (typeof r.base_fee !== "number" || r.base_fee < 0) {
        return res.status(400).json({
          message: `base_fee không hợp lệ (phòng #${index + 1})`,
        });
      }

      if (!r.expected_checkin || !r.expected_checkout) {
        return res.status(400).json({
          message: `Thiếu check-in/check-out (phòng #${index + 1})`,
        });
      }

      const checkIn = new Date(r.expected_checkin);
      const checkOut = new Date(r.expected_checkout);

      if (isNaN(checkIn) || isNaN(checkOut)) {
        return res.status(400).json({
          message: `Thời gian không hợp lệ (phòng #${index + 1})`,
        });
      }

      if (checkOut <= checkIn) {
        return res.status(400).json({
          message: `Check-out phải sau check-in (phòng #${index + 1})`,
        });
      }
    }

    const result = await calculateBookingPricee({
      customer_id,
      bookingDetails: rooms,
    });

    return res.json({
      customer_id,
      rooms: result.room_breakdown,
      base_total: result.base_total,
      discounts: result.discounts,
      total_fee: result.final_total,
      deposit: result.deposit
    });

  } catch (err) {
    console.error("previewBookingPrice error:", err);
    return res.status(500).json({
      message: err.message || "Lỗi preview giá booking.",
    });
  }
};

//---- BOOKING ----//

// hàm thêm booking mới (đối với booking checkin, checkout một lượt tất cả)
export const createBooking = async (req, res) => {
  const session = await mongoose.startSession();
  session.startTransaction();

  try {
    const { customer_id, adults, children, deposit, 
      total_fee, rooms,  expected_checkin, expected_checkout } = req.body;

    const employee_id = req.user.userId;

    if (!customer_id || !adults || children === undefined || deposit === undefined || total_fee === undefined ) {
        return res.status(400).json({ message: "Phải điền đầy đủ các thông tin bắt buộc!"});
      }

    if (!mongoose.Types.ObjectId.isValid(customer_id)){
      return res.status(400).json({ message: "customer_id hoặc employee_id (handled_by) không hợp lệ!"});
    }

    const customer = await Customer.findById(customer_id);
    if (!customer)
      return res.status(404).json({ message: "Không tìm thấy khách hàng." });

    const employee = await Employee.findOne({ user_id: employee_id });
    if (!employee)
      return res.status(404).json({ message: "Không tìm thấy nhân viên." });

    if (!Array.isArray(rooms) || rooms.length === 0) {
      return res.status(400).json({ message: "Phải đặt ít nhất một phòng!" });
    }

    if ( !expected_checkin || !expected_checkout) {
      return res.status(400).json({ message: "Phải điền đầy đủ thông tin check-in, check-out dự kiến." });
    }

    if ( new Date(expected_checkout) < new Date(expected_checkin) ) {
      return res.status(400).json({ message: "Ngày check-out dự kiến phải sau ngày check-in dự kiến." });
    }

    if ( new Date(expected_checkout) < new Date() ) {
      return res.status(400).json({ message: "Ngày check-out dự kiến không được trong quá khứ." });
    }

    if ( new Date(expected_checkin) < new Date() ) {
      return res.status(400).json({ message: "Ngày check-in dự kiến không được trong quá khứ." });
    }

    for (const room of rooms) {
      if ( !room.room_id || !mongoose.Types.ObjectId.isValid(room.room_id)) {
        return res.status(400).json({ message: "room_id không hợp lệ." });
      } 

      const roomExists = await Room.exists({ _id: room.room_id });
      if (!roomExists) {
        return res.status(404).json({ message: `Không tìm thấy phòng với ID: ${room.room_id}.`});
      } 
  }

    const recalculated = await calculateBookingPrice({ customer_id, bookingDetails: rooms, expected_checkin, expected_checkout });
    if (recalculated.final_total !== total_fee) {
      return res.status(400).json({ message: "Tổng tiền booking không hợp lệ" });
    }

    const handled_by = employee._id;
    const isScheduled = new Date(expected_checkin) > new Date();

    const booking = await Booking.create(
      [
        {
          customer_id,
          handled_by,
          adults,
          children,
          deposit,
          total_fee,
          expected_checkin,
          expected_checkout,
          status: "pending",
          isScheduled
        },
      ],
      { session }
    );

    // tạo các chi tiết đặt phòng
    const bookingDetails = rooms.map(room => ({
      booking_id: booking[0]._id,
      room_id: room.room_id,
      expected_checkin: expected_checkin,
      expected_checkout: expected_checkout,
      base_fee: room.base_fee,
      status: "reserved",
    }));

    await BookingDetail.insertMany(bookingDetails, { session });

    // log trạng thái booking
    await BookingStatusLog.create(
      [{
        booking_id: booking[0]._id,
        status: "pending",
        start_time: new Date(),
        handled_by: handled_by,
        note: "Đơn đặt phòng được tạo thành công, đang chờ đặt cọc",
      }], { session });


    // update trạng thái các phòng được giữ chỗ
    const roomIds = bookingDetails.map(bd => bd.room_id);
    await Room.updateMany(
      { _id: { $in: roomIds } },
      { $set: { room_status: "reserved" } },
      { session }
    );

    // tạo log booked cho trạng thái phòng
    const roomStatusLogs = bookingDetails.map(bd => ({
      room_id: bd.room_id,
      status: "reserved",
      start_time: bd.expected_checkin,
      end_time: bd.expected_checkout,
      note: `Phòng được giữ chỗ bởi: ${booking._id} trong vòng 1 tiếng kể từ khi đặt`,
      handled_by: booking.handled_by,
    }));

    await RoomStatusLog.insertMany(roomStatusLogs, { session });

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

// hàm thêm booking mới (đối với booking checkin, checkout riêng)
export const createBookingg = async (req, res) => {
  const session = await mongoose.startSession();
  session.startTransaction();

  try {
    const { customer_id, handled_by, adults, children, deposit, total_fee, rooms } = req.body;
    if (!customer_id || !handled_by || !adults ) {
      return res.status(400).json({ message: "Phải điền đầy đủ các thông tin bắt buộc!"});
    }

    if (!mongoose.Types.ObjectId.isValid(customer_id) || !mongoose.Types.ObjectId.isValid(handled_by)){
      return res.status(400).json({ message: "customer_id hoặc employee_id (handled_by) không hợp lệ!"});
    }

    const customer = await Customer.findById(customer_id).session(session);
    if (!customer) {
      return res.status(404).json({ message: "Không tìm thấy khách hàng." });
    }

    const employee = await Employee.findOne({ user_id: handled_by }).session(session);
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

    const recalculated = await calculateBookingPricee({ customer_id, bookingDetails: rooms });
    if (recalculated.final_total !== total_fee) {
      return res.status(400).json({ message: "Tổng tiền booking không hợp lệ" });
    }

    // tạo booking
    const booking = await Booking.create(
      [
        {
          customer_id,
          handled_by: employee._id,
          adults,
          children,
          deposit,
          total_fee,
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

    // log trạng thái booking
    await BookingStatusLog.create(
      [{
        booking_id: booking[0]._id,
        status: "pending",
        start_time: new Date(),
        handled_by: handled_by,
        note: "Đơn đặt phòng được tạo thành công, đang chờ đặt cọc",
      }], { session });

    // update trạng thái các phòng được giữ chỗ
    const roomIds = bookingDetails.map(bd => bd.room_id);
    await Room.updateMany(
      { _id: { $in: roomIds } },
      { $set: { room_status: "reserved" } },
      { session }
    );

    // tạo log booked cho trạng thái phòng
    const roomStatusLogs = bookingDetails.map(bd => ({
      room_id: bd.room_id,
      status: "reserved",
      start_time: bd.expected_checkin,
      end_time: bd.expected_checkout,
      note: `Phòng được giữ chỗ bởi: ${booking._id} trong vòng 1 tiếng kể từ khi đặt`,
      handled_by: booking.handled_by,
    }));

    await RoomStatusLog.insertMany(roomStatusLogs, { session });

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
  const employee_id = req.user.userId;
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

    for (const bd of bookingDetails) {
      // const conflict = await RoomStatusLog.findOne({
      //   room_id: bd.room_id,
      //   status: { $in: ["booked", "occupied"] },
      //   start_time: { $lt: bd.expected_checkout },
      //   end_time: { $gt: bd.expected_checkin },
      // }).session(session);
      const conflict = await Room.findOne({
        _id: bd.room_id,
        status: { $in: ["booked", "occupied"] },
      }).session(session);

      if (conflict) {
        const room = await Room.findById(bd.room_id);
        throw new Error(`Phòng ${room.room_number} đã được giữ trong khoảng thời gian này`);
      }
    }

    const roomIds = bookingDetails.map(bd => bd.room_id);

    // update trạng thái phòng thành booked
    await Room.updateMany(
      { _id: { $in: roomIds } },
      { $set: { room_status: "booked" } },
      { session }
    );

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

    // tạo log booking
    await BookingStatusLog.findOneAndUpdate(
      { booking_id, end_time: null },
      { end_time: new Date() }
    );

    await BookingStatusLog.create({
      booking_id,
      status: "confirmed",
      start_time: new Date(),
      handled_by: employee_id,
      note: "Khách đã đặt cọc giữ chỗ đặt phòng.",
    });

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

    const hasConflict = async (roomId, start, end, statuses) => {
      return RoomStatusLog.findOne({
        room_id: roomId,
        status: { $in: statuses },
        start_time: { $lt: end },
        end_time: { $gt: start },
      }).session(session);
    };

    // đóng log booking hiện tại
    await BookingStatusLog.findOneAndUpdate(
      {
        booking_id,
        end_time: null,
      },
      {
        $set: { end_time: now },
      },
      { session }
    );

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

    const lastLog = await BookingStatusLog.findOne({ booking_id, end_time: null });
    if (lastLog?.status === status) {
      throw new Error("Booking đã ở trạng thái này");
    }

    await BookingStatusLog.create(
      [
        {
          booking_id,
          status,
          start_time: now,
          end_time: null,
          note: `Booking chuyển sang trạng thái ${status}`,
          handled_by: req.user?.userId || null,
        },
      ],
      { session }
    );

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
    const { rooms, expected_checkin, expected_checkout } = req.body;

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
    const { isScheduled, status } = req.query;
    const filter = {};

    if (isScheduled) filter.isScheduled = isScheduled;
    if (status) filter.status = status;

    const bookings = await Booking.find(filter)
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

    return res.status(200).json({total: bookings.length, result});

  } catch (error) {
    return res.status(500).json({
      message: error.message || "Không thể lấy danh sách booking."
    });
  }
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

    if (!["reserved", "confirmed"].includes(detail.status)) {
      throw new Error(`Phòng đang ở trạng thái '${detail.status}', không thể check-in.`);
    }

    // check conflict phòng
    const conflict = await RoomStatusLog.findOne({
      room_id: detail.room_id,
      start_time: { $lt: detail.expected_checkout },
      end_time: { $gt: now },
      status: { $in: ["occupied", "maintenance", "cleaning"] }, // <-- Đã xóa "booked"
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

    // cập nhật trạng thái (chung) của booking và log lại
    const allDetails = await BookingDetail
      .find({ booking_id: bookingId })
      .session(session);

    booking.status = calculateBookingStatus(allDetails);
    await booking.save({ session });

    await BookingStatusLog.create(
      [
        {
          booking_id: bookingId,
          status: booking.status,
          start_time: new Date(),
          end_time: null,
          note: `Booking chuyển sang trạng thái ${booking.status}`,
          handled_by: req.user?._id || null,
        },
      ],
      { session }
    );

    await session.commitTransaction();
    session.endSession();

    return res.json({
      message: "Check-in phòng thành công.",
    });

  } catch (error) {
    await session.abortTransaction();
    session.endSession();

    console.error("Lỗi Check-in:", error.message);

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
      throw new Error(`Phòng đang ở trạng thái '${detail.status}', không thể checkout.`);
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

    const cleaningDuration = 2 * 60 * 60 * 1000; // 2 giờ
    const cleaningEndTime = new Date(now.getTime() + cleaningDuration);

    await RoomStatusLog.create(
      [{
        room_id: detail.room_id,
        status: "cleaning",
        start_time: now,
        end_time: cleaningEndTime,
        note: `Checkout booking ${booking._id} -> Cleaning`,
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

    await BookingStatusLog.findOneAndUpdate(
      {
        booking_id: bookingId,
        end_time: null,
      },
      {
        $set: { end_time: now },
      },
      { session }
    );

    await BookingStatusLog.create(
      [
        {
          booking_id: bookingId,
          status: booking.status,
          start_time: new Date(),
          end_time: null,
          note: `Booking chuyển sang trạng thái ${booking.status}`,
          handled_by: req.user?._id || null,
        },
      ],
      { session }
    );

    await session.commitTransaction();
    session.endSession();

    return res.json({
      message: "Checkout thành công. Phòng đang được dọn dẹp.",
    });

  } catch (error) {
    await session.abortTransaction();
    session.endSession();
    console.error("Lỗi Checkout:", error.message);
    return res.status(400).json({
      message: error.message || "Không thể checkout phòng.",
    });
  }
};

//---- BOOKING CANCELLATION ----//

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

    // cập nhật trạng thái chung của booking
    const allDetails = await BookingDetail
      .find({ booking_id: bookingId })
      .session(session);

    booking.status = calculateBookingStatus(allDetails);
    await booking.save({ session });

    await BookingStatusLog.findOneAndUpdate(
      {
        bookingId,
        end_time: null,
      },
      {
        $set: { end_time: now },
      },
      { session }
    );

    await BookingStatusLog.create(
      [
        {
          bookingId,
          status: booking.status,
          start_time: new Date(),
          end_time: null,
          note: `Booking chuyển sang trạng thái ${booking.status}`,
          handled_by: req.user?._id || null,
        },
      ],
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

    const now = new Date();

    // update booking log
    await BookingStatusLog.findOneAndUpdate(
      {
        booking_id: bookingId,
        end_time: null,
      },
      {
        $set: { end_time: now },
      },
      { session }
    );

    await BookingStatusLog.create(
      [
        {
          booking_id: bookingId,
          status: booking.status,
          start_time: new Date(),
          end_time: null,
          note: `Booking đã bị hủy, chuyển sang trạng thái cancelled`,
          handled_by: req.user?._id || null,
        },
      ],
      { session }
    );

    const details = await BookingDetail.find({ booking_id: bookingId })
      .populate("room_id")
      .session(session);
    
    const roomIds = details.map(bd => bd.room_id);
    
    // đóng log cũ
    for (const bd of details) {
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
    // update status mới
    await Room.updateMany(
      { _id: { $in: roomIds } },
      { $set: { room_status: "available" } },
      { session }
    );

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

    // trừ điểm khách vì đã hủy
    await updateCustomerPoints({
      customer_id: booking.customer_id,
      points: -2,
      reason: "Trừ 2 điểm vì hủy booking"
    });

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

