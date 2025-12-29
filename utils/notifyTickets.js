import { EquipmentTicket, Notification, User, EquipmentInstall } from "../models/index.js";

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