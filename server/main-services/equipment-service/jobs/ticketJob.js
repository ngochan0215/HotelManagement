import cron from "node-cron";
import ImportTicket from "../models/ImportTicket.js";
import InstallTicket from "../models/InstallTicket.js";
import InstallDetail from "../models/InstallDetail.js";
import Equipment from "../models/Equipment.js";
import EquipmentCategory from "../models/EquipmentCategory.js";
import EquipmentLog from "../models/EquipmentLog.js";
import { container } from "../containers/container.js";
import { USER_EVENTS } from "../../../shared/events/userEvents.js";
import { sendNotificationsToUsers } from "../../../shared/messaging/notificationPublisher.js";

const getManagerIds = async () => {
  const reply = await container.eventBus.request(USER_EVENTS.GET_MANAGERS);

  if (!reply?.success || !Array.isArray(reply.managers)) return [];

  return reply.managers.map((u) => u._id).filter(Boolean);
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

  const managerIds = await getManagerIds();

  const expiredTickets = await ImportTicket.find({
    status: "waiting_confirm",
    import_date: { $lt: start },
  }).select("_id");

  if (expiredTickets.length) {
    await ImportTicket.updateMany(
      { _id: { $in: expiredTickets.map((t) => t._id) } },
      { $set: { status: "expired" } }
    );

    if (managerIds.length) {
      for (const ticket of expiredTickets) {
        await sendNotificationsToUsers({
          userIds: managerIds,
          title: "Phiếu nhập thiết bị quá hạn",
          content: `Phiếu nhập thiết bị ${ticket._id} đã quá ngày nhập kho và bị chuyển sang trạng thái quá hạn.`,
          type: "equipment",
          kind: "ImportTicket",
          refId: ticket._id,
        });
      }
    }
  }

  const dueTickets = await ImportTicket.find({
    status: "pending",
    import_date: { $gte: start, $lte: end },
  }).select("_id");

  if (dueTickets.length) {
    await ImportTicket.updateMany(
      { _id: { $in: dueTickets.map((t) => t._id) } },
      { $set: { status: "waiting_confirm" } }
    );

    if (managerIds.length) {
      for (const ticket of dueTickets) {
        await sendNotificationsToUsers({
          userIds: managerIds,
          title: "Phiếu nhập thiết bị đến ngày",
          content: `Phiếu nhập thiết bị ${ticket._id} đã đến ngày nhập kho.`,
          type: "equipment",
          kind: "ImportTicket",
          refId: ticket._id,
        });
      }
    }
  }
};

const notifyInstallTickets = async () => {
  const now = new Date();
  const start = new Date();
  start.setHours(0, 0, 0, 0);
  const end = new Date();
  end.setHours(23, 59, 59, 999);
  const managerIds = await getManagerIds();

  const expiredTickets = await InstallTicket.find({
    status: { $in: ["waiting_confirm", "pending", "assigned"] },
    install_date: { $lt: start },
  }).select("_id type employee_id");

  for (const ticket of expiredTickets) {
    await InstallTicket.updateOne(
      { _id: ticket._id },
      { $set: { status: "expired" } }
    );

    const details = await InstallDetail.find({ ticket_id: ticket._id }).select(
      "equipment_id"
    );
    const equipmentIds = details.map((d) => d.equipment_id);

    if (!equipmentIds.length) continue;

    const equipments = await Equipment.find({ _id: { $in: equipmentIds } }).select(
      "category_id"
    );

    await Equipment.updateMany(
      { _id: { $in: equipmentIds } },
      {
        $set: {
          status: "in-stock",
          condition: "new",
          room_id: null,
        },
      }
    );

    if (ticket.type === "install") {
      const countByCategory = new Map();
      for (const eq of equipments) {
        const key = eq.category_id?.toString();
        if (!key) continue;
        countByCategory.set(key, (countByCategory.get(key) || 0) + 1);
      }

      for (const [categoryId, count] of countByCategory.entries()) {
        await EquipmentCategory.updateOne(
          { _id: categoryId },
          { $inc: { storage_quantity: count } }
        );
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

  if (managerIds.length && expiredTickets.length) {
    for (const ticket of expiredTickets) {
      await sendNotificationsToUsers({
        userIds: managerIds,
        title: "Phiếu lắp đặt thiết bị quá hạn",
        content: `Phiếu lắp đặt thiết bị ${ticket._id} đã quá hạn và bị hủy.`,
        type: "equipment",
        kind: "InstallTicket",
        refId: ticket._id,
      });
    }
  }

  const dueTickets = await InstallTicket.find({
    status: "pending",
    install_date: { $gte: start, $lte: end },
  }).select("_id");

  if (dueTickets.length) {
    await InstallTicket.updateMany(
      { _id: { $in: dueTickets.map((t) => t._id) } },
      { $set: { status: "waiting_confirm" } }
    );

    if (managerIds.length) {
      for (const ticket of dueTickets) {
        await sendNotificationsToUsers({
          userIds: managerIds,
          title: "Phiếu lắp đặt thiết bị đến ngày",
          content: `Phiếu lắp đặt thiết bị ${ticket._id} đã đến ngày lắp đặt.`,
          type: "equipment",
          kind: "InstallTicket",
          refId: ticket._id,
        });
      }
    }
  }
};

export const startImportTicketJob = () =>
  startCronJob({
    name: "import tickets",
    schedule: "*/5 * * * *",
    handler: notifyImportTickets,
  });

export const startInstallTicketJob = () =>
  startCronJob({
    name: "install tickets",
    schedule: "*/5 * * * *",
    handler: notifyInstallTickets,
  });