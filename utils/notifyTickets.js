import { EquipmentTicket, Notification, User, EquipmentInstall, 
    GoodTicket, ServiceUsage, UsageDetail } from "../models/index.js";
import { recalcServiceUsageStatus } from "../controllers/serviceController.js";

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

        const expiredNotifications = expiredTickets.flatMap(ticket =>
            managers.map(manager => ({
                user_id: manager._id,
                title: "Phiếu nhập thiết bị quá hạn",
                content: `Phiếu nhập ${ticket._id} đã quá ngày nhập kho và bị chuyển sang trạng thái quá hạn.`,
                type: "system",
            }))
        );

        await Notification.insertMany(expiredNotifications);
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

        const todayNotifications = todayTickets.flatMap(ticket =>
                managers.map(manager => ({
                    user_id: manager._id,
                    title: "Phiếu nhập thiết bị đến ngày",
                    content: `Phiếu nhập ${ticket._id} đã đến ngày nhập kho.`,
                    type: "system",
                }))
            );

        await Notification.insertMany(todayNotifications);
    }
};

export const notifyInstallTickets = async () => {
    const start = new Date();
    start.setHours(0, 0, 0, 0);

    const end = new Date();
    end.setHours(23, 59, 59, 999);

    const managers = await User.find({ system_role: "manager" }).select("_id");

    // phiếu quá hạn nhập
    const expiredTickets = await EquipmentInstall.find({
        status: "waiting_confirm",
        install_date: { $lt: start }
    });

    if (expiredTickets.length > 0) {
        await EquipmentInstall.updateMany(
            { _id: { $in: expiredTickets.map(t => t._id) } },
            { status: "expired" }
        );

        const expiredNotifications = expiredTickets.flatMap(ticket =>
            managers.map(manager => ({
                user_id: manager._id,
                title: "Phiếu lắp đặt thiết bị quá hạn",
                content: `Phiếu lắp đặt ${ticket._id} đã quá ngày lắp đặt và bị chuyển sang trạng thái quá hạn.`,
                type: "system",
            }))
        );

        await Notification.insertMany(expiredNotifications);
    }

    // phiếu đến ngày
    const todayTickets = await EquipmentInstall.find({
        status: "pending",
        install_date: { $gte: start, $lte: end }
    });

    if (todayTickets.length > 0) {
        await EquipmentTicket.updateMany(
            { _id: { $in: todayTickets.map(t => t._id) } },
            { status: "waiting_confirm" }
        );

        const todayNotifications = todayTickets.flatMap(ticket =>
                managers.map(manager => ({
                    user_id: manager._id,
                    title: "Phiếu lắp đặt thiết bị đến ngày",
                    content: `Phiếu lắp đặt ${ticket._id} đã đến ngày lắp đặt.`,
                    type: "system",
                }))
            );

        await Notification.insertMany(todayNotifications);
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
        status: "waiting_confirm",
        import_date: { $lt: start }
    });

    if (expiredTickets.length > 0) {
        await GoodTicket.updateMany(
            { _id: { $in: expiredTickets.map(t => t._id) } },
            { status: "expired" }
        );

        const expiredNotifications = expiredTickets.flatMap(ticket =>
            managers.map(manager => ({
                user_id: manager._id,
                title: "Phiếu nhập sản phẩm quá hạn",
                content: `Phiếu nhập sản phẩm ${ticket._id} đã quá ngày nhập và bị chuyển sang trạng thái quá hạn.`,
                type: "system",
            }))
        );

        await Notification.insertMany(expiredNotifications);
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

        const todayNotifications = todayTickets.flatMap(ticket =>
                managers.map(manager => ({
                    user_id: manager._id,
                    title: "Phiếu nhập sản phẩm đến ngày",
                    content: `Phiếu nhập sản phẩm ${ticket._id} đã đến ngày nhập kho.`,
                    type: "system",
                }))
            );

        await Notification.insertMany(todayNotifications);
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
  const notifications = [];

  for (const ticketId of expiredTicketIds) {
    for (const user of users) {
      notifications.push({
        user_id: user._id,
        title: "Dịch vụ quá hạn",
        content: `Phiếu sử dụng dịch vụ ${ticketId} đã quá hạn và bị hủy.`,
        type: "system",
      });
    }
  }

  for (const ticketId of dueTicketIds) {
    for (const user of users) {
      notifications.push({
        user_id: user._id,
        title: "Dịch vụ đến ngày sử dụng",
        content: `Phiếu sử dụng dịch vụ ${ticketId} đã đến ngày đăng ký.`,
        type: "system",
      });
    }
  }

  if (notifications.length) {
    await Notification.insertMany(notifications);
  }

  const affectedTicketIds = [...new Set([...expiredTicketIds, ...dueTicketIds])];

  for (const ticketId of affectedTicketIds) {
    await recalcServiceUsageStatus(ticketId);
  }

  console.log(
    `[CRON] service usage waiting_confirm: ${dueDetailIds.length}, cancelled: ${expiredDetailIds.length}`
  );
};
