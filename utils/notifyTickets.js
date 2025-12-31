import { EquipmentTicket, Notification, User, EquipmentInstall, 
    GoodTicket, ServiceUsage, UsageDetail } from "../models/index.js";
import { recalcServiceUsageStatus } from "../controllers/serviceController.js";

export const notifyImportTickets = async () => {
    const start = new Date();
    start.setHours(0, 0, 0, 0);

    const end = new Date();
    end.setHours(23, 59, 59, 999);

    const tickets = await EquipmentTicket.find({
        status: "pending",
        import_date: { $gte: start, $lte: end }
    }).populate({
        path: "employee_id",
        select: "user_id",
    });

    if (tickets.length === 0) return;

    const managers = await User.find({ system_role: "manager" }).select("_id");

    for (const ticket of tickets) {
        ticket.status = "waiting_confirm";
        await ticket.save();

        // Tạo thông báo cho mỗi quản lý
        const notifications = managers.map(manager => ({
            user_id: manager._id,
            title: "Phiếu nhập thiết bị đến ngày",
            content: `Phiếu nhập ${ticket._id} đã đến ngày nhập kho`,
            type: "system",
        }));

        await Notification.insertMany(notifications);
    }
};

export const notifyInstallTickets = async () => {
    const start = new Date();
    start.setHours(0, 0, 0, 0);

    const end = new Date();
    end.setHours(23, 59, 59, 999);

    const tickets = await EquipmentInstall.find({
        status: "pending",
        install_date: { $gte: start, $lte: end }
    }).populate({
        path: "employee_id",
        select: "user_id",
    });

    if (tickets.length === 0) return;

    const managers = await User.find({ system_role: "manager" }).select("_id");

    for (const ticket of tickets) {
        ticket.status = "waiting_confirm";
        await ticket.save();

        // Tạo thông báo cho mỗi quản lý
        const notifications = managers.map(manager => ({
            user_id: manager._id,
            title: "Phiếu lắp đặt thiết bị đến ngày",
            content: `Phiếu lắp đặt thiết bị ${ticket._id} đã đến ngày lắp đặt`,
            type: "system",
        }));

        await Notification.insertMany(notifications);
    }
};

export const notifyGoodTickets = async () => {
    const start = new Date();
    start.setHours(0, 0, 0, 0);

    const end = new Date();
    end.setHours(23, 59, 59, 999);

    const tickets = await GoodTicket.find({
        status: "pending",
        import_date: { $gte: start, $lte: end }
    }).populate({
        path: "employee_id",
        select: "user_id",
    });

    if (tickets.length === 0) return;

    const managers = await User.find({ system_role: "manager" }).select("_id");

    for (const ticket of tickets) {
        ticket.status = "waiting_confirm";
        await ticket.save();

        // Tạo thông báo cho mỗi quản lý
        const notifications = managers.map(manager => ({
            user_id: manager._id,
            title: "Phiếu nhập sản phẩm đến ngày",
            content: `Phiếu nhập sản phẩ ${ticket._id} đã đến ngày nhập`,
            type: "system",
        }));

        await Notification.insertMany(notifications);
    }
};

export const notifyServiceUsageTickets = async () => {

    const now = new Date();

    const details = await UsageDetail.find({
        status: "pending",
        use_from: { $ne: null, $lte: now },
    }).select("_id ticket_id");

    if (!details.length) return;

    const detailIds = details.map(d => d._id);
    const ticketIds = [...new Set(details.map(d => d.ticket_id.toString()))];

    await UsageDetail.updateMany(
        { _id: { $in: detailIds } },
        { $set: { status: "waiting_confirm" } }
    );

    const users = await User.find({ system_role: { $ne: "manager" } }).select("_id");

    const notifications = [];

    for (const ticketId of ticketIds) {
        for (const user of users) {
            notifications.push({
                user_id: user._id,
                title: "Dịch vụ đến ngày sử dụng",
                content: `Phiếu sử dụng dịch vụ ${ticketId} đã đến ngày đăng ký`,
                type: "system",
            });
        }
    }

    if (notifications.length) {
        await Notification.insertMany(notifications);
    }

    for (const ticketId of ticketIds) {
        await recalcServiceUsageStatus(ticketId);
    }

    console.log(`[CRON] Updated ${detailIds.length} usage_detail → waiting_confirm`);
};
