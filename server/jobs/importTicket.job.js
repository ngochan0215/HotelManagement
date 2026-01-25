import cron from "node-cron";
import { notifyImportTickets, notifyInstallTickets, notifyGoodTickets, updateAllCustomerTiers,
  notifyServiceUsageTickets, cancelCheckinLateBookings, cancelExpiredDepositBookings, notifyCheckinReminder,
  syncRoomStatusFromLogs
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

export const startSyncRoomStatusJob = () =>
  startCronJob({
    name: "sync room status from logs",
    schedule: "*/5 * * * *", // Chạy mỗi 5 phút để sync room.room_status từ log
    handler: syncRoomStatusFromLogs,
  });


