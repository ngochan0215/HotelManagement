import { EquipmentTicket, Notification, User, EquipmentInstall, Customer,
    GoodTicket, RoomLog, UsageDetail, Booking, BookingDetail, 
    BookingStatusLog, Room, RoomStatusLog, Equipment, EquipmentLog, InstallDetail, Employee
} from "../models/index.js";
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
      status: "waiting_confirm",
      install_date: { $lt: start },
    });

    for (const ticket of expiredTickets) {
      ticket.status = "expired";
      await ticket.save();

      // lấy chi tiết
      const details = await InstallDetail.find({
        install_id: ticket._id,
      });

      const equipmentIds = details.map(d => d.equipment_id);

      if (equipmentIds.length) {
        // update equipment về trạng thái gốc
        await Equipment.updateMany(
          { _id: { $in: equipmentIds } },
          { status: "in-stock", condition: "new" },
          //{ session }
        );

        // đóng log cũ (chỉ log của phiếu này)
        await EquipmentLog.updateMany(
          {
            equipment_id: { $in: equipmentIds },
            end_time: null,
            //note: { $regex: ticket._id.toString() },
          },
          { $set: { end_time: now } }
        );

        // tạo log mới
        const logs = equipmentIds.map(equipmentId => ({
          equipment_id: equipmentId,
          room_id: ticket.room_id,
          status: "in-stock",
          condition: "new",
          start_time: now,
          note: `Thiết bị quay về kho do phiếu lắp đặt ${ticket._id} quá hạn`,
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
            "Phiếu lắp đặt quá hạn",
            `Phiếu lắp đặt ${ticket._id} đã quá hạn và bị hủy.`,
            "system",
            "Order",
            ticket._id,
            "unread"
          );
        } catch (error) {
          console.error(`Error sending notification for expired install ticket ${ticket._id}:`, error);
        }
      }
      console.log("[CRON] done updating expired install tickets.")
    }

    // phiếu đến ngày
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
            "Phiếu lắp đặt đến ngày",
            `Phiếu lắp đặt ${ticket._id} đã đến ngày lắp đặt.`,
            "system",
            "Order",
            ticket._id,
            "unread"
          );
        } catch (error) {
          console.error(`Error sending notification for today install ticket ${ticket._id}:`, error);
        }
      }
      console.log("[CRON] done updating pending install tickets.");
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
  });

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

    await RoomStatusLog.updateMany(
      {
        room_id: { $in: roomIds },
        status: "reserved",
        end_time: booking.expected_checkout,
      },
      { $set: { end_time: new Date() } }
    );

    //(BẢNG MỚI)
    await RoomLog.updateMany(
      {
        room_id: { $in: roomIds },
        status: "reserved",
        end_time: booking.expected_checkout,
      },
      { $set: { end_time: new Date() } }
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
  }
};

export const cancelCheckinLateBookings = async () => {
  const oneHourAgo = new Date(Date.now() - 60 * 60 * 1000);

  const bookings = await Booking.find({
    status: "confirmed",
    expected_checkin: { $lte: oneHourAgo },
  });

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

    await RoomStatusLog.updateMany(
      {
        room_id: { $in: roomIds },
        status: "booked",
        end_time: booking.expected_checkout,
      },
      { $set: { end_time: new Date() } }
    );

    // BẢNG MỚI
    await RoomLog.updateMany(
      {
        room_id: { $in: roomIds },
        status: "booked",
        end_time: booking.expected_checkout,
      },
      { $set: { end_time: new Date() } }
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
  }
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
  console.log("[CRON] Running notifyCheckinReminder...");
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

    console.log(`[CRON] Found ${bookings.length} bookings needing check-in reminders.`);
    
    if (bookings.length === 0) {
      return;
    }

    // Lấy danh sách admin (manager)
    const managers = await User.find({ 
      system_role: "manager",
      isBanned: { $ne: true }
    }).select("_id");
    const managerIds = managers.map(m => m._id);

    
    console.log("Manager for notifications:", managers);
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
