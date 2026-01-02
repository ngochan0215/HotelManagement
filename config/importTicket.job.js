import cron from "node-cron";
import { notifyImportTickets, notifyInstallTickets, notifyGoodTickets, 
  notifyServiceUsageTickets, cancelCheckinLateBookings, cancelExpiredDepositBookings 
} from "../utils/notifyTickets.js";

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

// export const startImportTicketJob = () => {
//   // Chạy mỗi 5 phút
//   cron.schedule("*/5 * * * *", async () => {
    
//     try {
//       console.log("[CRON] Checking import tickets...");
//       await notifyImportTickets();
//       console.log("[CRON] DONE import");
//     } catch (err) {
//       console.error("[CRON] Import ticket job error:", err);
//     }
//   });
// };

// export const startInstallTicketJob = () => {
//   // Chạy mỗi 5 phút
//   cron.schedule("*/5 * * * *", async () => {
    
//     try {
//       console.log("[CRON] Checking install equipment tickets...");
//       await notifyInstallTickets();
//       console.log("[CRON] DONE install");
//     } catch (err) {
//       console.error("[CRON] Install ticket job error:", err);
//     }
//   });
// };

// export const startGoodTicketJob = () => {
//   // Chạy mỗi 5 phút
//   cron.schedule("*/5 * * * *", async () => {
    
//     try {
//       console.log("[CRON] Checking import goods tickets...");
//       await notifyGoodTickets();
//       console.log("[CRON] DONE import");
//     } catch (err) {
//       console.error("[CRON] Good import ticket job error:", err);
//     }
//   });
// };

// export const startServiceUsageJob = () => {
//   // Chạy mỗi 5 phút
//   cron.schedule("*/5 * * * *", async () => {
    
//     try {
//       console.log("[CRON] Checking service usage tickets...");
//       await notifyServiceUsageTickets();
//       console.log("[CRON] DONE using service");
//     } catch (err) {
//       console.error("[CRON] Service usage ticket job error:", err);
//     }
//   });
// };