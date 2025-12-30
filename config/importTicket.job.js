import cron from "node-cron";
import { notifyImportTickets, notifyInstallTickets, notifyGoodTickets } from "../utils/notifyTickets.js";

export const startImportTicketJob = () => {
  // Chạy mỗi ngày lúc 00:00
  cron.schedule("0 0 * * *", async () => {
    
    try {
      console.log("[CRON] Checking import tickets...");
      await notifyImportTickets();
      console.log("[CRON] DONE import");
    } catch (err) {
      console.error("[CRON] Import ticket job error:", err);
    }
  });
};

export const startInstallTicketJob = () => {
  // Chạy mỗi ngày lúc 00:00
  cron.schedule("0 0 * * *", async () => {
    
    try {
      console.log("[CRON] Checking install equipment tickets...");
      await notifyInstallTickets();
      console.log("[CRON] DONE install");
    } catch (err) {
      console.error("[CRON] Install ticket job error:", err);
    }
  });
};

export const startGoodTicketJob = () => {
  // Chạy mỗi ngày lúc 00:00
  cron.schedule("0 0 * * *", async () => {
    
    try {
      console.log("[CRON] Checking import goods tickets...");
      await notifyGoodTickets();
      console.log("[CRON] DONE import");
    } catch (err) {
      console.error("[CRON] Good import ticket job error:", err);
    }
  });
};