import cron from "node-cron";
import ImportTicket from "../models/ImportTicket.js";
import InstallTicket from "../models/InstallTicket.js";
import InstallDetail from "../models/InstallDetail.js";
import Equipment from "../models/Equipment.js";
import EquipmentCategory from "../models/EquipmentCategory.js";
import EquipmentLog from "../models/EquipmentLog.js";
import { container } from "../containers/container.js";
import { USER_EVENTS } from "../../../shared/events/userEvents.js";
import { EMPLOYEE_EVENTS } from "../../../shared/events/employeeEvents.js";
import { sendNotification, sendNotificationsToUsers } from "../../../shared/messaging/notificationPublisher.js";

// helpers

const getManagerAndAdminIds = async () => {
  const [replyManagers, replyAdmins] = await Promise.all([
    container.eventBus.safeRequest(USER_EVENTS.GET_MANAGERS),
    container.eventBus.safeRequest(USER_EVENTS.GET_ADMINS),
  ]);

  const managerIds = replyManagers?.success && Array.isArray(replyManagers.managers)
    ? replyManagers.managers.map((u) => u._id).filter(Boolean)
    : [];

  const adminIds = replyAdmins?.success && Array.isArray(replyAdmins.admins)
    ? replyAdmins.admins.map((u) => u._id).filter(Boolean)
    : [];

  return [...new Set([...managerIds, ...adminIds].map(String))];
};

const getEmployeeUserId = async (employeeId) => {
  if (!employeeId) return null;

  const reply = await container.eventBus.safeRequest(
    EMPLOYEE_EVENTS.CHECK_EXISTS,
    { employee_id: employeeId }
  );

  return reply?.success && reply.employee?.user_id
    ? reply.employee.user_id
    : null;
};

const startCronJob = ({ name, schedule, handler }) => {
  cron.schedule(schedule, async () => {
    try {
      console.log(`[CRON][equipment] Checking ${name}...`);
      await handler();
      console.log(`[CRON][equipment] DONE ${name}`);
    } catch (err) {
      console.error(`[CRON][equipment] ${name} job error:`, err);
    }
  });
};

const notifyImportTickets = async () => {
  const start = new Date();
  start.setHours(0, 0, 0, 0);
  const end = new Date();
  end.setHours(23, 59, 59, 999);

  const managerAndAdminIds = await getManagerAndAdminIds();

  // expire overdue tickets
  const expiredTickets = await ImportTicket.find({
    status: "waiting_confirm",
    import_date: { $lt: start },
  }).select("_id employee_id");

  if (expiredTickets.length) {
    await ImportTicket.updateMany(
      { _id: { $in: expiredTickets.map((t) => t._id) } },
      { $set: { status: "expired" } }
    );

    if (managerAndAdminIds.length) {
      for (const ticket of expiredTickets) {
        await sendNotificationsToUsers({
          userIds: managerAndAdminIds,
          title: "Phiếu nhập thiết bị quá hạn",
          content: `Phiếu nhập thiết bị #${ticket._id.toString().slice(-6)} đã quá ngày nhập kho và bị chuyển sang trạng thái quá hạn.`,
          type: "equipment",
          kind: "ImportTicket",
          refId: ticket._id,
        });
      }
    }
  }

  // promote today's pending → waiting_confirm
  const dueTickets = await ImportTicket.find({
    status: "pending",
    import_date: { $gte: start, $lte: end },
  }).select("_id employee_id");

  if (dueTickets.length) {
    await ImportTicket.updateMany(
      { _id: { $in: dueTickets.map((t) => t._id) } },
      { $set: { status: "waiting_confirm" } }
    );

    if (managerAndAdminIds.length) {
      for (const ticket of dueTickets) {
        await sendNotificationsToUsers({
          userIds: managerAndAdminIds,
          title: "Phiếu nhập thiết bị đến ngày",
          content: `Phiếu nhập thiết bị #${ticket._id.toString().slice(-6)} đã đến ngày nhập kho.`,
          type: "equipment",
          kind: "ImportTicket",
          refId: ticket._id,
        });
      }
    }
  }
};

const remindImportTickets = async () => {
  const now = new Date();
  const windowStart = new Date(now.getTime() + 12 * 60 * 60 * 1000);              // +12 h
  const windowEnd   = new Date(now.getTime() + 12 * 60 * 60 * 1000 + 5 * 60 * 1000); // +12 h 5 min

  const tickets = await ImportTicket.find({
    status: "pending",
    import_date: { $gte: windowStart, $lt: windowEnd },
  }).select("_id employee_id");

  if (!tickets.length) return;

  const managerAndAdminIds = await getManagerAndAdminIds();

  for (const ticket of tickets) {
    const shortenId = ticket._id.toString().slice(-6);

    if (managerAndAdminIds.length) {
      await sendNotificationsToUsers({
        userIds: managerAndAdminIds,
        title: "Nhắc nhở: Phiếu nhập thiết bị sắp đến hạn",
        content: `Phiếu nhập thiết bị #${shortenId} sẽ đến ngày nhập kho trong vòng 12 tiếng tới.`,
        type: "equipment",
        kind: "ImportTicket",
        refId: ticket._id,
      });
    }

    const employeeUserId = await getEmployeeUserId(ticket.employee_id);
    if (employeeUserId) {
      await sendNotification({
        userId: employeeUserId,
        title: "Nhắc nhở: Phiếu nhập thiết bị sắp đến hạn",
        content: `Phiếu nhập thiết bị #${shortenId} mà bạn phụ trách sẽ đến ngày nhập kho trong vòng 12 tiếng tới.`,
        type: "equipment",
        kind: "ImportTicket",
        refId: ticket._id,
      });
    }
  }
};

const notifyInstallTickets = async () => {
  const now = new Date();
  const start = new Date();
  start.setHours(0, 0, 0, 0);
  const end = new Date();
  end.setHours(23, 59, 59, 999);

  const managerAndAdminIds = await getManagerAndAdminIds();

  // expire overdue tickets
  const expiredTickets = await InstallTicket.find({
    status: { $in: ["waiting_confirm", "pending", "assigned"] },
    install_date: { $lt: start },
  }).select("_id type employee_id");

  for (const ticket of expiredTickets) {
    await InstallTicket.updateOne(
      { _id: ticket._id },
      { $set: { status: "expired" } }
    );

    const details = await InstallDetail.find({ ticket_id: ticket._id }).select("equipment_id");
    const equipmentIds = details.map((d) => d.equipment_id);

    if (!equipmentIds.length) continue;

    const equipments = await Equipment.find({ _id: { $in: equipmentIds } }).select("category_id");

    await Equipment.updateMany(
      { _id: { $in: equipmentIds } },
      { $set: { status: "in-stock", condition: "new", room_id: null } }
    );

    if (ticket.type === "install") {
      const countByCategory = new Map();
      for (const eq of equipments) {
        const key = eq.category_id?.toString();
        if (!key) continue;
        countByCategory.set(key, (countByCategory.get(key) || 0) + 1);
      }
      for (const [categoryId, count] of countByCategory.entries()) {
        await EquipmentCategory.updateOne({ _id: categoryId }, { $inc: { storage_quantity: count } });
      }
    }

    await EquipmentLog.updateMany(
      { equipment_id: { $in: equipmentIds }, end_time: null },
      { $set: { end_time: now } }
    );

    await EquipmentLog.insertMany(
      equipmentIds.map((equipmentId) => ({
        equipment_id: equipmentId,
        room_id: null,
        status: "in-stock",
        condition: "new",
        start_time: now,
        note: `Thiết bị quay về kho do phiếu ${ticket.type} ${ticket._id} quá hạn`,
        handled_by: ticket.employee_id || null,
      }))
    );

    await InstallDetail.deleteMany({ ticket_id: ticket._id });
  }

  if (managerAndAdminIds.length && expiredTickets.length) {
    for (const ticket of expiredTickets) {
      await sendNotificationsToUsers({
        userIds: managerAndAdminIds,
        title: "Phiếu lắp đặt thiết bị quá hạn",
        content: `Phiếu lắp đặt thiết bị #${ticket._id.toString().slice(-6)} đã quá hạn và bị hủy.`,
        type: "equipment",
        kind: "InstallTicket",
        refId: ticket._id,
      });
    }
  }

  // promote today's pending → waiting_confirm
  const dueTickets = await InstallTicket.find({
    status: "pending",
    install_date: { $gte: start, $lte: end },
  }).select("_id employee_id");

  if (dueTickets.length) {
    await InstallTicket.updateMany(
      { _id: { $in: dueTickets.map((t) => t._id) } },
      { $set: { status: "waiting_confirm" } }
    );

    if (managerAndAdminIds.length) {
      for (const ticket of dueTickets) {
        await sendNotificationsToUsers({
          userIds: managerAndAdminIds,
          title: "Phiếu lắp đặt thiết bị đến ngày",
          content: `Phiếu lắp đặt thiết bị #${ticket._id.toString().slice(-6)} đã đến ngày lắp đặt.`,
          type: "equipment",
          kind: "InstallTicket",
          refId: ticket._id,
        });
      }
    }
  }
};

const remindInstallTickets = async () => {
  const now = new Date();
  const windowStart = new Date(now.getTime() + 12 * 60 * 60 * 1000);
  const windowEnd   = new Date(now.getTime() + 12 * 60 * 60 * 1000 + 5 * 60 * 1000);

  const tickets = await InstallTicket.find({
    status: { $in: ["pending", "assigned"] },
    install_date: { $gte: windowStart, $lt: windowEnd },
  }).select("_id employee_id");

  if (!tickets.length) return;

  const managerAndAdminIds = await getManagerAndAdminIds();

  for (const ticket of tickets) {
    const shortenId = ticket._id.toString().slice(-6);

    if (managerAndAdminIds.length) {
      await sendNotificationsToUsers({
        userIds: managerAndAdminIds,
        title: "Nhắc nhở: Phiếu lắp đặt thiết bị sắp đến hạn",
        content: `Phiếu lắp đặt thiết bị #${shortenId} sẽ đến ngày lắp đặt trong vòng 12 tiếng tới.`,
        type: "equipment",
        kind: "InstallTicket",
        refId: ticket._id,
      });
    }

    // notify the assigned technician individually
    const employeeUserId = await getEmployeeUserId(ticket.employee_id);
    if (employeeUserId) {
      await sendNotification({
        userId: employeeUserId,
        title: "Nhắc nhở: Phiếu lắp đặt sắp đến hạn",
        content: `Phiếu lắp đặt thiết bị #${shortenId} được giao cho bạn sẽ đến ngày thực hiện trong vòng 12 tiếng tới.`,
        type: "equipment",
        kind: "InstallTicket",
        refId: ticket._id,
      });
    }
  }
};

export const startImportTicketJob = () => {
  startCronJob({ name: "import tickets status",      schedule: "*/5 * * * *", handler: notifyImportTickets });
  startCronJob({ name: "import tickets 12h reminder", schedule: "*/5 * * * *", handler: remindImportTickets });
};

export const startInstallTicketJob = () => {
  startCronJob({ name: "install tickets status",      schedule: "*/5 * * * *", handler: notifyInstallTickets });
  startCronJob({ name: "install tickets 12h reminder", schedule: "*/5 * * * *", handler: remindInstallTickets });
};
