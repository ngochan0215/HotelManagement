import cron from "node-cron";
import Receipt from "../models/Receipt.js";
import { container } from "../containers/container.js";
import { BOOKING_EVENTS } from "../../../shared/events/bookingEvents.js";

const startCronJob = ({ name, schedule, handler }) => {
  cron.schedule(schedule, async () => {
    try {
      console.log(`[CRON][payment] Checking ${name}...`);
      await handler();
      console.log(`[CRON][payment] DONE ${name}`);
    } catch (err) {
      console.error(`[CRON][payment] ${name} job error:`, err);
    }
  });
};

const syncCancelledReceiptsFromBookings = async () => {
  const receipts = await Receipt.find({
    status: { $in: ["pending", "half-paid"] },
  }).select("_id booking_id status");

  if (!receipts.length) return;

  const bookingIds = [...new Set(receipts.map((r) => r.booking_id?.toString()).filter(Boolean))];
  if (!bookingIds.length) return;

  const reply = await container.eventBus.safeRequest(BOOKING_EVENTS.GET_BOOKINGS_BY_IDS, { bookingIds });
  const bookings = reply?.bookings || [];
  const bookingStatusById = new Map(bookings.map((b) => [b._id.toString(), b.status]));

  const staleStatuses = new Set(["cancelled", "expired"]);
  const toCancel = receipts
    .filter((r) => staleStatuses.has(bookingStatusById.get(r.booking_id.toString())))
    .map((r) => r._id);

  if (!toCancel.length) return;

  await Receipt.updateMany(
    { _id: { $in: toCancel } },
    {
      $set: {
        status: "cancelled",
        cancelled_at: new Date(),
        note: "Hóa đơn bị hủy tự động vì booking đã bị hủy/hết hạn.",
      },
    }
  );
};

export const startReceiptSyncJob = () =>
  startCronJob({
    name: "sync cancelled receipts from bookings",
    schedule: "*/5 * * * *",
    handler: syncCancelledReceiptsFromBookings,
  });
