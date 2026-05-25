import cron from "node-cron";
import GoodTicket from "../models/GoodTicket.js";
import UsageDetail from "../models/UsageDetail.js";
import { container } from "../containers/container.js";
import { USER_EVENTS } from "../../../shared/events/userEvents.js";
import { EMPLOYEE_EVENTS } from "../../../shared/events/employeeEvents.js";
import { sendNotificationsToUsers } from "../../../shared/messaging/notificationPublisher.js";

const getManagerIds = async () => {
    const reply = await container.eventBus.safeRequest(USER_EVENTS.GET_MANAGERS);
    if (!reply?.success || !Array.isArray(reply.managers)) return [];
    return reply.managers.map((m) => m._id).filter(Boolean);
};

const getStaffUserIds = async () => {
    const reply = await container.eventBus.safeRequest(EMPLOYEE_EVENTS.GET_RECEPTIONISTS);
    if (!reply?.success || !Array.isArray(reply.receptionists)) return [];
    return reply.receptionists.map((e) => e.user_id).filter(Boolean);
};

export const notifyGoodTickets = async () => {
    const start = new Date();
    start.setHours(0, 0, 0, 0);
    const end = new Date();
    end.setHours(23, 59, 59, 999);

    const managerIds = await getManagerIds();

    const expiredTickets = await GoodTicket.find({
        status: { $in: ["waiting_confirm", "pending"] },
        import_date: { $lt: start },
    });

    if (expiredTickets.length > 0) {
        await GoodTicket.updateMany(
            { _id: { $in: expiredTickets.map((t) => t._id) } },
            { status: "expired" }
        );
        for (const ticket of expiredTickets) {
            try {
                await sendNotificationsToUsers({
                    userIds: managerIds,
                    title: "Phiếu nhập sản phẩm quá hạn",
                    content: `Phiếu nhập sản phẩm ${ticket._id} đã quá ngày nhập và bị chuyển sang trạng thái quá hạn.`,
                    type: "system",
                    kind: "Order",
                    refId: ticket._id,
                });
            } catch (error) {
                console.error(`Error sending notification for expired good ticket ${ticket._id}:`, error);
            }
        }
    }

    const todayTickets = await GoodTicket.find({
        status: "pending",
        import_date: { $gte: start, $lte: end },
    });

    if (todayTickets.length > 0) {
        await GoodTicket.updateMany(
            { _id: { $in: todayTickets.map((t) => t._id) } },
            { status: "waiting_confirm" }
        );
        for (const ticket of todayTickets) {
            try {
                await sendNotificationsToUsers({
                    userIds: managerIds,
                    title: "Phiếu nhập sản phẩm đến ngày",
                    content: `Phiếu nhập sản phẩm ${ticket._id} đã đến ngày nhập kho.`,
                    type: "system",
                    kind: "Order",
                    refId: ticket._id,
                });
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

    const expiredDetailIds = expiredDetails.map((d) => d._id);
    const expiredTicketIds = [...new Set(expiredDetails.map((d) => d.ticket_id.toString()))];

    if (expiredDetailIds.length) {
        await UsageDetail.updateMany({ _id: { $in: expiredDetailIds } }, { $set: { status: "cancelled" } });
    }

    const dueDetails = await UsageDetail.find({
        status: "pending",
        use_from: { $ne: null, $lte: now },
        $or: [{ finish_at: null }, { finish_at: { $gte: now } }],
    }).select("_id ticket_id");

    const dueDetailIds = dueDetails.map((d) => d._id);
    const dueTicketIds = [...new Set(dueDetails.map((d) => d.ticket_id.toString()))];

    if (dueDetailIds.length) {
        await UsageDetail.updateMany({ _id: { $in: dueDetailIds } }, { $set: { status: "waiting_confirm" } });
    }

    const userIds = await getStaffUserIds();

    for (const ticketId of expiredTicketIds) {
        try {
            await sendNotificationsToUsers({
                userIds,
                title: "Dịch vụ quá hạn",
                content: `Phiếu sử dụng dịch vụ ${ticketId} đã quá hạn và bị hủy.`,
                type: "system",
                kind: "Order",
                refId: ticketId,
            });
        } catch (error) {
            console.error(`Error sending notification for expired service ticket ${ticketId}:`, error);
        }
    }

    for (const ticketId of dueTicketIds) {
        try {
            await sendNotificationsToUsers({
                userIds,
                title: "Dịch vụ đến ngày sử dụng",
                content: `Phiếu sử dụng dịch vụ ${ticketId} đã đến ngày đăng ký.`,
                type: "system",
                kind: "Order",
                refId: ticketId,
            });
        } catch (error) {
            console.error(`Error sending notification for due service ticket ${ticketId}:`, error);
        }
    }

    const affectedTicketIds = [...new Set([...expiredTicketIds, ...dueTicketIds])];
    for (const ticketId of affectedTicketIds) {
        await container.serviceService.recalcServiceUsageStatus(ticketId);
    }
};

export const startGoodTicketJob = () =>
    cron.schedule("0 0 * * *", notifyGoodTickets, { timezone: "Asia/Ho_Chi_Minh" });

export const startServiceUsageJob = () =>
    cron.schedule("*/15 * * * *", notifyServiceUsageTickets, { timezone: "Asia/Ho_Chi_Minh" });
