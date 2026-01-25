import mongoose from "mongoose";
import { Booking, BookingDetail, BookingStatusLog, RoomStatusLog, RoomLog,
    Room, Customer, Employee, User
 } from "../models/index.js";
import { pushNotificationToUsers, pushNotification } from "../services/notificationService.js";

// Helper function để confirm booking (có thể gọi từ paymentSucceeded)
export const confirmBookingInternal = async (booking_id, employee_id = null, session = null) => {
  const useSession = session || await mongoose.startSession();
  const shouldStartTransaction = !session;
  
  if (shouldStartTransaction) {
    useSession.startTransaction();
  }

  try {
    //console.log("IM ALWAYS HERE");
    const booking = await Booking.findById(booking_id).session(useSession);
    if (!booking) {
      throw new Error("Không tìm thấy dữ liệu đặt phòng.");
    }

    if (booking.status !== "pending") {
      throw new Error("Trạng thái đặt phòng không hợp lệ.");
    }

    const bookingDetails = await BookingDetail.find({ booking_id })
      .session(useSession);

    if (bookingDetails.length === 0) {
      throw new Error("Booking không có phòng nào.");
    }

    for (const bd of bookingDetails) {
      const conflictLog = await RoomLog.findOne({
        room_id: bd.room_id,
        status: { $in: ["booked", "occupied"] },
        start_time: { $lt: bd.expected_checkout },
        $or: [
          { end_time: null },
          { end_time: { $gt: bd.expected_checkin } }
        ]
      }).session(useSession);

      if (conflictLog) {
        const room = await Room.findById(bd.room_id).session(useSession);
        throw new Error(
          `Phòng ${room.room_number} đã được giữ hoặc đang có khách trong khoảng ${bd.expected_checkin.toISOString()} - ${bd.expected_checkout.toISOString()}`
        );
      }
    }

    const roomIds = bookingDetails.map(bd => bd.room_id);

    // KHÔNG update room.room_status ngay - để scheduled job tự động sync từ log
    // Chỉ update start_time và end_time để tracking
    await Room.updateMany(
      { _id: { $in: roomIds } },
      { $set: 
        { 
          start_time: booking.expected_checkin,
          end_time: booking.expected_checkout, 
        } 
      },
      { session: useSession }
    );

    // cắt log cũ (trạng thái reserved) - RoomLog (bảng chính)
    await RoomLog.updateMany(
      {
        room_id: { $in: roomIds },
        status: "reserved",
        end_time: booking.expected_checkout,
      },
      { $set: { end_time: new Date() } },
      { session: useSession }
    );

    // cắt log cũ (trạng thái reserved) - RoomStatusLog (bảng dự phòng)
    await RoomStatusLog.updateMany(
      {
        room_id: { $in: roomIds },
        status: "reserved",
        end_time: booking.expected_checkout,
      },
      { $set: { end_time: new Date() } },
      { session: useSession }
    );

    // tạo log mới - RoomLog (bảng chính)
    const roomLogs = bookingDetails.map(bd => ({
      booking_id: bd.booking_id,
      room_id: bd.room_id,
      status: "booked",
      start_time: bd.expected_checkin,
      end_time: bd.expected_checkout,
      expected_end_time: bd.expected_checkout,
      note: `Phòng được giữ vì booking ${bd.booking_id} đã được cọc.`,
      handled_by: booking.handled_by,
    }));

    await RoomLog.insertMany(roomLogs, { session: useSession });

    // tạo log mới - RoomStatusLog (bảng dự phòng)
    const roomStatusLogs = bookingDetails.map(bd => ({
      room_id: bd.room_id,
      status: "booked",
      start_time: bd.expected_checkin,
      end_time: bd.expected_checkout,
      expected_end_time: bd.expected_checkout,
      note: `Phòng được giữ vì booking ${booking_id} đã được cọc.`,
      handled_by: booking.handled_by,
    }));

    await RoomStatusLog.insertMany(roomStatusLogs, { session: useSession });


    // update trạng thái booking
    booking.status = "confirmed";
    await booking.save({ session: useSession });

    // tạo log booking
    await BookingStatusLog.findOneAndUpdate(
      { booking_id, end_time: null },
      { end_time: new Date() }
    );

    await BookingStatusLog.create({
      booking_id,
      status: "confirmed",
      start_time: booking.expected_checkin,
      end_time: booking.expected_checkout,
      expected_end_time: booking.expected_checkout,
      handled_by: employee_id || booking.handled_by,
      note: "Khách đã đặt cọc giữ chỗ đặt phòng.",
    });

    await BookingDetail.updateMany(
      {
        room_id: { $in: roomIds },
        booking_id: booking_id,
        status: "reserved"
      },
      { $set: { status: "confirmed" } },
      { session: useSession }
    );

    console.log(`Booking ${booking_id} đã được xác nhận thành công.`);
    if (shouldStartTransaction) {
      await useSession.commitTransaction();
      useSession.endSession();
      console.log("Transaction committed.");
    }

    // gửi thông báo
    const customer_id = booking.customer_id;
    const customer = await Customer.findById(customer_id);

    try {
      // gửi thông báo cho admin
      const allAdmins = await User.find({ system_role: "manager", isBanned: { $ne: true } });
      const adminIds = allAdmins.map(u => u._id);
      if (allAdmins.length > 0) {
        await pushNotificationToUsers(
          adminIds,
          "Booking đã xác nhận thanh toán tiền cọc",
          `Booking có ID: #${booking._id.toString().slice(-6)} từ khách hàng ${customer.full_name || 'N/A'} đã xác nhận đặt cọc thành công.`,
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
          "Booking đặt cọc thành công",
          `Bạn đã đặt cọc booking có ID: #${booking._id.toString().slice(-6)} thành công!
            Hãy để ý ngày giờ checkin nhé.`,
          "booking",
          "Booking",
          booking._id,
          "unread"
        );
      }

      // gửi thông báo cho nhân viên thực hiện booking
      const employee = await Employee.findById(booking.handled_by).select("user_id").lean();
      if (employee && employee.user_id) {
        await pushNotification(
          employee.user_id,
          "Booking đặt cọc thành công",
          `Booking có ID: #${booking._id.toString().slice(-6)} từ khách hàng 
            ${customer.full_name || 'N/A'} đã xác nhận đặt cọc thành công.`,
          "booking",
          "Booking",
          booking._id,
          "unread"
        );
      }
      console.log("Notifications sent for booking confirmation.");
    } catch (notifError) {
      console.error("Error sending notification:", notifError);
    }

    return booking;
  } catch (error) {
    if (shouldStartTransaction) {
      await useSession.abortTransaction();
      useSession.endSession();
    }
    throw error;
  }
};