import cron from "node-cron";
import { notifyImportTickets, notifyInstallTickets, notifyGoodTickets, updateAllCustomerTiers,
  notifyServiceUsageTickets, cancelCheckinLateBookings, cancelExpiredDepositBookings, notifyCheckinReminder,
  notifyCheckoutReminder, notifyDepositDeadlineReminder, notifyCheckinTimeReminder, syncRoomStatusFromLogs,
  fixRoomLogsFromCancelledBookings
} from "../jobs/notifyTickets.js";

const startCronJob = ({ name, schedule, handler }) => {
  cron.schedule(schedule, async () => {
    try {
      console.log(`[CRON] Checking ${name}...`);
      await handler();
      console.log(`[CRON] DONE ${name}`);
    } catch (err) {
      console.error(`[CRON] ${name} job error:`, err);
    }
  });
};

export const startImportTicketJob = () =>
  startCronJob({
    name: "import tickets",
    schedule: "*/5 * * * *",
    handler: notifyImportTickets,
  });

export const startInstallTicketJob = () =>
  startCronJob({
    name: "install equipment tickets",
    schedule: "*/5 * * * *",
    handler: notifyInstallTickets,
  });

export const startGoodTicketJob = () =>
  startCronJob({
    name: "import goods tickets",
    schedule: "*/5 * * * *",
    handler: notifyGoodTickets,
  });

export const startServiceUsageJob = () =>
  startCronJob({
    name: "service usage tickets",
    schedule: "*/5 * * * *",
    handler: notifyServiceUsageTickets,
  });

export const startCancelPendingBookingJob = () =>
  startCronJob({
    name: "cancel pending bookings (late deposit)",
    schedule: "*/5 * * * *",
    handler: cancelExpiredDepositBookings,
  });

export const startCancelCheckinLateBookingJob = () =>
  startCronJob({
    name: "cancel checkin late bookings",
    schedule: "*/5 * * * *",
    handler: cancelCheckinLateBookings,
  });

export const startCustomerTierJob = () =>
  startCronJob({
    name: "calculating customer loyalty and points",
    schedule: "*/5 * * * *",
    handler: updateAllCustomerTiers,
  });

export const startCheckinReminderJob = () =>
  startCronJob({
    name: "check-in reminder (2 hours before)",
    schedule: "*/5 * * * *", // Chạy mỗi 5 phút
    handler: notifyCheckinReminder,
  });

export const startCheckoutReminderJob = () =>
  startCronJob({
    name: "check-out reminder (1h, 30m, 5m before)",
    schedule: "*/5 * * * *", // Chạy mỗi 5 phút
    handler: notifyCheckoutReminder,
  });

export const startDepositDeadlineReminderJob = () =>
  startCronJob({
    name: "deposit deadline reminder (30m, 20m, 10m, 5m before)",
    schedule: "*/5 * * * *", // Chạy mỗi 5 phút
    handler: notifyDepositDeadlineReminder,
  });

export const startCheckinTimeReminderJob = () =>
  startCronJob({
    name: "check-in time reminder (30m, 20m, 10m, 5m before)",
    schedule: "*/5 * * * *", // Chạy mỗi 5 phút
    handler: notifyCheckinTimeReminder,
  });

export const startSyncRoomStatusJob = () =>
  startCronJob({
    name: "sync room status from logs",
    schedule: "* * * * *", // Chạy mỗi phút để sync room.room_status từ log
    handler: syncRoomStatusFromLogs,
  });

export const startFixRoomLogsJob = () =>
  startCronJob({
    name: "fix room logs from cancelled bookings",
    schedule: "* * * * *", // Chạy mỗi phút để sửa lại room_log từ booking đã hủy
    handler: fixRoomLogsFromCancelledBookings,
  });


