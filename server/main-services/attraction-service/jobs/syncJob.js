import cron from "node-cron";

export function startSyncJob(syncService) {
    // every Sunday at 03:00
    cron.schedule("0 3 * * 0", async () => {
        console.log("[CRON] Weekly attraction sync started.");
        try {
            const result = await syncService.runFullSync();
            console.log("[CRON] Sync result:", result);
        } catch (err) {
            console.error("[CRON] Sync failed:", err.message);
        }
    });

    console.log("[CRON] Attraction sync job scheduled (Sundays 03:00).");
}
