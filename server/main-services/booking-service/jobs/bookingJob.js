import cron from "node-cron";
import Booking from "../models/Booking.js";
import BookingDetail from "../models/BookingDetail.js";
import BookingStatusLog from "../models/BookingStatusLog.js";
import { container } from "../containers/container.js";
import { ROOM_EVENTS } from "../../../shared/events/roomEvents.js";
import { CUSTOMER_EVENTS } from "../../../shared/events/customerEvents.js";
import { EMPLOYEE_EVENTS } from "../../../shared/events/employeeEvents.js";
import { USER_EVENTS } from "../../../shared/events/userEvents.js";
import { sendNotification, sendNotificationsToUsers } from "../../../shared/messaging/notificationPublisher.js";

const startCronJob = ({ name, schedule, handler }) => {
  cron.schedule(schedule, async () => {
    try {
      console.log(`[CRON][booking] Checking ${name}...`);
      await handler();
      console.log(`[CRON][booking] DONE ${name}`);
    } catch (err) {
      console.error(`[CRON][booking] ${name} job error:`, err);
    }
  });
};

// helper 

const getManagerIds = async () => {
  const reply = await container.eventBus.request(USER_EVENTS.GET_ADMINS, { system_role: "manager" });
  if (!reply?.success || !Array.isArray(reply.admins)) return [];
  return reply.admins.map((u) => u._id).filter(Boolean);
};

const getReceptionistIds = async () => {
  const reply = await container.eventBus.request(EMPLOYEE_EVENTS.GET_RECEPTIONISTS, {});
  const employees = reply?.receptionists?.employees || [];
  return employees.map((e) => e.user_id).filter(Boolean);
};

const getCustomerById = async (customerId) => {
  const reply = await container.eventBus.request(CUSTOMER_EVENTS.CHECK_EXISTS, { customerId });
  if (!reply?.success) return null;
  return reply.customer || null;
};

const freeRoomsForBooking = async (booking, details, reasonNote) => {
  const roomIds = details.map((d) => d.room_id).filter(Boolean);
  if (!roomIds.length) return;

  const now = new Date();
  await container.eventBus.request(ROOM_EVENTS.UPDATE_ROOM_INFO, {
    filter: { _id: { $in: roomIds } },
    updateData: {
      room_status: "available",
      start_time: now,
      end_time: now,
    },
  });

  await container.eventBus.request(ROOM_EVENTS.UPDATE_ROOM_LOG, {
    filter: {
      room_id: { $in: roomIds },
      status: { $in: ["reserved", "booked"] },
      end_time: booking.expected_checkout,
    },
    updateData: { end_time: now },
  });

  const availableLogs = roomIds.map((roomId) => ({
    room_id: roomId,
    booking_id: booking._id,
    status: "available",
    start_time: now,
    end_time: null,
    note: reasonNote,
    handled_by: null,
  }));

  await container.eventBus.request(ROOM_EVENTS.INSERT_ROOM_LOG, { data: availableLogs });
};

const cancelBookingBySystem = async (booking, status, note) => {
  const now = new Date();
  const details = await BookingDetail.find({ booking_id: booking._id });

  booking.status = status;
  if (status === "cancelled") booking.isLateCheckin = true;
  await booking.save();

  await BookingDetail.updateMany(
    { booking_id: booking._id },
    { $set: { status: "cancelled", cancelled_at: now, cancellation_reason: "no_show" } }
  );

  await BookingStatusLog.findOneAndUpdate(
    { booking_id: booking._id, end_time: null },
    { $set: { end_time: now } }
  );
  await BookingStatusLog.create({
    booking_id: booking._id,
    status,
    start_time: now,
    note,
    handled_by: null,
  });

  await freeRoomsForBooking(booking, details, note);
};

const notifyBookingParties = async (booking, title, contentCustomer, contentStaff) => {
  const customer = await getCustomerById(booking.customer_id);
  const managerIds = await getManagerIds();
  const receptionistIds = await getReceptionistIds();

  if (customer?.user_id) {
    await sendNotification({
      userId: customer.user_id,
      title,
      content: contentCustomer,
      type: "booking",
      kind: "Booking",
      refId: booking._id,
    });
  }

  const staffUserIds = [...new Set([...managerIds, ...receptionistIds])];
  if (staffUserIds.length) {
    await sendNotificationsToUsers({
      userIds: staffUserIds,
      title,
      content: contentStaff,
      type: "booking",
      kind: "Booking",
      refId: booking._id,
    });
  }
};

const cancelExpiredDepositBookings = async () => {
  const oneHourAgo = new Date(Date.now() - 60 * 60 * 1000);
  const bookings = await Booking.find({
    status: "pending",
    created_at: { $lte: oneHourAgo },
  });

  for (const booking of bookings) {
    const shortId = booking._id.toString().slice(-6);
    await cancelBookingBySystem(
      booking,
      "cancelled",
      "Booking bị hủy do quá 1 giờ chưa đặt cọc."
    );

    await notifyBookingParties(
      booking,
      "Booking đã bị hủy (chưa đặt cọc)",
      `Booking #${shortId} của bạn đã bị hủy do quá 1 giờ chưa đặt cọc.`,
      `Booking #${shortId} đã bị hủy do khách chưa đặt cọc sau 1 giờ.`
    );
  }
};

const cancelCheckinLateBookings = async () => {
  const oneHourAgo = new Date(Date.now() - 60 * 60 * 1000);
  const bookings = await Booking.find({
    status: "confirmed",
    expected_checkin: { $lte: oneHourAgo },
  });

  for (const booking of bookings) {
    const shortId = booking._id.toString().slice(-6);
    await cancelBookingBySystem(
      booking,
      "cancelled",
      "Tự động hủy: khách không đến sau 1 giờ kể từ thời điểm check-in dự kiến."
    );

    await notifyBookingParties(
      booking,
      "Booking đã bị hủy (check-in trễ)",
      `Booking #${shortId} của bạn đã bị hủy do không đến check-in sau 1 giờ.`,
      `Booking #${shortId} đã bị hủy do khách không đến check-in đúng hạn.`
    );
  }
};

const notifyCheckinReminder = async () => {
  const now = new Date();
  const target = new Date(now.getTime() + 2 * 60 * 60 * 1000);
  const bookings = await Booking.find({
    status: { $in: ["pending", "confirmed"] },
    expected_checkin: {
      $gte: new Date(target.getTime() - 5 * 60 * 1000),
      $lte: new Date(target.getTime() + 5 * 60 * 1000),
    },
  });

  for (const booking of bookings) {
    const shortId = booking._id.toString().slice(-6);
    await notifyBookingParties(
      booking,
      "Nhắc nhở check-in",
      `Booking #${shortId} của bạn còn khoảng 2 giờ nữa sẽ check-in.`,
      `Booking #${shortId} còn khoảng 2 giờ nữa đến giờ check-in.`
    );
  }
};

const notifyCheckoutReminder = async () => {
  const now = new Date();
  const bookings = await Booking.find({
    status: "in_progress",
    expected_checkout: {
      $gte: new Date(now.getTime() - 5 * 60 * 1000),
      $lte: new Date(now.getTime() + 65 * 60 * 1000),
    },
  });

  for (const booking of bookings) {
    const ms = booking.expected_checkout.getTime() - now.getTime();
    let label = null;
    if (ms >= 55 * 60 * 1000 && ms <= 65 * 60 * 1000) label = "1 giờ";
    else if (ms >= 25 * 60 * 1000 && ms <= 35 * 60 * 1000) label = "30 phút";
    else if (ms >= 0 && ms <= 10 * 60 * 1000) label = "5 phút";
    if (!label) continue;

    const shortId = booking._id.toString().slice(-6);
    await notifyBookingParties(
      booking,
      `Nhắc nhở check-out (${label})`,
      `Booking #${shortId} của bạn còn khoảng ${label} nữa sẽ đến giờ check-out.`,
      `Booking #${shortId} còn khoảng ${label} nữa đến giờ check-out.`
    );
  }
};

const notifyDepositDeadlineReminder = async () => {
  const now = new Date();
  const bookings = await Booking.find({
    status: "pending",
    created_at: {
      $gte: new Date(now.getTime() - 65 * 60 * 1000),
      $lte: new Date(now.getTime() + 5 * 60 * 1000),
    },
  });

  for (const booking of bookings) {
    const deadline = new Date(booking.created_at.getTime() + 60 * 60 * 1000);
    const ms = deadline.getTime() - now.getTime();
    let label = null;
    if (ms >= 25 * 60 * 1000 && ms <= 35 * 60 * 1000) label = "30 phút";
    else if (ms >= 15 * 60 * 1000 && ms <= 25 * 60 * 1000) label = "20 phút";
    else if (ms >= 5 * 60 * 1000 && ms <= 15 * 60 * 1000) label = "10 phút";
    else if (ms >= 0 && ms <= 10 * 60 * 1000) label = "5 phút";
    if (!label) continue;

    const shortId = booking._id.toString().slice(-6);
    const receptionistIds = await getReceptionistIds();
    const customer = await getCustomerById(booking.customer_id);
    const title = `Nhắc nhở thanh toán cọc (${label})`;
    const staffContent = `Booking #${shortId} còn ${label} nữa đến hạn thanh toán cọc.`;

    if (customer?.user_id) {
      await sendNotification({
        userId: customer.user_id,
        title,
        content: `Booking #${shortId} của bạn còn ${label} nữa đến hạn thanh toán cọc.`,
        type: "booking",
        kind: "Booking",
        refId: booking._id,
      });
    }

    if (receptionistIds.length) {
      await sendNotificationsToUsers({
        userIds: receptionistIds,
        title,
        content: staffContent,
        type: "booking",
        kind: "Booking",
        refId: booking._id,
      });
    }
  }
};

const notifyCheckinTimeReminder = async () => {
  const now = new Date();
  const bookings = await Booking.find({
    status: "confirmed",
    expected_checkin: {
      $gte: new Date(now.getTime() - 5 * 60 * 1000),
      $lte: new Date(now.getTime() + 35 * 60 * 1000),
    },
  });

  for (const booking of bookings) {
    const ms = booking.expected_checkin.getTime() - now.getTime();
    let label = null;
    if (ms >= 25 * 60 * 1000 && ms <= 35 * 60 * 1000) label = "30 phút";
    else if (ms >= 15 * 60 * 1000 && ms <= 25 * 60 * 1000) label = "20 phút";
    else if (ms >= 5 * 60 * 1000 && ms <= 15 * 60 * 1000) label = "10 phút";
    else if (ms >= 0 && ms <= 10 * 60 * 1000) label = "5 phút";
    if (!label) continue;

    const shortId = booking._id.toString().slice(-6);
    const receptionistIds = await getReceptionistIds();
    const customer = await getCustomerById(booking.customer_id);
    const title = `Nhắc nhở check-in (${label})`;

    if (customer?.user_id) {
      await sendNotification({
        userId: customer.user_id,
        title,
        content: `Booking #${shortId} của bạn còn khoảng ${label} nữa sẽ đến giờ check-in.`,
        type: "booking",
        kind: "Booking",
        refId: booking._id,
      });
    }

    if (receptionistIds.length) {
      await sendNotificationsToUsers({
        userIds: receptionistIds,
        title,
        content: `Booking #${shortId} còn khoảng ${label} nữa đến giờ check-in.`,
        type: "booking",
        kind: "Booking",
        refId: booking._id,
      });
    }
  }
};


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

export const startCheckinReminderJob = () =>
    startCronJob({
      name: "check-in reminder",
      schedule: "*/5 * * * *",
      handler: notifyCheckinReminder,
    });

export const startCheckoutReminderJob = () =>
    startCronJob({
      name: "check-out reminder",
      schedule: "*/5 * * * *",
      handler: notifyCheckoutReminder,
    });

export const startDepositDeadlineReminderJob = () =>
    startCronJob({
      name: "deposit deadline reminder",
      schedule: "*/5 * * * *",
      handler: notifyDepositDeadlineReminder,
    });

export const startCheckinTimeReminderJob = () =>
    startCronJob({
      name: "check-in time reminder",
      schedule: "*/5 * * * *",
      handler: notifyCheckinTimeReminder,
    });
