
// const startCronJob = ({ name, schedule, handler }) => {
//   cron.schedule(schedule, async () => {
//     try {
//       console.log(`[CRON] Checking ${name}...`);
//       await handler();
//       console.log(`[CRON] DONE ${name}`);
//     } catch (err) {
//       console.error(`[CRON] ${name} job error:`, err);
//     }
//   });
// };

// export const startImportTicketJob = () =>
//   startCronJob({
//     name: "import tickets",
//     schedule: "*/5 * * * *",
//     handler: notifyImportTickets,
//   });

// export const startInstallTicketJob = () =>
//   startCronJob({
//     name: "install equipment tickets",
//     schedule: "*/5 * * * *",
//     handler: notifyInstallTickets,
//   });