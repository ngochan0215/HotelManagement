import mongoose from "mongoose";
import { Booking, BookingDetail, Customer, Room, RoomCancellation, 
  Employee, RoomStatusLog, Discount, RoomLog, BookingStatusLog, User,
  Receipt, CleaningTask, EquipmentInstall, 
} from "../models/index.js";
import { CANCELLATION_REASON_LABELS } from "../constants/cancellationReason.js";
import { confirmBookingInternal } from "../services/bookingService.js";
//import { updateCustomerPoints } from "../services/customerService.js";
import { pushNotificationToUsers, pushNotification } from "../services/notificationService.js";
import { updateReceiptAfterCheckout } from "../controllers/receiptControllers.js";

// hàm tính số giờ khách ở
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

// hàm check trạng thái chung của booking (có nhiều chi tiết đặt phòng)
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

// hàm thêm booking mới (đối với booking checkin, checkout một lượt tất cả)
export const createBooking = async (req, res) => {
  const session = await mongoose.startSession();
  session.startTransaction();

  try {
    const { customer_id, adults, children, deposit, 
      total_fee, rooms, expected_checkin, expected_checkout, discount_id } = req.body;

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

      const roomExists = await Room.findById(room.room_id);
      if (!roomExists) {
        return res.status(404).json({ message: `Không tìm thấy phòng ${room.room_number}.`});
      } 

      if (roomExists.room_status !== "available") {
        return res.status(400).json({ message: `Phòng ${room.room_number} đang không trống.`});
      }
  }

    // Validate discount_id nếu có
    if (discount_id) {
      if (!mongoose.Types.ObjectId.isValid(discount_id)) {
        return res.status(400).json({ message: "discount_id không hợp lệ" });
      }
      const discount = await Discount.findById(discount_id);
      if (!discount) {
        return res.status(404).json({ message: "Không tìm thấy khuyến mãi" });
      }
      if (!discount.is_active) {
        return res.status(400).json({ message: "Khuyến mãi không còn hiệu lực" });
      }
      const now = new Date();
      if (now < discount.begin_date || now > discount.end_date) {
        return res.status(400).json({ message: "Khuyến mãi không còn trong thời gian hiệu lực" });
      }
    }

    const handled_by = employee._id;
    const isScheduled = new Date(expected_checkin) > new Date();
    const isImmediate = deposit === 0; // Đặt liền không cần cọc

    // Nếu đặt liền, tự động chuyển sang in-progress luôn
    let initialStatus = isImmediate ? "in_progress" : "pending";

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
          status: initialStatus,
          isScheduled
        },
      ],
      { session }
    );

    // tạo các chi tiết đặt phòng, nếu đặt liền thì trạng thái chi tiết cũng là confirmed
    const detailStatus = isImmediate ? "checked_in" : "reserved";
    
    const bookingDetails = rooms.map(room => ({
      booking_id: booking[0]._id,
      room_id: room.room_id,
      expected_checkin: expected_checkin,
      expected_checkout: expected_checkout,
      base_fee: room.base_fee,
      status: detailStatus,
    }));

    await BookingDetail.insertMany(bookingDetails, { session });

    // log trạng thái booking
    const statusNote = isImmediate 
      ? (initialStatus === "in_progress" 
          ? "Đơn đặt phòng được tạo thành công, đã check-in tự động (đặt liền)" 
          : "Đơn đặt phòng được tạo thành công, đã xác nhận (đặt liền, chờ check-in)")
      : "Đơn đặt phòng được tạo thành công, đang chờ đặt cọc";
    
    await BookingStatusLog.create(
      [{
        booking_id: booking[0]._id,
        status: initialStatus,
        start_time: expected_checkin,
        expected_end_time: expected_checkout,
        handled_by: handled_by,
        note: statusNote,
      }], { session }
    );

    // KHÔNG update room.room_status ngay - để scheduled job tự động sync từ log
    // Chỉ update start_time và end_time để tracking
    const roomIds = bookingDetails.map(bd => bd.room_id);
    
    await Room.updateMany(
      { _id: { $in: roomIds } },
      { $set: 
        { 
          start_time: isImmediate && initialStatus === "in_progress" ? new Date() : expected_checkin,
          end_time: expected_checkout, 
        } 
      },
      { session }
    );

    // tạo log cho trạng thái phòng - RoomLog (bảng chính)
    const roomLogs = bookingDetails.map(bd => ({
      booking_id: bd.booking_id,
      room_id: bd.room_id,
      status: isImmediate && initialStatus === "in_progress" ? "occupied" : "reserved",
      start_time: isImmediate && initialStatus === "in_progress" ? new Date() : bd.expected_checkin,
      expected_end_time: bd.expected_checkout,
      end_time: bd.expected_checkout,
      note: isImmediate ? 
        `Phòng được xác nhận (đặt liền) bởi booking ${booking[0]._id}`
        : `Phòng được giữ chỗ bởi: ${booking[0]._id} trong vòng 1 tiếng kể từ khi đặt`,
      handled_by: booking[0].handled_by || null,
    }));

    await RoomLog.insertMany(roomLogs, { session });

    // tạo log cho trạng thái phòng - RoomStatusLog (bảng dự phòng)
    const roomStatusLogs = bookingDetails.map(bd => ({
      room_id: bd.room_id,
      status: isImmediate && initialStatus === "in_progress" ? "occupied" : "reserved",
      start_time: isImmediate && initialStatus === "in_progress" ? new Date() : bd.expected_checkin,
      expected_end_time: bd.expected_checkout,
      end_time: bd.expected_checkout,
      note: isImmediate ? 
        `Phòng được xác nhận (đặt liền) bởi booking ${booking[0]._id}`
        : `Phòng được giữ chỗ bởi: ${booking[0]._id} trong vòng 1 tiếng kể từ khi đặt`,
      handled_by: booking[0].handled_by || null,
    }));

    await RoomStatusLog.insertMany(roomStatusLogs, { session });

    // Tạo hóa đơn ngay sau khi tạo booking
    const totalFee = booking[0].total_fee;
    const depositAmount = booking[0].deposit || 0;
    const finalAmount = totalFee;
    const amountDue = Math.max(finalAmount - depositAmount, 0);

    // dù có đặt liền hay đặt trước thì tình trạng hóa đơn đều là pending
    const paymentMethod = depositAmount === 0 ? "unknown" : "bank";
    const receiptStatus = "pending";

    // Tính base_room_fee (tiền phòng gốc trước khi trừ discount)
    const baseRoomFee = rooms.reduce((sum, r) => {
      const nights = calcNights(expected_checkin, expected_checkout);
      return sum + (r.base_fee * nights);
    }, 0);

    // Lấy discount info nếu có
    let discountSnapshot = null;
    if (discount_id) {
      const discount = await Discount.findById(discount_id).session(session);
      if (discount) {
        // Tính discount amount
        let discountAmount = 0;
        
        if (discount.discount.type === "PERCENT") {
          discountAmount = Math.round(baseRoomFee * discount.discount.value / 100);
          if (discount.discount.max_discount && discountAmount > discount.discount.max_discount) {
            discountAmount = discount.discount.max_discount;
          }
        } else {
          discountAmount = discount.discount.value;
        }
        
        discountSnapshot = {
          code: discount.code,
          name: discount.name,
          description: discount.description || "",
          discount_amount: discountAmount
        };
      }
    }

    const receipt = await Receipt.create(
      [{
        booking_id: booking[0]._id,
        employee_id: employee._id,
        discount_id: discount_id || null,
        discount_snapshot: discountSnapshot,
        base_room_fee: baseRoomFee,
        total_fee: totalFee,
        deposit_amount: depositAmount,
        final_amount: finalAmount,
        amount_due: amountDue,
        payment: paymentMethod,
        status: receiptStatus,
        note: isImmediate ? "Hóa đơn tạo tự động khi đặt liền (không cần cọc)" : "Hóa đơn tạo tự động, chờ thanh toán cọc",
      }],
      { session }
    );

    await session.commitTransaction();
    session.endSession();

    try {
      //console.log("Sending create booking notifications...");
      const customer = await Customer.findById(customer_id).populate("user_id", "_id");
      const allAdmins = await User.find({ system_role: "manager", isBanned: { $ne: true } });
      const adminIds = allAdmins.map(u => u._id);
      
      // gửi thông báo cho quản lý
      if (allAdmins.length > 0) {
        await pushNotificationToUsers(
          adminIds,
          "Booking mới",
          `Có booking mới với ID: #${booking[0]._id.toString().slice(-6)} từ khách hàng ${customer.full_name || 'N/A'}`,
          "booking",
          "Booking",
          booking[0]._id,
          "unread"
        );
      }

      // gửi thông báo cho khách hàng
      await pushNotification(
        customer.user_id,
        "Booking mới",
        `Bạn đã đặt booking mới có ID: #${booking[0]._id.toString().slice(-6)} thành công! 
          Vui lòng thanh toán tiền cọc nếu đặt trước nhe.`,
        "booking",
        "Booking",
        booking[0]._id,
        "unread"
      );

      // gửi thông báo cho tất cả lễ tân
      const receptionistEmployees = await Employee.find(
        { position: "receptionist" },
        { user_id: 1 }
      );
      const userIds = receptionistEmployees.map(e => e.user_id);

      const validUsers = await User.find({
        _id: { $in: userIds },
        isBanned: { $ne: true }
      }).select("_id");

      await pushNotificationToUsers(
        validUsers.map(u => u._id),
        "Booking mới",
        `Có booking mới với ID: #${booking[0]._id.toString().slice(-6)} từ khách hàng ${customer.full_name || "N/A"}`,
        "booking",
        "Booking",
        booking[0]._id,
        "unread"
      );
    } catch (notifError) {
      console.error("Error sending notification:", notifError);
    }

    console.log("Booking created successfully.");

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
  
  try {
    console.log("Confirming booking:", booking_id, "by employee:", employee_id);
    const booking = await confirmBookingInternal(booking_id, employee_id);
    console.log("Booking confirmed:", booking);

    return res.status(200).json({
      message: "Xác nhận đặt phòng thành công.",
      booking,
    });
  } catch (error) {
    return res.status(500).json({
      message: error.message || "Không thể xác nhận đặt phòng.",
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
      return RoomLog.findOne({
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
        // Đóng log cũ - tìm log active
        for (const bd of bookingDetails) {
          await RoomStatusLog.updateMany(
            {
              room_id: bd.room_id._id,
              start_time: { $lte: now },
              $or: [
                { end_time: { $gte: now } },
                { end_time: null }
              ]
            },
            { $set: { end_time: now } },
            { session }
          );

          await RoomLog.updateMany(
            {
              room_id: bd.room_id._id,
              start_time: { $lte: now },
              $or: [
                { end_time: { $gte: now } },
                { end_time: null }
              ]
            },
            { $set: { end_time: now } },
            { session }
          );
        }
        
        // Tạo log "available" mới (theo Option 1 - để scheduled job sync)
        const availableLogs = bookingDetails.map(bd => ({
          room_id: bd.room_id._id,
          status: "available",
          start_time: now,
          end_time: null,
          note: `Booking ${booking._id} bị ${status}, phòng được giải phóng`,
          handled_by: req.user?._id || null,
        }));

        await RoomStatusLog.insertMany(availableLogs, { session });

        const availableRoomLogs = bookingDetails.map(bd => ({
          room_id: bd.room_id._id,
          status: "available",
          start_time: now,
          end_time: null,
          note: `Booking ${booking._id} bị ${status}, phòng được giải phóng`,
          handled_by: req.user?._id || null,
        }));

        await RoomLog.insertMany(availableRoomLogs, { session });
        
        // KHÔNG update room.room_status ngay - để scheduled job tự động sync từ log
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

          // Tạo log booked trong RoomLog (bảng chính)
          await RoomLog.create(
            [{
              booking_id: booking._id,
              room_id: bd.room_id._id,
              status: "booked",
              start_time: bd.expected_checkin,
              end_time: bd.expected_checkout,
              expected_end_time: bd.expected_checkout,
              note: `Booking ${booking._id} confirmed`,
              handled_by: booking.handled_by || null,
            }],
            { session }
          );

          // Log vào RoomStatusLog (bảng dự phòng)
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

        // KHÔNG update room.room_status ngay - để scheduled job tự động sync từ log
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

          // Đóng log "booked" hoặc "reserved" hiện tại (RoomLog - bảng chính)
          await RoomLog.updateMany(
            {
              room_id: bd.room_id._id,
              start_time: { $lte: now },
              $or: [
                { end_time: { $gte: now } },
                { end_time: null }
              ],
              status: { $in: ["booked", "reserved"] }
            },
            { $set: { end_time: now } },
            { session }
          );

          // Đóng log "booked" hoặc "reserved" hiện tại (RoomStatusLog - bảng dự phòng)
          await RoomStatusLog.updateMany(
            {
              room_id: bd.room_id._id,
              start_time: { $lte: now },
              $or: [
                { end_time: { $gte: now } },
                { end_time: null }
              ],
              status: { $in: ["booked", "reserved"] }
            },
            { $set: { end_time: now } },
            { session }
          );

          // Tạo log occupied trong RoomLog (bảng chính)
          await RoomLog.create(
            [{
              booking_id: booking._id,
              room_id: bd.room_id._id,
              status: "occupied",
              start_time: now,
              end_time: bd.expected_checkout,
              expected_end_time: bd.expected_checkout,
              note: `Booking ${booking._id} checked-in`,
              handled_by: booking.handled_by || null,
            }],
            { session }
          );

          // Tạo log occupied trong RoomStatusLog (bảng dự phòng)
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

        // KHÔNG update room.room_status ngay - để scheduled job tự động sync từ log
        break;
      }

      case "checked_out": {
        for (const bd of bookingDetails) {
          // Đóng log "occupied" hiện tại - RoomLog (bảng chính)
          await RoomLog.updateMany(
            {
              room_id: bd.room_id._id,
              status: "occupied",
              start_time: { $lte: now },
              $or: [
                { end_time: { $gte: now } },
                { end_time: null }
              ]
            },
            { $set: { end_time: now } },
            { session }
          );

          // Đóng log "occupied" hiện tại - RoomStatusLog (bảng dự phòng)
          await RoomStatusLog.updateMany(
            {
              room_id: bd.room_id._id,
              status: "occupied",
              start_time: { $lte: now },
              $or: [
                { end_time: { $gte: now } },
                { end_time: null }
              ]
            },
            { $set: { end_time: now } },
            { session }
          );

          // Tạo cleaning log - RoomLog (bảng chính)
          const cleaningEnd = new Date(now.getTime() + 2 * 60 * 60 * 1000);

          await RoomLog.create(
            [{
              booking_id: booking._id,
              room_id: bd.room_id._id,
              status: "cleaning",
              start_time: now,
              end_time: cleaningEnd,
              expected_end_time: cleaningEnd,
              note: `Cleaning after checkout booking ${booking._id}`,
              handled_by: null,
            }],
            { session }
          );

          // Tạo cleaning log - RoomStatusLog (bảng dự phòng)
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

        // KHÔNG update room.room_status ngay - để scheduled job tự động sync từ log
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

    // Gửi thông báo cho tất cả user (admin, employee, customer) về thay đổi trạng thái booking
    try {
      const allUsers = await User.find({ isBanned: { $ne: true } }).select("_id");
      const userIds = allUsers.map(u => u._id);
      
      const statusLabels = {
        pending: "Đang chờ",
        confirmed: "Đã xác nhận",
        checked_in: "Đã check-in",
        checked_out: "Đã check-out",
        cancelled: "Đã hủy",
        expired: "Đã hết hạn"
      };
      
      if (userIds.length > 0) {
        await pushNotificationToUsers(
          userIds,
          "Thay đổi trạng thái booking",
          `Booking #${booking_id.toString().slice(-6)} đã chuyển sang trạng thái "${statusLabels[status] || status}"`,
          "booking",
          "Booking",
          booking_id,
          "unread"
        );
      }
    } catch (notifError) {
      console.error("Error sending notification:", notifError);
      // Không throw error để không ảnh hưởng đến response chính
    }

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
    const booking = await Booking.findById(bookingId)
      .populate("handled_by", "user_id")
      .session(session);
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

    const room = await Room.findById(detail.room_id).session(session);
    if (!room) {
      throw new Error("Không tìm thấy thông tin phòng.");
    }

    // check conflict phòng (sử dụng RoomLog - bảng chính)
    const conflict = await RoomLog.findOne({
      room_id: detail.room_id,
      start_time: { $lt: detail.expected_checkout },
      end_time: { $gt: now },
      status: { $in: ["occupied", "maintenance", "cleaning"] }, // <-- Đã xóa "booked"
    }).session(session);

    if (conflict) {
      throw new Error("Phòng đang không trong trạng thái có thể checkin trong khoảng thời gian này.");
    }

    // cắt log booked hiện tại (nếu có) - RoomLog (bảng chính)
    await RoomLog.updateMany(
      {
        room_id: detail.room_id,
        status: "booked",
        end_time: detail.expected_checkout,
      },
      { $set: { end_time: now } },
      { session }
    );

    // cắt log booked hiện tại (nếu có) - RoomStatusLog (bảng dự phòng)
    await RoomStatusLog.updateMany(
      {
        room_id: detail.room_id,
        status: "booked",
        end_time: detail.expected_checkout,
      },
      { $set: { end_time: now } },
      { session }
    );

    // tạo log occupied - RoomLog (bảng chính)
    await RoomLog.create(
      [{
        booking_id: booking._id,
        room_id: detail.room_id,
        status: "occupied",
        start_time: now,
        end_time: detail.expected_checkout,
        expected_end_time: detail.expected_checkout,
        note: `Phòng đã được checkin theo booking ${booking._id}`,
        handled_by: booking.handled_by || null,
      }],
      { session }
    );

    // tạo log occupied - RoomStatusLog (bảng dự phòng)
    await RoomStatusLog.create(
      [{
        room_id: detail.room_id,
        status: "occupied",
        start_time: now,
        end_time: detail.expected_checkout,
        note: `Phòng đã được checkin theo booking ${booking._id}`,
        handled_by: booking.handled_by || null,
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
      { 
        room_status: "occupied",
        start_time: now,
        end_time: detail.expected_checkout, 
      },
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

    const customer_id = booking.customer_id;
    const customer = await Customer.findById(customer_id);

    try {
      // gửi thông báo cho quản lý 
      const allAdmins = await User.find({ system_role: "manager", isBanned: { $ne: true } });
      const adminIds = allAdmins.map(u => u._id);
      if (allAdmins.length > 0) {
        await pushNotificationToUsers(
          adminIds,
          "Booking đã xác nhận check-in",
          `Phòng ${room.room_number} thuộc booking với ID: #${booking._id.toString().slice(-6)} từ khách hàng ${customer.full_name || 'N/A'} 
            đã xác nhận checkin.`,
          "booking",
          "Booking",
          booking._id,
          "unread"
        );
      }

      // gửi thông báo cho khách hàng
      const customerUser = await Customer.findById(customer_id).select("user_id").lean();
      if (customerUser && customerUser.user_id) {
        await pushNotification(
          customerUser.user_id,
          "Bạn đã check-in thành công",
          `Bạn đã checkin phòng ${room.room_number} thuộc booking #${booking._id.toString().slice(-6)} thành công!
            Chúc bạn có những trải nghiệm tuyệt vời.`,
          "booking",
          "Booking",
          booking._id,
          "unread"
        );
      }

      // gửi thông báo cho nhân viên thực hiện booking
      if (booking.handled_by && booking.handled_by.user_id) {
        await pushNotification(
          booking.handled_by.user_id,
          "Booking check-in thành công",
          `Phòng ${room.room_number} thuộc booking #${booking._id.toString().slice(-6)} từ khách hàng ${customer.full_name || 'N/A'} 
            đã xác nhận checkin.`,
          "booking",
          "Booking",
          booking._id,
          "unread"
        );
      }
    } catch (notifError) {
      console.error("Error sending notification:", notifError);
    }

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

    const room = await Room.findById(detail.room_id).session(session);
    if (!room) {
      throw new Error("Không tìm thấy thông tin phòng.");
    }

    // cắt log occupied hiện tại - RoomLog (bảng chính)
    await RoomLog.updateMany(
      {
        room_id: detail.room_id,
        status: "occupied",
        end_time: { $gt: now },
      },
      { $set: { end_time: now } },
      { session }
    );

    // cắt log occupied hiện tại - RoomStatusLog (bảng dự phòng)
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

    // Tạo RoomLog cho cleaning (bảng chính)
    const [roomLog] = await RoomLog.create(
      [{
        booking_id: detail.booking_id,
        room_id: detail.room_id,
        status: "cleaning",
        start_time: now,
        end_time: cleaningEndTime,
        expected_end_time: cleaningEndTime,
        note: `Phòng đã được checkout theo booking ${booking._id}, chuyển sang dọn dẹp.`,
        handled_by: null, // Sẽ được gán sau khi admin chọn nhân viên
      }],
      { session }
    );

    // Tạo RoomStatusLog cho cleaning (bảng dự phòng)
    await RoomStatusLog.create(
      [{
        room_id: detail.room_id,
        status: "cleaning",
        start_time: now,
        end_time: cleaningEndTime,
        expected_end_time: cleaningEndTime,
        note: `Phòng đã được checkout theo booking ${booking._id}, chuyển sang dọn dẹp.`,
        handled_by: req.user?._id || null,
      }],
      { session }
    );

    // Tạo CleaningTask với status pending
    await CleaningTask.create(
      [{
        room_id: detail.room_id,
        room_log_id: roomLog._id,
        booking_id: bookingId,
        status: "pending",
        note: `Dọn dẹp phòng sau checkout booking ${booking._id}`,
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
      { 
        room_status: "cleaning",
        start_time: now,
        end_time: cleaningEndTime, 
      },
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

    const customer_id = booking.customer_id;
    const customer = await Customer.findById(customer_id).session(session);

    // Cập nhật hóa đơn sau khi checkout để thêm các phí dịch vụ và đền bù
    try {
      await updateReceiptAfterCheckout(bookingId, session);
    } catch (receiptError) {
      console.error("Lỗi khi cập nhật hóa đơn sau checkout:", receiptError);
      // Không throw error để không ảnh hưởng đến quá trình checkout
    }

    await session.commitTransaction();
    session.endSession();

    try {
      // gửi thông báo cho admin
      const allAdmins = await User.find({ system_role: "manager", isBanned: { $ne: true } });
      const adminIds = allAdmins.map(u => u._id);
      if (allAdmins.length > 0) {
        await pushNotificationToUsers(
          adminIds,
          "Booking đã xác nhận check-out",
          `Phòng ${room.room_number} thuộc booking #${booking._id.toString().slice(-6)} từ khách hàng ${customer.full_name || 'N/A'} 
            đã xác nhận check-out. Hãy kiểm tra hóa đơn và dọn dẹp phòng.`,
          "booking",
          "Booking",
          booking._id,
          "unread"
        );
      }

      // gửi thông báo cho khách hàng
      // Lấy user_id từ customer
      const customerUser = await Customer.findById(customer_id).select("user_id").lean();
      if (customerUser && customerUser.user_id) {
        await pushNotification(
          customerUser.user_id,
          "Bạn đã check-out thành công",
          `Bạn đã checkout phòng ${room.room_number} thuộc booking #${booking._id.toString().slice(-6)} thành công!
            Cảm ơn bạn đã lựa chọn dịch vụ của chúng tôi.`,
          "booking",
          "Booking",
          booking._id,
          "unread"
        );
      }

      // gửi thông báo cho nhân viên thực hiện booking
      if (booking.handled_by && booking.handled_by.user_id) {
        await pushNotification(
          booking.handled_by.user_id,
          "Booking check-out thành công",
          `Phòng ${room.room_number} thuộc booking #${booking._id.toString().slice(-6)} từ khách hàng ${customer.full_name || 'N/A'} 
            đã xác nhận check-out. Hãy kiểm tra hóa đơn và dọn dẹp phòng.`,
          "booking",
          "Booking",
          booking._id,
          "unread"
        );
      }
    } catch (notifError) {
      console.error("Error sending notification:", notifError);
    }

    return res.json({
      success: true,
      message: "Checkout thành công. Vui lòng gán nhân viên dọn dẹp.",
      data: {
        room_log_id: roomLog._id,
        room_id: detail.room_id,
        room_number: room.room_number,
        booking_id: bookingId,
      },
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

    // cập nhật trạng thái booking detail
    detail.status = "cancelled";
    detail.cancelled_at = now;
    detail.cancellation_reason = reason;
    await detail.save({ session });

    // Đóng log cũ - tìm log active - RoomLog (bảng chính)
    await RoomLog.updateMany(
      {
        room_id: roomId,
        start_time: { $lte: now },
        $or: [
          { end_time: { $gte: now } },
          { end_time: null }
        ]
      },
      { $set: { end_time: now } },
      { session }
    );

    // Đóng log cũ - tìm log active - RoomStatusLog (bảng dự phòng)
    await RoomStatusLog.updateMany(
      {
        room_id: roomId,
        start_time: { $lte: now },
        $or: [
          { end_time: { $gte: now } },
          { end_time: null }
        ]
      },
      { $set: { end_time: now } },
      { session }
    );

    // Tạo log "available" mới - RoomLog (bảng chính)
    await RoomLog.create(
      [{
        room_id: roomId,
        status: "available",
        start_time: now,
        end_time: null,
        note: "Hủy phòng khỏi booking",
        handled_by: req.user?.userId || null,
      }],
      { session }
    );

    // Tạo log "available" mới - RoomStatusLog (bảng dự phòng)
    await RoomStatusLog.create(
      [{
        room_id: roomId,
        status: "available",
        start_time: now,
        end_time: null,
        note: "Hủy phòng khỏi booking",
        handled_by: req.user?.userId || null,
      }],
      { session }
    );

    // KHÔNG update room.room_status ngay - để scheduled job tự động sync từ log

    // thêm bản ghi hủy phòng
    await RoomCancellation.create(
      [{
        booking_id: booking._id,
        room_id: roomId,
        user_id: req.user._id,
        cancelled_by: req.user.system_role === "customer" ? "customer" : "employee",
        cancelled_by_user: req.user.userId,
        booking_status: booking.status,
        cancelled_at: now,
        reason,
      }],
      { session }
    );

    // cập nhật trạng thái chung của booking
    const allDetails = await BookingDetail
      .find({ booking_id: bookingId })
      .session(session);

    const new_status = calculateBookingStatus(allDetails);
    if (new_status !== booking.status) {  
      booking.status = new_status;
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
            handled_by: req.user?.userId || null,
          },
        ],
        { session }
      );
    }

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
    
    const roomIds = details.map(bd => bd.room_id._id || bd.room_id);
    
    // đóng log cũ - tìm log active - RoomLog (bảng chính)
    for (const bd of details) {
      const roomId = bd.room_id._id || bd.room_id;
      
      await RoomLog.updateMany(
        {
          room_id: roomId,
          start_time: { $lte: now },
          $or: [
            { end_time: { $gte: now } },
            { end_time: null }
          ]
        },
        { $set: { end_time: now } },
        { session }
      );

      // đóng log cũ - tìm log active - RoomStatusLog (bảng dự phòng)
      await RoomStatusLog.updateMany(
        {
          room_id: roomId,
          start_time: { $lte: now },
          $or: [
            { end_time: { $gte: now } },
            { end_time: null }
          ]
        },
        { $set: { end_time: now } },
        { session }
      );
    }

    // Tạo log "available" mới cho các phòng - RoomLog (bảng chính)
    const availableRoomLogs = details.map(bd => {
      const roomId = bd.room_id._id || bd.room_id;
      return {
        room_id: roomId,
        status: "available",
        start_time: now,
        end_time: null,
        note: `Phòng được giải phóng sau khi hủy booking ${booking._id}`,
        handled_by: req.user?.userId || null,
      };
    });

    await RoomLog.insertMany(availableRoomLogs, { session });

    // Tạo log "available" mới cho các phòng - RoomStatusLog (bảng dự phòng)
    const availableLogs = details.map(bd => {
      const roomId = bd.room_id._id || bd.room_id;
      return {
        room_id: roomId,
        status: "available",
        start_time: now,
        end_time: null,
        note: `Phòng được giải phóng sau khi hủy booking ${booking._id}`,
        handled_by: req.user?.userId || null,
      };
    });

    await RoomStatusLog.insertMany(availableLogs, { session });

    // KHÔNG update room.room_status ngay - để scheduled job tự động sync từ log
    // Chỉ update start_time và end_time để tracking
    await Room.updateMany(
      { _id: { $in: roomIds } },
      { $set: { 
        start_time: now,
        end_time: now
       } },
      { session }
    );

    for (const d of details) {
      // cập nhật trạng thái booking detail
      d.status = "cancelled";
      d.cancelled_at = now;
      d.cancellation_reason = reason;
      await d.save({ session });

      // ghi log hủy phòng
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
    // await updateCustomerPoints({
    //   customer_id: booking.customer_id,
    //   points: -20,
    //   reason: "Trừ 20 điểm vì hủy booking"
    // });

    // hủy luôn hóa đơn
    await Receipt.updateMany(
      {
        booking_id: booking._id
      },
      { $set: { status: "cancelled" } },
      { session }
    );
   
    await session.commitTransaction();
    session.endSession();

    const customer = await Customer.findById(booking.customer_id);
    const employee = await Employee.findById(booking.handled_by);

    console.log("Sending cancellation notifications...");
    try {
      // gửi thông báo cho admin
      const allAdmins = await User.find({ system_role: "manager", isBanned: { $ne: true } });
      const adminIds = allAdmins.map(u => u._id);
      if (allAdmins.length > 0) {
        await pushNotificationToUsers(
          adminIds,
          "Booking đã bị hủy",
          `Booking có ID: #${booking._id.toString().slice(-6)} từ khách hàng ${customer.full_name || 'N/A'} 
            đã xác nhận hủy.`,
          "booking",
          "Booking",
          booking._id,
          "unread"
        );
      }

      // gửi thông báo cho khách hàng
      if (customer && customer.user_id) {
        await pushNotification(
          customer.user_id,
          "Booking đã bị hủy",
          `Bạn đã hủy booking có ID: #${booking._id.toString().slice(-6)}. 
            Tiền cọc của bạn sẽ không được hoàn lại!`,
          "booking",
          "Booking",
          booking._id,
          "unread"
        );
      }

      // gửi thông báo cho nhân viên thực hiện booking
      if (employee && employee.user_id) {
        await pushNotification(
          employee.user_id,
          "Booking đã bị hủy",
          `Booking có ID: #${booking._id.toString().slice(-6)} từ khách hàng ${customer.full_name || 'N/A'} 
            đã xác nhận hủy.`,
          "booking",
          "Booking",
          booking._id,
          "unread"
        );
      }
    } catch (notifError) {
      console.error("Error sending notification:", notifError);
    }

    console.log("Cancellation process completed successfully.");
    res.json({ message: "Đã hủy toàn bộ booking." });

  } catch (err) {
    await session.abortTransaction();
    session.endSession();
    res.status(500).json({ messsage: "SERVER ERROR (cancelBooking): " + err.message });
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

