import cron from "node-cron";
import Room from "../models/Room.js";
import RoomLog from "../models/RoomLog.js";
import { container } from "../containers/container.js";
import { BOOKING_EVENTS } from "../../../shared/events/bookingEvents.js";

const startCronJob = ({ name, schedule, handler }) => {
  cron.schedule(schedule, async () => {
    try {
      console.log(`[CRON][room] Checking ${name}...`);
      await handler();
      console.log(`[CRON][room] DONE ${name}`);
    } catch (err) {
      console.error(`[CRON][room] ${name} job error:`, err);
    }
  });
};

const syncRoomStatusFromLogs = async () => {
  const now = new Date();
  const rooms = await Room.find({}).select("_id room_status");
  let updatedCount = 0;

  for (const room of rooms) {
    const currentLog = await RoomLog.findOne({
      room_id: room._id,
      start_time: { $lte: now },
      $or: [{ end_time: null }, { end_time: { $gte: now } }],
    }).sort({ start_time: -1 });

    if (currentLog && currentLog.status !== room.room_status) {
      await Room.updateOne({ _id: room._id }, { $set: { room_status: currentLog.status } });
      updatedCount += 1;
      continue;
    }

    if (!currentLog && ["reserved", "booked"].includes(room.room_status)) {
      await Room.updateOne({ _id: room._id }, { $set: { room_status: "available" } });
      updatedCount += 1;
    }
  }

  if (updatedCount > 0) {
    console.log(`[CRON][room] synced status for ${updatedCount} rooms`);
  }
};

const fixRoomLogsFromCancelledBookings = async () => {
  const now = new Date();
  const activeNonAvailableLogs = await RoomLog.find({
    status: { $in: ["reserved", "booked", "occupied"] },
    booking_id: { $ne: null },
    $or: [{ end_time: null }, { end_time: { $gte: now } }],
  }).select("_id room_id booking_id status start_time");

  if (!activeNonAvailableLogs.length) return;

  const bookingIds = [...new Set(activeNonAvailableLogs.map((l) => l.booking_id.toString()))];
  const reply = await container.eventBus.request(BOOKING_EVENTS.GET_BOOKINGS_BY_IDS, { bookingIds });
  const bookings = reply?.bookings || [];
  const staleStatus = new Set(["cancelled", "expired", "completed"]);

  const staleBookingIds = new Set(
    bookings.filter((b) => staleStatus.has(b.status)).map((b) => b._id.toString())
  );
  if (!staleBookingIds.size) return;

  let fixedCount = 0;
  for (const log of activeNonAvailableLogs) {
    if (!staleBookingIds.has(log.booking_id.toString())) continue;

    const stillBlocked = await RoomLog.findOne({
      room_id: log.room_id,
      _id: { $ne: log._id },
      status: { $in: ["reserved", "booked", "occupied"] },
      $or: [{ end_time: null }, { end_time: { $gte: now } }],
      booking_id: { $nin: [log.booking_id] },
    }).select("_id");

    if (stillBlocked) continue;

    await RoomLog.updateOne({ _id: log._id }, { $set: { end_time: now } });
    await RoomLog.create({
      room_id: log.room_id,
      status: "available",
      start_time: now,
      end_time: null,
      note: `Tự động sửa log: booking ${log.booking_id} đã không còn active`,
      handled_by: null,
    });
    await Room.updateOne({ _id: log.room_id }, { $set: { room_status: "available" } });
    fixedCount += 1;
  }

  if (fixedCount > 0) {
    console.log(`[CRON][room] fixed ${fixedCount} stale room logs`);
  }
};

export const startSyncRoomStatusJob = () =>
  startCronJob({
    name: "sync room status from logs",
    schedule: "* * * * *",
    handler: syncRoomStatusFromLogs,
  });

export const startFixRoomLogsJob = () =>
  startCronJob({
    name: "fix room logs from stale bookings",
    schedule: "* * * * *",
    handler: fixRoomLogsFromCancelledBookings,
  });
