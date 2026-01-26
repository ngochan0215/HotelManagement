import { EquipmentTicket, Notification, User, EquipmentInstall, Customer,
    GoodTicket, RoomLog, UsageDetail, Booking, BookingDetail, 
    BookingStatusLog, Room, RoomStatusLog, Equipment, EquipmentCategory, EquipmentLog, InstallDetail, Employee
} from "../models/index.js";
import mongoose from "mongoose";
import { recalcServiceUsageStatus } from "../controllers/serviceController.js";
import { calculateMembershipTier, updateCustomerPoints, updateCustomerTier } from "../controllers/customerController.js";
import { pushNotificationToUsers, pushNotification } from "../services/notificationService.js";

export const notifyImportTickets = async () => {
    const start = new Date();
    start.setHours(0, 0, 0, 0);

    const end = new Date();
    end.setHours(23, 59, 59, 999);

    const managers = await User.find({ system_role: "manager" }).select("_id");

    // phiếu quá hạn nhập
    const expiredTickets = await EquipmentTicket.find({
        status: "waiting_confirm",
        import_date: { $lt: start }
    });

    if (expiredTickets.length > 0) {
        await EquipmentTicket.updateMany(
            { _id: { $in: expiredTickets.map(t => t._id) } },
            { status: "expired" }
        );

        const managerIds = managers.map(m => m._id);
        
        for (const ticket of expiredTickets) {
            try {
              await pushNotificationToUsers(
                  managerIds,
                  "Phiếu nhập thiết bị quá hạn",
                  `Phiếu nhập thiết bị ${ticket._id} đã quá ngày nhập kho và bị chuyển sang trạng thái quá hạn.`,
                  "system",
                  "Order",
                  ticket._id,
                  "unread"
              );
            } catch (error) {
              console.error(`Error sending notification for expired ticket ${ticket._id}:`, error);
            }
        }
    }

    // phiếu đến ngày
    const todayTickets = await EquipmentTicket.find({
        status: "pending",
        import_date: { $gte: start, $lte: end }
    });

    if (todayTickets.length > 0) {
        await EquipmentTicket.updateMany(
            { _id: { $in: todayTickets.map(t => t._id) } },
            { status: "waiting_confirm" }
        );

        const managerIds = managers.map(m => m._id);
        
        for (const ticket of todayTickets) {
            try {
                await pushNotificationToUsers(
                    managerIds,
                    "Phiếu nhập thiết bị đến ngày",
                    `Phiếu nhập ${ticket._id} đã đến ngày nhập kho.`,
                    "system",
                    "Order",
                    ticket._id,
                    "unread"
                );
            } catch (error) {
                console.error(`Error sending notification for today ticket ${ticket._id}:`, error);
            }
        }
    }
};

export const notifyInstallTickets = async () => {
  // const session = await mongoose.startSession();
  // session.startTransaction();
  try {
    const now = new Date();

    const start = new Date();
    start.setHours(0, 0, 0, 0);

    const end = new Date();
    end.setHours(23, 59, 59, 999);

    const managers = await User.find({ system_role: "manager" })
      .select("_id");
      //.session(session);

    // phiếu quá hạn
    const expiredTickets = await EquipmentInstall.find({
      status: { $in: ["waiting_confirm", "pending", "assigned"] },
      install_date: { $lt: start },
    });

    console.log("EXPIRED TICKETS: ", expiredTickets);

    for (const ticket of expiredTickets) {
      ticket.status = "expired";
      await ticket.save();

      // lấy chi tiết
      const details = await InstallDetail.find({
        install_id: ticket._id,
      });

      const equipmentIds = details.map(d => d.equipment_id);

      if (equipmentIds.length) {
        // Lấy thông tin thiết bị để đếm theo category
        const equipments = await Equipment.find({ _id: { $in: equipmentIds } });
        
        // update equipment về trạng thái gốc và xóa room_id
        await Equipment.updateMany(
          { _id: { $in: equipmentIds } },
          { 
            status: "in-stock", 
            condition: "new",
            room_id: null // Xóa room_id khi phiếu hết hạn
          }
        );

        // Cập nhật storage_quantity: Cộng lại số lượng thiết bị về kho
        // Chỉ áp dụng cho phiếu lắp đặt (type = 'install') - thiết bị đã được trừ kho trước đó
        if (ticket.type === 'install') {
          const categoryCountMap = new Map();
          equipments.forEach(eq => {
            const categoryId = eq.category_id.toString();
            categoryCountMap.set(categoryId, (categoryCountMap.get(categoryId) || 0) + 1);
          });
          
          for (const [categoryId, count] of categoryCountMap.entries()) {
            await EquipmentCategory.updateOne(
              { _id: categoryId },
              { $inc: { storage_quantity: count } } // Cộng lại số lượng về kho
            );
          }
        }

        // đóng log cũ (chỉ log của phiếu này)
        await EquipmentLog.updateMany(
          {
            equipment_id: { $in: equipmentIds },
            end_time: null,
          },
          { $set: { end_time: now } }
        );

        // tạo log mới
        const logs = equipmentIds.map(equipmentId => ({
          equipment_id: equipmentId,
          room_id: null, // room_id = null khi về kho
          status: "in-stock",
          condition: "new",
          start_time: now,
          note: `Thiết bị quay về kho do phiếu ${ticket.type === 'uninstall' ? 'tháo dỡ' : 'lắp đặt'} ${ticket._id} quá hạn`,
          handled_by: ticket.employee_id || null,
        }));

        await EquipmentLog.insertMany(logs);
      }

      // soft delete detail
      await InstallDetail.deleteMany(
        { install_id: ticket._id }
      );
    }

    // thông báo phiếu quá hạn
    if (expiredTickets.length) {
      const managerIds = managers.map(m => m._id);
      
      for (const ticket of expiredTickets) {
        try {
          await pushNotificationToUsers(
            managerIds,
            "Phiếu lắp đặt thiết bị quá hạn",
            `Phiếu lắp đặt thiết bị ${ticket._id} đã quá hạn và bị hủy.`,
            "equipment",
            "EquipmentInstall",
            ticket._id,
            "unread"
          );
        } catch (error) {
          console.error(`Error sending notification for expired install ticket ${ticket._id}:`, error);
        }
      }
      console.log(`[CRON] done updating ${expiredTickets.length} expired install tickets.`)
    }

    // phiếu đến ngày: chuyển từ "pending" → "waiting_confirm" nếu chưa gán nhân viên
    // hoặc từ "pending" → "assigned" nếu đã gán nhân viên (nhưng logic này đã được xử lý ở createInstallTicket)
    const todayTickets = await EquipmentInstall.find({
      status: "pending",
      install_date: { $gte: start, $lte: end },
    });

    if (todayTickets.length) {
      await EquipmentInstall.updateMany(
        { _id: { $in: todayTickets.map(t => t._id) } },
        { status: "waiting_confirm" },
      );

      const managerIds = managers.map(m => m._id);
      
      for (const ticket of todayTickets) {
        try {
          await pushNotificationToUsers(
            managerIds,
            "Phiếu lắp đặt thiết bị đến ngày",
            `Phiếu lắp đặt thiết bị ${ticket._id} đã đến ngày lắp đặt.`,
            "equipment",
            "EquipmentInstall",
            ticket._id,
            "unread"
          );
        } catch (error) {
          console.error(`Error sending notification for today install ticket ${ticket._id}:`, error);
        }
      }

      console.log(`[CRON] done updating ${todayTickets.length} pending install tickets.`);
    }

    // await session.commitTransaction();
    // session.endSession();
  } catch (err) {
    // await session.abortTransaction();
    // session.endSession();
    console.error("[CRON] notifyInstallTickets error:", err);
  }
};

export const notifyGoodTickets = async () => {
    const start = new Date();
    start.setHours(0, 0, 0, 0);

    const end = new Date();
    end.setHours(23, 59, 59, 999);

    const managers = await User.find({ system_role: "manager" }).select("_id");
    
    // phiếu quá hạn nhập
    const expiredTickets = await GoodTicket.find({
      status: ["waiting_confirm","pending"],
      import_date: { $lt: start }
    });

    console.log("Expired good tickets found:", expiredTickets.length);
    if (expiredTickets.length > 0) {
        await GoodTicket.updateMany(
            { _id: { $in: expiredTickets.map(t => t._id) } },
            { status: "expired" }
        );

        const managerIds = managers.map(m => m._id);
        
        for (const ticket of expiredTickets) {
            try {
                await pushNotificationToUsers(
                    managerIds,
                    "Phiếu nhập sản phẩm quá hạn",
                    `Phiếu nhập sản phẩm ${ticket._id} đã quá ngày nhập và bị chuyển sang trạng thái quá hạn.`,
                    "system",
                    "Order",
                    ticket._id,
                    "unread"
                );
            } catch (error) {
                console.error(`Error sending notification for expired good ticket ${ticket._id}:`, error);
            }
        }

        console.log(`[CRON] good tickets expired: ${expiredTickets.length}`);
    }

    // phiếu đến ngày
    const todayTickets = await GoodTicket.find({
        status: "pending",
        import_date: { $gte: start, $lte: end }
    });

    if (todayTickets.length > 0) {
        await GoodTicket.updateMany(
            { _id: { $in: todayTickets.map(t => t._id) } },
            { status: "waiting_confirm" }
        );

        const managerIds = managers.map(m => m._id);
        
        for (const ticket of todayTickets) {
            try {
                await pushNotificationToUsers(
                    managerIds,
                    "Phiếu nhập sản phẩm đến ngày",
                    `Phiếu nhập sản phẩm ${ticket._id} đã đến ngày nhập kho.`,
                    "system",
                    "Order",
                    ticket._id,
                    "unread"
                );
            } catch (error) {
                console.error(`Error sending notification for today good ticket ${ticket._id}:`, error);
            }
        }

        console.log(`Updating ${todayTickets.length} pending good tickets successfully.`);
    }
};

export const notifyServiceUsageTickets = async () => {
  const now = new Date();

  const expiredDetails = await UsageDetail.find({
    status: "waiting_confirm",
    finish_at: { $ne: null, $lt: now },
  }).select("_id ticket_id");

  const expiredDetailIds = expiredDetails.map(d => d._id);
  const expiredTicketIds = [...new Set(expiredDetails.map(d => d.ticket_id.toString()))];

  if (expiredDetailIds.length) {
    await UsageDetail.updateMany(
      { _id: { $in: expiredDetailIds } },
      { $set: { status: "cancelled" } }
    );
  }

  const dueDetails = await UsageDetail.find({
    status: "pending",
    use_from: { $ne: null, $lte: now },
    $or: [{ end_at: null }, { end_at: { $gte: now } }],
  }).select("_id ticket_id");

  const dueDetailIds = dueDetails.map(d => d._id);
  const dueTicketIds = [...new Set(dueDetails.map(d => d.ticket_id.toString()))];

  if (dueDetailIds.length) {
    await UsageDetail.updateMany(
      { _id: { $in: dueDetailIds } },
      { $set: { status: "waiting_confirm" } }
    );
  }

  const users = await User.find({ system_role: { $ne: "manager" } }).select("_id");
  const userIds = users.map(u => u._id);

  for (const ticketId of expiredTicketIds) {
    try {
      await pushNotificationToUsers(
        userIds,
        "Dịch vụ quá hạn",
        `Phiếu sử dụng dịch vụ ${ticketId} đã quá hạn và bị hủy.`,
        "system",
        "Order",
        ticketId,
        "unread"
      );
    } catch (error) {
      console.error(`Error sending notification for expired service ticket ${ticketId}:`, error);
    }
  }

  for (const ticketId of dueTicketIds) {
    try {
      await pushNotificationToUsers(
        userIds,
        "Dịch vụ đến ngày sử dụng",
        `Phiếu sử dụng dịch vụ ${ticketId} đã đến ngày đăng ký.`,
        "system",
        "Order",
        ticketId,
        "unread"
      );
    } catch (error) {
      console.error(`Error sending notification for due service ticket ${ticketId}:`, error);
    }
  }

  const affectedTicketIds = [...new Set([...expiredTicketIds, ...dueTicketIds])];

  for (const ticketId of affectedTicketIds) {
    await recalcServiceUsageStatus(ticketId);
  }

  console.log(
    `[CRON] service usage waiting_confirm: ${dueDetailIds.length}, cancelled: ${expiredDetailIds.length}`
  );
};

export const cancelExpiredDepositBookings = async () => {
  const oneHourAgo = new Date(Date.now() - 60 * 60 * 1000);

  const expiredBookings = await Booking.find({
    status: "pending",
    created_at: { $lte: oneHourAgo },
  }).populate("customer_id", "user_id full_name");

  if (expiredBookings.length === 0) {
    return;
  }

  // Lấy danh sách admin (manager)
  const managers = await User.find({ 
    system_role: "manager",
    isBanned: { $ne: true }
  }).select("_id");
  const managerIds = managers.map(m => m._id);

  // Lấy danh sách lễ tân (receptionist)
  const receptionistEmployees = await Employee.find({
    position: "receptionist",
    status: "working"
  }).select("user_id");
  const receptionistUserIds = receptionistEmployees.map(e => e.user_id);
  
  // Lấy user_id của các lễ tân (loại bỏ null và duplicate)
  const validReceptionistUsers = await User.find({
    _id: { $in: receptionistUserIds },
    isBanned: { $ne: true }
  }).select("_id");
  const receptionistIds = validReceptionistUsers.map(u => u._id);

  for (const booking of expiredBookings) {
    booking.status = "cancelled";
    await booking.save();

    const bookingDetails = await BookingDetail.find({
      booking_id: booking._id,
    });

    // trả phòng
    const roomIds = bookingDetails.map(b => b.room_id);

    await Room.updateMany(
      { _id: { $in: roomIds } },
      { $set: { room_status: "available" } }
    );

    // Cập nhật RoomLog (bảng chính)
    await RoomLog.updateMany(
      {
        room_id: { $in: roomIds },
        status: "reserved",
        end_time: booking.expected_checkout,
      },
      { $set: { end_time: new Date() } }
    );

    // Cập nhật RoomStatusLog (bảng dự phòng)
    await RoomStatusLog.updateMany(
      {
        room_id: { $in: roomIds },
        status: "reserved",
        end_time: booking.expected_checkout,
      },
      { $set: { end_time: new Date() } }
    );

    // ghi log available mới
    const now = new Date();
    await RoomLog.insertMany(
      roomIds.map(roomId => ({
        room_id: roomId,
        status: "available",
        start_time: now,
        end_time: null,
        note: "Phòng bị hủy do quá hạn checkin và sẵn sàng trở lại",
      }))
    );

    await RoomLog.insertMany(
      roomIds.map(roomId => ({
        room_id: roomId,
        status: "available",
        start_time: now,
        end_time: null,
        note: "Phòng bị hủy do quá hạn checkin và sẵn sàng trở lại",
      }))
    );

    await BookingDetail.updateMany(
      { booking_id: booking._id },
      { $set: { status: "cancelled" } }
    );

    await BookingStatusLog.findOneAndUpdate(
      { booking_id: booking._id, end_time: null },
      { end_time: new Date() }
    );

    await BookingStatusLog.create({
      booking_id: booking._id,
      status: "cancelled",
      start_time: new Date(),
      note: "Booking bị hủy do quá 1 giờ chưa đặt cọc.",
    });

    // trừ điểm khách hàng
    await updateCustomerPoints({
      customer_id: booking.customer_id,
      points: -10,
      reason: "Trừ 10 điểm vì booking bị hủy do chưa đặt cọc."
    });

    // Gửi thông báo
    const customer = booking.customer_id;
    const bookingId = booking._id;
    const formattedCheckin = new Date(booking.expected_checkin).toLocaleString("vi-VN", {
      day: "2-digit",
      month: "2-digit",
      year: "numeric",
      hour: "2-digit",
      minute: "2-digit"
    });

    // Gửi thông báo cho khách hàng
    if (customer && customer.user_id) {
      try {
        await pushNotification(
          customer.user_id,
          "Booking đã bị hủy",
          `Booking #${bookingId.toString().slice(-6)} của bạn đã bị hủy do quá 1 giờ chưa đặt cọc. 
            Thời gian check-in dự kiến: ${formattedCheckin}`,
          "booking",
          "Booking",
          bookingId,
          "unread"
        );
      } catch (error) {
        console.error(`Error sending notification to customer for booking ${bookingId}:`, error);
      }
    }

    // Gửi thông báo cho admin
    if (managerIds.length > 0) {
      try {
        await pushNotificationToUsers(
          managerIds,
          "Booking đã bị hủy (chưa đặt cọc)",
          `Booking #${bookingId.toString().slice(-6)} của khách ${customer?.full_name || 'N/A'} đã bị hủy do 
            quá 1 giờ chưa đặt cọc. Thời gian check-in dự kiến: ${formattedCheckin}`,
          "booking",
          "Booking",
          bookingId,
          "unread"
        );
      } catch (error) {
        console.error(`Error sending notification to managers for booking ${bookingId}:`, error);
      }
    }

    // Gửi thông báo cho lễ tân
    if (receptionistIds.length > 0) {
      try {
        await pushNotificationToUsers(
          receptionistIds,
          "Booking đã bị hủy (chưa đặt cọc)",
          `Booking #${bookingId.toString().slice(-6)} của khách ${customer?.full_name || 'N/A'} đã bị hủy 
            do quá 1 giờ chưa đặt cọc. Thời gian check-in dự kiến: ${formattedCheckin}`,
          "booking",
          "Booking",
          bookingId,
          "unread"
        );
      } catch (error) {
        console.error(`Error sending notification to receptionists for booking ${bookingId}:`, error);
      }
    }
  }

  console.log(`[CRON] Cancelled ${expiredBookings.length} bookings due to expired deposit`);
};

export const cancelCheckinLateBookings = async () => {
  const oneHourAgo = new Date(Date.now() - 60 * 60 * 1000);

  const bookings = await Booking.find({
    status: "confirmed",
    expected_checkin: { $lte: oneHourAgo },
  }).populate("customer_id", "user_id full_name");

  if (bookings.length === 0) {
    return;
  }

  // Lấy danh sách admin (manager)
  const managers = await User.find({ 
    system_role: "manager",
    isBanned: { $ne: true }
  }).select("_id");
  const managerIds = managers.map(m => m._id);

  // Lấy danh sách lễ tân (receptionist)
  const receptionistEmployees = await Employee.find({
    position: "receptionist",
    status: "working"
  }).select("user_id");
  const receptionistUserIds = receptionistEmployees.map(e => e.user_id);
  
  // Lấy user_id của các lễ tân (loại bỏ null và duplicate)
  const validReceptionistUsers = await User.find({
    _id: { $in: receptionistUserIds },
    isBanned: { $ne: true }
  }).select("_id");
  const receptionistIds = validReceptionistUsers.map(u => u._id);

  for (const booking of bookings) {
    booking.status = "cancelled";
    booking.isLateCheckin = true;
    await booking.save();

    const bookingDetails = await BookingDetail.find({
      booking_id: booking._id,
    });

    // trả phòng
    const roomIds = bookingDetails.map(b => b.room_id);

    await Room.updateMany(
      { _id: { $in: roomIds } },
      { $set: { room_status: "available" } }
    );

    // Cập nhật RoomLog (bảng chính)
    await RoomLog.updateMany(
      {
        room_id: { $in: roomIds },
        status: "booked",
        end_time: booking.expected_checkout,
      },
      { $set: { end_time: new Date() } }
    );

    // Cập nhật RoomStatusLog (bảng dự phòng)
    await RoomStatusLog.updateMany(
      {
        room_id: { $in: roomIds },
        status: "booked",
        end_time: booking.expected_checkout,
      },
      { $set: { end_time: new Date() } }
    );

    // ghi log available mới
    const now = new Date();
    await RoomLog.insertMany(
      roomIds.map(roomId => ({
        room_id: roomId,
        status: "available",
        start_time: now,
        end_time: null,
        note: "Phòng bị hủy do quá hạn checkin và sẵn sàng trở lại",
      }))
    );

    await RoomLog.insertMany(
      roomIds.map(roomId => ({
        room_id: roomId,
        status: "available",
        start_time: now,
        end_time: null,
        note: "Phòng bị hủy do quá hạn checkin và sẵn sàng trở lại",
      }))
    );

    await BookingDetail.updateMany(
      { booking_id: booking._id },
      { $set: { status: "cancelled" } }
    );

    await BookingStatusLog.findOneAndUpdate(
      { booking_id: booking._id, end_time: null },
      { end_time: new Date() }
    );

    await BookingStatusLog.create({
      booking_id: booking._id,
      status: "cancelled",
      start_time: new Date(),
      note: "Tự động hủy: khách không đến sau 1 giờ kể từ thời điểm check-in dự kiến.",
    });

    // trừ điểm khách hàng
    await updateCustomerPoints({
      customer_id: booking.customer_id,
      points: -20,
      reason: "Trừ 20 điểm vì booking bị hủy do checkin trễ."
    });

    // Gửi thông báo
    const customer = booking.customer_id;
    const bookingId = booking._id;
    const formattedCheckin = new Date(booking.expected_checkin).toLocaleString("vi-VN", {
      day: "2-digit",
      month: "2-digit",
      year: "numeric",
      hour: "2-digit",
      minute: "2-digit"
    });

    // Gửi thông báo cho khách hàng
    if (customer && customer.user_id) {
      try {
        await pushNotification(
          customer.user_id,
          "Booking đã bị hủy (check-in trễ)",
          `Booking #${bookingId.toString().slice(-6)} của bạn đã bị hủy do không đến sau 1 giờ kể từ thời điểm check-in dự kiến (${formattedCheckin}).`,
          "booking",
          "Booking",
          bookingId,
          "unread"
        );
      } catch (error) {
        console.error(`Error sending notification to customer for booking ${bookingId}:`, error);
      }
    }

    // Gửi thông báo cho admin
    if (managerIds.length > 0) {
      try {
        await pushNotificationToUsers(
          managerIds,
          "Booking đã bị hủy (check-in trễ)",
          `Booking #${bookingId.toString().slice(-6)} của khách ${customer?.full_name || 'N/A'} đã bị hủy do không đến sau 1 giờ kể từ thời điểm check-in dự kiến (${formattedCheckin}).`,
          "booking",
          "Booking",
          bookingId,
          "unread"
        );
      } catch (error) {
        console.error(`Error sending notification to managers for booking ${bookingId}:`, error);
      }
    }

    // Gửi thông báo cho lễ tân
    if (receptionistIds.length > 0) {
      try {
        await pushNotificationToUsers(
          receptionistIds,
          "Booking đã bị hủy (check-in trễ)",
          `Booking #${bookingId.toString().slice(-6)} của khách ${customer?.full_name || 'N/A'} đã bị hủy do không đến sau 1 giờ kể từ thời điểm check-in dự kiến (${formattedCheckin}).`,
          "booking",
          "Booking",
          bookingId,
          "unread"
        );
      } catch (error) {
        console.error(`Error sending notification to receptionists for booking ${bookingId}:`, error);
      }
    }
  }

  console.log(`[CRON] Cancelled ${bookings.length} bookings due to late check-in`);
};

export const updateAllCustomerTiers = async () => {
  const customers = await Customer.find( {},
    "booking_count points loyalty"
  );

  const bulkOps = [];

  for (const customer of customers) {
    const newTier = calculateMembershipTier({
      booking_count: customer.booking_count || 0,
      points: customer.points || 0,
    });

    if (newTier !== customer.membership_tier) {
      bulkOps.push({
        updateOne: {
          filter: { _id: customer._id },
          update: {
            $set: {
              loyalty: newTier,
            },
          },
        },
      });
    }
  }

  if (bulkOps.length > 0) {
    await Customer.bulkWrite(bulkOps);
  }

  console.log(`[CRON] Updated ${bulkOps.length} customer tiers`);
};

// Gửi thông báo 2h trước giờ check-in dự kiến
export const notifyCheckinReminder = async () => {
  //console.log("[CRON] Running notifyCheckinReminder...");
  try {
    const now = new Date();
    const twoHoursFromNow = new Date(now.getTime() + 2 * 60 * 60 * 1000); // 2 giờ sau từ bây giờ
    
    // Tìm các booking có expected_checkin cách hiện tại đúng 2h (± 5 phút để đảm bảo không bỏ sót khi cron chạy mỗi 5 phút)
    const bookings = await Booking.find({
      status: { $in: ["pending", "confirmed"] },
      expected_checkin: {
        $gte: new Date(twoHoursFromNow.getTime() - 5 * 60 * 1000), // Trừ 5 phút để có độ lệch
        $lte: new Date(twoHoursFromNow.getTime() + 5 * 60 * 1000)  // Cộng 5 phút để có độ lệch
      }
    }).populate("customer_id", "user_id full_name");

    //console.log(`[CRON] Found ${bookings.length} bookings needing check-in reminders.`);
    
    if (bookings.length === 0) {
      return;
    }

    // Lấy danh sách admin (manager)
    const managers = await User.find({ 
      system_role: "manager",
      isBanned: { $ne: true }
    }).select("_id");
    const managerIds = managers.map(m => m._id);

    //console.log("Manager for notifications:", managers);
    // Lấy danh sách lễ tân (receptionist)
    const receptionistEmployees = await Employee.find({
      position: "receptionist",
      status: "working"
    }).select("user_id");
    const receptionistUserIds = receptionistEmployees.map(e => e.user_id);
    
    // Lấy user_id của các lễ tân (loại bỏ null và duplicate)
    const validReceptionistUsers = await User.find({
      _id: { $in: receptionistUserIds },
      isBanned: { $ne: true }
    }).select("_id");
    const receptionistIds = validReceptionistUsers.map(u => u._id);

    // Gửi thông báo cho từng booking
    for (const booking of bookings) {
      const customer = booking.customer_id;
      if (!customer || !customer.user_id) continue;

      const customerUserId = customer.user_id;
      const bookingId = booking._id;
      const checkinTime = new Date(booking.expected_checkin);
      const formattedTime = checkinTime.toLocaleString("vi-VN", {
        day: "2-digit",
        month: "2-digit",
        year: "numeric",
        hour: "2-digit",
        minute: "2-digit"
      });

      // Gửi thông báo cho khách hàng
      try {
        await pushNotification(
          customerUserId,
          "Nhắc nhở check-in",
          `Bạn có booking #${bookingId.toString().slice(-6)} sẽ check-in vào ${formattedTime}. Còn khoảng 2 giờ nữa!`,
          "booking",
          "Booking",
          bookingId,
          "unread"
        );
      } catch (error) {
        console.error(`Error sending notification to customer for booking ${bookingId}:`, error);
      }

      // Gửi thông báo cho admin
      if (managerIds.length > 0) {
        try {
          await pushNotificationToUsers(
            managerIds,
            "Nhắc nhở check-in",
            `Booking #${bookingId.toString().slice(-6)} của khách ${customer.full_name || 'N/A'} sẽ check-in vào ${formattedTime}. Còn khoảng 2 giờ nữa!`,
            "booking",
            "Booking",
            bookingId,
            "unread"
          );
        } catch (error) {
          console.error(`Error sending notification to managers for booking ${bookingId}:`, error);
        }
      }

      // Gửi thông báo cho lễ tân
      if (receptionistIds.length > 0) {
        try {
          await pushNotificationToUsers(
            receptionistIds,
            "Nhắc nhở check-in",
            `Booking #${bookingId.toString().slice(-6)} của khách ${customer.full_name || 'N/A'} sẽ check-in vào ${formattedTime}. Còn khoảng 2 giờ nữa!`,
            "booking",
            "Booking",
            bookingId,
            "unread"
          );
        } catch (error) {
          console.error(`Error sending notification to receptionists for booking ${bookingId}:`, error);
        }
      }
    }

    console.log(`[CRON] Sent check-in reminders for ${bookings.length} bookings`);
  } catch (error) {
    console.error("[CRON] notifyCheckinReminder error:", error);
  }
};

// Gửi thông báo 1 giờ, 30 phút và 5 phút trước giờ check-out
export const notifyCheckoutReminder = async () => {
  try {
    const now = new Date();
    
    // Tính toán các mốc thời gian: 1 giờ, 30 phút và 5 phút trước check-out
    const oneHourFromNow = new Date(now.getTime() + 60 * 60 * 1000); // 1 giờ sau
    const thirtyMinutesFromNow = new Date(now.getTime() + 30 * 60 * 1000); // 30 phút sau
    const fiveMinutesFromNow = new Date(now.getTime() + 5 * 60 * 1000); // 5 phút sau
    
    // Tìm các booking đang checked-in (status = "in_progress") có expected_checkout gần với các mốc thời gian trên
    // Sử dụng ± 5 phút để đảm bảo không bỏ sót khi cron chạy mỗi 5 phút
    const timeWindow = 5 * 60 * 1000; // 5 phút
    
    const bookings = await Booking.find({
      status: "in_progress", // Chỉ gửi thông báo cho booking đã checked-in
      expected_checkout: {
        $gte: new Date(now.getTime() - timeWindow), // Không quá khứ
        $lte: new Date(now.getTime() + 65 * 60 * 1000) // Tối đa 65 phút trong tương lai (để bao gồm cả 1 giờ + 5 phút)
      }
    }).populate("customer_id", "user_id full_name");

    if (bookings.length === 0) {
      return;
    }

    // Lấy danh sách admin (manager)
    const managers = await User.find({ 
      system_role: "manager",
      isBanned: { $ne: true }
    }).select("_id");
    const managerIds = managers.map(m => m._id);

    // Lấy danh sách lễ tân (receptionist)
    const receptionistEmployees = await Employee.find({
      position: "receptionist",
      status: "working"
    }).select("user_id");
    const receptionistUserIds = receptionistEmployees.map(e => e.user_id);
    
    // Lấy user_id của các lễ tân (loại bỏ null và duplicate)
    const validReceptionistUsers = await User.find({
      _id: { $in: receptionistUserIds },
      isBanned: { $ne: true }
    }).select("_id");
    const receptionistIds = validReceptionistUsers.map(u => u._id);

    // Gửi thông báo cho từng booking
    for (const booking of bookings) {
      const customer = booking.customer_id;
      if (!customer || !customer.user_id) continue;

      const customerUserId = customer.user_id;
      const bookingId = booking._id;
      const checkoutTime = new Date(booking.expected_checkout);
      const formattedTime = checkoutTime.toLocaleString("vi-VN", {
        day: "2-digit",
        month: "2-digit",
        year: "numeric",
        hour: "2-digit",
        minute: "2-digit"
      });

      // Tính thời gian còn lại đến check-out
      const timeUntilCheckout = checkoutTime.getTime() - now.getTime();
      const hoursUntilCheckout = Math.floor(timeUntilCheckout / (60 * 60 * 1000));
      const minutesUntilCheckout = Math.floor((timeUntilCheckout % (60 * 60 * 1000)) / (60 * 1000));

      // Xác định mốc thời gian nào đang được nhắc nhở
      let timeRemainingText = "";
      let title = "";
      
      if (timeUntilCheckout >= 55 * 60 * 1000 && timeUntilCheckout <= 65 * 60 * 1000) {
        // 1 giờ trước (± 5 phút)
        timeRemainingText = "1 giờ";
        title = "Nhắc nhở check-out (1 giờ)";
      } else if (timeUntilCheckout >= 25 * 60 * 1000 && timeUntilCheckout <= 35 * 60 * 1000) {
        // 30 phút trước (± 5 phút)
        timeRemainingText = "30 phút";
        title = "Nhắc nhở check-out (30 phút)";
      } else if (timeUntilCheckout >= 0 && timeUntilCheckout <= 10 * 60 * 1000) {
        // 5 phút trước (± 5 phút)
        timeRemainingText = "5 phút";
        title = "Nhắc nhở check-out (5 phút)";
      } else {
        // Không nằm trong các mốc thời gian cần nhắc nhở, bỏ qua
        continue;
      }

      // Gửi thông báo cho khách hàng
      try {
        await pushNotification(
          customerUserId,
          title,
          `Bạn có booking #${bookingId.toString().slice(-6)} sẽ check-out vào ${formattedTime}. Còn khoảng ${timeRemainingText} nữa!`,
          "booking",
          "Booking",
          bookingId,
          "unread"
        );
      } catch (error) {
        console.error(`Error sending notification to customer for booking ${bookingId}:`, error);
      }

      // Gửi thông báo cho admin
      if (managerIds.length > 0) {
        try {
          await pushNotificationToUsers(
            managerIds,
            title,
            `Booking #${bookingId.toString().slice(-6)} của khách ${customer.full_name || 'N/A'} sẽ check-out vào ${formattedTime}. Còn khoảng ${timeRemainingText} nữa!`,
            "booking",
            "Booking",
            bookingId,
            "unread"
          );
        } catch (error) {
          console.error(`Error sending notification to managers for booking ${bookingId}:`, error);
        }
      }

      // Gửi thông báo cho lễ tân
      if (receptionistIds.length > 0) {
        try {
          await pushNotificationToUsers(
            receptionistIds,
            title,
            `Booking #${bookingId.toString().slice(-6)} của khách ${customer.full_name || 'N/A'} sẽ check-out vào ${formattedTime}. Còn khoảng ${timeRemainingText} nữa!`,
            "booking",
            "Booking",
            bookingId,
            "unread"
          );
        } catch (error) {
          console.error(`Error sending notification to receptionists for booking ${bookingId}:`, error);
        }
      }
    }

    console.log(`[CRON] Sent check-out reminders`);
  } catch (error) {
    console.error("[CRON] notifyCheckoutReminder error:", error);
  }
};

// Gửi thông báo nhắc nhở hạn thanh toán cọc (30, 20, 10, 5 phút trước)
export const notifyDepositDeadlineReminder = async () => {
  try {
    const now = new Date();
    
    // Tính toán các mốc thời gian: 30, 20, 10 và 5 phút trước hạn thanh toán cọc
    // Hạn thanh toán cọc = created_at + 1 giờ (theo logic cancelExpiredDepositBookings)
    const thirtyMinutesFromNow = new Date(now.getTime() + 30 * 60 * 1000);
    const twentyMinutesFromNow = new Date(now.getTime() + 20 * 60 * 1000);
    const tenMinutesFromNow = new Date(now.getTime() + 10 * 60 * 1000);
    const fiveMinutesFromNow = new Date(now.getTime() + 5 * 60 * 1000);
    
    // Tìm các booking pending có hạn thanh toán cọc gần với các mốc thời gian trên
    // Sử dụng ± 5 phút để đảm bảo không bỏ sót khi cron chạy mỗi 5 phút
    const timeWindow = 5 * 60 * 1000; // 5 phút
    
    // Hạn thanh toán = created_at + 1 giờ
    const bookings = await Booking.find({
      status: "pending", // Chỉ booking đặt trước chưa cọc
      created_at: {
        $gte: new Date(now.getTime() - 65 * 60 * 1000), // Tối đa 65 phút trước (để bao gồm cả 30 phút + 35 phút)
        $lte: new Date(now.getTime() + 5 * 60 * 1000) // Tối đa 5 phút trong tương lai
      }
    }).populate("customer_id", "user_id full_name");

    if (bookings.length === 0) {
      return;
    }

    // Lấy danh sách lễ tân (receptionist)
    const receptionistEmployees = await Employee.find({
      position: "receptionist",
      status: "working"
    }).select("user_id");
    const receptionistUserIds = receptionistEmployees.map(e => e.user_id);
    
    // Lấy user_id của các lễ tân (loại bỏ null và duplicate)
    const validReceptionistUsers = await User.find({
      _id: { $in: receptionistUserIds },
      isBanned: { $ne: true }
    }).select("_id");
    const receptionistIds = validReceptionistUsers.map(u => u._id);

    // Gửi thông báo cho từng booking
    for (const booking of bookings) {
      const customer = booking.customer_id;
      if (!customer || !customer.user_id) continue;

      const customerUserId = customer.user_id;
      const bookingId = booking._id;
      
      // Tính hạn thanh toán cọc (created_at + 1 giờ)
      const depositDeadline = new Date(booking.created_at.getTime() + 60 * 60 * 1000);
      const formattedDeadline = depositDeadline.toLocaleString("vi-VN", {
        day: "2-digit",
        month: "2-digit",
        year: "numeric",
        hour: "2-digit",
        minute: "2-digit"
      });

      // Tính thời gian còn lại đến hạn thanh toán
      const timeUntilDeadline = depositDeadline.getTime() - now.getTime();
      
      // Xác định mốc thời gian nào đang được nhắc nhở
      let timeRemainingText = "";
      let title = "";
      
      if (timeUntilDeadline >= 25 * 60 * 1000 && timeUntilDeadline <= 35 * 60 * 1000) {
        // 30 phút trước (± 5 phút)
        timeRemainingText = "30 phút";
        title = "Nhắc nhở thanh toán cọc (30 phút)";
      } else if (timeUntilDeadline >= 15 * 60 * 1000 && timeUntilDeadline <= 25 * 60 * 1000) {
        // 20 phút trước (± 5 phút)
        timeRemainingText = "20 phút";
        title = "Nhắc nhở thanh toán cọc (20 phút)";
      } else if (timeUntilDeadline >= 5 * 60 * 1000 && timeUntilDeadline <= 15 * 60 * 1000) {
        // 10 phút trước (± 5 phút)
        timeRemainingText = "10 phút";
        title = "Nhắc nhở thanh toán cọc (10 phút)";
      } else if (timeUntilDeadline >= 0 && timeUntilDeadline <= 10 * 60 * 1000) {
        // 5 phút trước (± 5 phút)
        timeRemainingText = "5 phút";
        title = "Nhắc nhở thanh toán cọc (5 phút)";
      } else {
        // Không nằm trong các mốc thời gian cần nhắc nhở, bỏ qua
        continue;
      }

      // Gửi thông báo cho khách hàng
      try {
        await pushNotification(
          customerUserId,
          title,
          `Booking #${bookingId.toString().slice(-6)} của bạn cần thanh toán cọc trước ${formattedDeadline}. Còn khoảng ${timeRemainingText} nữa!`,
          "booking",
          "Booking",
          bookingId,
          "unread"
        );
      } catch (error) {
        console.error(`Error sending notification to customer for booking ${bookingId}:`, error);
      }

      // Gửi thông báo cho lễ tân
      if (receptionistIds.length > 0) {
        try {
          await pushNotificationToUsers(
            receptionistIds,
            title,
            `Booking #${bookingId.toString().slice(-6)} của khách ${customer.full_name || 'N/A'} cần thanh toán cọc trước ${formattedDeadline}. Còn khoảng ${timeRemainingText} nữa!`,
            "booking",
            "Booking",
            bookingId,
            "unread"
          );
        } catch (error) {
          console.error(`Error sending notification to receptionists for booking ${bookingId}:`, error);
        }
      }
    }

    console.log(`[CRON] Sent deposit deadline reminders`);
  } catch (error) {
    console.error("[CRON] notifyDepositDeadlineReminder error:", error);
  }
};

// Gửi thông báo nhắc nhở giờ check-in (30, 20, 10, 5 phút trước)
export const notifyCheckinTimeReminder = async () => {
  try {
    const now = new Date();
    
    // Tìm các booking đã confirmed có expected_checkin gần với các mốc thời gian: 30, 20, 10, 5 phút
    // Sử dụng ± 5 phút để đảm bảo không bỏ sót khi cron chạy mỗi 5 phút
    const timeWindow = 5 * 60 * 1000; // 5 phút
    
    const bookings = await Booking.find({
      status: "confirmed", // Booking đã cọc, sắp đến giờ check-in
      expected_checkin: {
        $gte: new Date(now.getTime() - timeWindow), // Không quá khứ
        $lte: new Date(now.getTime() + 35 * 60 * 1000) // Tối đa 35 phút trong tương lai (để bao gồm cả 30 phút + 5 phút)
      }
    }).populate("customer_id", "user_id full_name");

    if (bookings.length === 0) {
      return;
    }

    // Lấy danh sách lễ tân (receptionist)
    const receptionistEmployees = await Employee.find({
      position: "receptionist",
      status: "working"
    }).select("user_id");
    const receptionistUserIds = receptionistEmployees.map(e => e.user_id);
    
    // Lấy user_id của các lễ tân (loại bỏ null và duplicate)
    const validReceptionistUsers = await User.find({
      _id: { $in: receptionistUserIds },
      isBanned: { $ne: true }
    }).select("_id");
    const receptionistIds = validReceptionistUsers.map(u => u._id);

    // Gửi thông báo cho từng booking
    for (const booking of bookings) {
      const customer = booking.customer_id;
      if (!customer || !customer.user_id) continue;

      const customerUserId = customer.user_id;
      const bookingId = booking._id;
      const checkinTime = new Date(booking.expected_checkin);
      const formattedTime = checkinTime.toLocaleString("vi-VN", {
        day: "2-digit",
        month: "2-digit",
        year: "numeric",
        hour: "2-digit",
        minute: "2-digit"
      });

      // Tính thời gian còn lại đến check-in
      const timeUntilCheckin = checkinTime.getTime() - now.getTime();

      // Xác định mốc thời gian nào đang được nhắc nhở
      let timeRemainingText = "";
      let title = "";
      
      if (timeUntilCheckin >= 25 * 60 * 1000 && timeUntilCheckin <= 35 * 60 * 1000) {
        // 30 phút trước (± 5 phút)
        timeRemainingText = "30 phút";
        title = "Nhắc nhở check-in (30 phút)";
      } else if (timeUntilCheckin >= 15 * 60 * 1000 && timeUntilCheckin <= 25 * 60 * 1000) {
        // 20 phút trước (± 5 phút)
        timeRemainingText = "20 phút";
        title = "Nhắc nhở check-in (20 phút)";
      } else if (timeUntilCheckin >= 5 * 60 * 1000 && timeUntilCheckin <= 15 * 60 * 1000) {
        // 10 phút trước (± 5 phút)
        timeRemainingText = "10 phút";
        title = "Nhắc nhở check-in (10 phút)";
      } else if (timeUntilCheckin >= 0 && timeUntilCheckin <= 10 * 60 * 1000) {
        // 5 phút trước (± 5 phút)
        timeRemainingText = "5 phút";
        title = "Nhắc nhở check-in (5 phút)";
      } else {
        // Không nằm trong các mốc thời gian cần nhắc nhở, bỏ qua
        continue;
      }

      // Gửi thông báo cho khách hàng
      try {
        await pushNotification(
          customerUserId,
          title,
          `Booking #${bookingId.toString().slice(-6)} của bạn sẽ check-in vào ${formattedTime}. Còn khoảng ${timeRemainingText} nữa!`,
          "booking",
          "Booking",
          bookingId,
          "unread"
        );
      } catch (error) {
        console.error(`Error sending notification to customer for booking ${bookingId}:`, error);
      }

      // Gửi thông báo cho lễ tân
      if (receptionistIds.length > 0) {
        try {
          await pushNotificationToUsers(
            receptionistIds,
            title,
            `Booking #${bookingId.toString().slice(-6)} của khách ${customer.full_name || 'N/A'} sẽ check-in vào ${formattedTime}. Còn khoảng ${timeRemainingText} nữa!`,
            "booking",
            "Booking",
            bookingId,
            "unread"
          );
        } catch (error) {
          console.error(`Error sending notification to receptionists for booking ${bookingId}:`, error);
        }
      }
    }

    console.log(`[CRON] Sent check-in time reminders`);
  } catch (error) {
    console.error("[CRON] notifyCheckinTimeReminder error:", error);
  }
};

// Sync room.room_status từ log hiện tại (Option 1)
export const syncRoomStatusFromLogs = async () => {
  try {
    const now = new Date();
    // Lấy tất cả các phòng
    const rooms = await Room.find({});
    let updatedCount = 0;
    
    for (const room of rooms) {
      // Tìm log hiện tại (start_time <= now và (end_time >= now hoặc end_time null))
      const currentLog = await RoomLog.findOne({
        room_id: room._id,
        start_time: { $lte: now },
        $or: [
          { end_time: { $gte: now } },
          { end_time: null }
        ]
      }).sort({ start_time: -1 }); // Lấy log mới nhất
      
      // Nếu có log hiện tại và status khác với room.room_status, thì update
      if (currentLog && currentLog.status !== room.room_status) {
        await Room.findByIdAndUpdate(room._id, {
          room_status: currentLog.status
        });
        updatedCount++;
      }
      // Nếu không có log hiện tại và room.room_status là "reserved" hoặc "booked"
      // (không phải "cleaning", "maintenance", "available", "new")
      else if (!currentLog && ["reserved", "booked"].includes(room.room_status)) {
        // Kiểm tra xem có booking nào đang active không
        const activeBooking = await BookingDetail.findOne({
          room_id: room._id,
          status: { $in: ["reserved", "confirmed", "checked_in"] },
          expected_checkout: { $gt: now }
        });
        
        // Nếu không có booking active, chuyển về available
        if (!activeBooking) {
          await Room.findByIdAndUpdate(room._id, {
            room_status: "available"
          });
          updatedCount++;
        }
      }
    }
    
    if (updatedCount > 0) {
      console.log(`[CRON] Synced room status for ${updatedCount} rooms`);
    }
  } catch (error) {
    console.error("[CRON] syncRoomStatusFromLogs error:", error);
  }
};

/**
 * Sửa lại room_log dựa trên booking đã hủy/hoàn tất
 * Tìm các booking đã hủy, kiểm tra xem các phòng của booking đó có booking nào khác đang active không
 * Nếu không có và log mới nhất của phòng vẫn thuộc booking cũ, thì tạo log available mới
 */
export const fixRoomLogsFromCancelledBookings = async () => {
  try {
    const now = new Date();
    
    // Tìm tất cả booking đã bị hủy hoặc đã hoàn tất
    const cancelledBookings = await Booking.find({
      status: { $in: ["cancelled", "expired", "completed"] }
    }).select("_id status");

    if (cancelledBookings.length === 0) {
      console.log("[CRON] fixRoomLogsFromCancelledBookings: Không có booking nào đã hủy/hoàn tất");
      return;
    }

    const cancelledBookingIds = cancelledBookings.map(b => b._id.toString());
    let fixedCount = 0;

    // Với mỗi booking đã hủy, kiểm tra các phòng của nó
    for (const booking of cancelledBookings) {
      // Lấy danh sách phòng thuộc booking này
      const bookingDetails = await BookingDetail.find({
        booking_id: booking._id
      }).select("room_id");

      if (bookingDetails.length === 0) continue;

      const roomIds = bookingDetails.map(bd => {
        const roomId = bd.room_id instanceof mongoose.Types.ObjectId 
          ? bd.room_id 
          : (bd.room_id._id || bd.room_id);
        return roomId instanceof mongoose.Types.ObjectId ? roomId : mongoose.Types.ObjectId.createFromHexString(roomId);
      });

      // Với mỗi phòng, kiểm tra:
      for (const roomId of roomIds) {
        // 1. Kiểm tra xem có booking nào khác đang active (pending, confirmed, in_progress) chứa phòng này không
        const activeBookingDetails = await BookingDetail.find({
          room_id: roomId,
          booking_id: { $ne: booking._id },
          status: { $in: ["reserved", "confirmed", "checked_in"] }
        }).populate("booking_id", "status").select("booking_id");

        // Kiểm tra xem các booking này có đang active không
        let hasActiveBooking = false;
        for (const detail of activeBookingDetails) {
          const detailBooking = detail.booking_id;
          if (detailBooking && ["pending", "confirmed", "in_progress"].includes(detailBooking.status)) {
            hasActiveBooking = true;
            break;
          }
        }

        // Nếu có booking active chứa phòng này, bỏ qua
        if (hasActiveBooking) {
          continue;
        }

        // 2. Lấy log mới nhất của phòng (từ RoomLog - bảng chính) mà chưa có end_time hoặc end_time > now
        const latestLog = await RoomLog.findOne({
          room_id: roomId,
          $or: [
            { end_time: null },
            { end_time: { $gte: now } }
          ]
        }).sort({ start_time: -1 });

        // Nếu không có log active hoặc log đã là "available", bỏ qua
        if (!latestLog || latestLog.status === "available") {
          continue;
        }

        // 3. Kiểm tra xem log mới nhất có thuộc về booking đã hủy/hoàn tất này không
        let logBelongsToCancelledBooking = false;
        
        if (latestLog.booking_id) {
          const logBookingId = latestLog.booking_id.toString();
          // Kiểm tra xem booking_id của log có trong danh sách booking đã hủy không
          if (cancelledBookingIds.includes(logBookingId)) {
            logBelongsToCancelledBooking = true;
          } else {
            // Nếu không, kiểm tra xem booking đó có đang active không
            const logBooking = await Booking.findById(latestLog.booking_id).select("status");
            if (!logBooking || !["pending", "confirmed", "in_progress"].includes(logBooking.status)) {
              // Booking không tồn tại hoặc không active, coi như thuộc booking cũ
              logBelongsToCancelledBooking = true;
            }
          }
        } else {
          // Log không có booking_id, kiểm tra xem có phải log từ booking cũ không
          // Nếu status không phải available và không có booking_id, có thể là log cũ cần sửa
          if (latestLog.status !== "available") {
            // Kiểm tra xem có booking nào đang active cho phòng này không (đã check ở trên)
            // Nếu không có, coi như log này thuộc booking cũ
            logBelongsToCancelledBooking = true;
          }
        }

        // 4. Nếu log mới nhất thuộc booking đã hủy/hoàn tất và chưa có end_time, thì sửa log
        if (logBelongsToCancelledBooking && !latestLog.end_time) {
          // Cắt log cũ - RoomLog (bảng chính)
          await RoomLog.updateMany(
            {
              room_id: roomId,
              _id: latestLog._id
            },
            { $set: { end_time: now } }
          );

          // Cắt log cũ - RoomStatusLog (bảng dự phòng) - tìm log tương ứng
          await RoomStatusLog.updateMany(
            {
              room_id: roomId,
              status: latestLog.status,
              start_time: latestLog.start_time,
              end_time: null
            },
            { $set: { end_time: now } }
          );

          // Tạo log available mới - RoomLog (bảng chính)
          await RoomLog.create({
            room_id: roomId,
            status: "available",
            start_time: now,
            end_time: null,
            note: `Tự động sửa log: Phòng được giải phóng sau khi booking ${booking._id} bị ${booking.status}`,
            handled_by: null
          });

          // Tạo log available mới - RoomStatusLog (bảng dự phòng)
          await RoomStatusLog.create({
            room_id: roomId,
            status: "available",
            start_time: now,
            end_time: null,
            note: `Tự động sửa log: Phòng được giải phóng sau khi booking ${booking._id} bị ${booking.status}`,
            handled_by: null
          });

          fixedCount++;
          console.log(`[CRON] Đã sửa log cho phòng ${roomId} từ booking ${booking._id} (${booking.status})`);
        }
      }
    }

    if (fixedCount > 0) {
      console.log(`[CRON] fixRoomLogsFromCancelledBookings: Đã sửa ${fixedCount} phòng`);
    } else {
      console.log(`[CRON] fixRoomLogsFromCancelledBookings: Không có phòng nào cần sửa`);
    }
  } catch (error) {
    console.error("[CRON] fixRoomLogsFromCancelledBookings error:", error);
  }
};
