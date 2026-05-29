// RTM: Cancel booking flow (TC113-CancelBooking-01 .. TC120-CancelBooking-08)
import { BookingService } from "../../main-services/booking-service/services/bookingService.js";
import { makeFullModel, makeDoc, makeNotifiers, oid } from "../helpers/mocks.js";
import { CUSTOMER_EVENTS } from "../../shared/events/customerEvents.js";
import { EMPLOYEE_EVENTS } from "../../shared/events/employeeEvents.js";
import { ROOM_EVENTS } from "../../shared/events/roomEvents.js";
import { USER_EVENTS } from "../../shared/events/userEvents.js";

const CID = oid("c1");
const RID = oid("d1");

const makeRouter = (over = {}) => {
  const map = {
    [ROOM_EVENTS.UPDATE_ROOM_LOG]: { success: true },
    [ROOM_EVENTS.INSERT_ROOM_LOG]: { success: true, roomLogs: [{ _id: "log1" }] },
    [ROOM_EVENTS.UPDATE_ROOM_INFO]: { success: true },
    [CUSTOMER_EVENTS.UPDATE_POINTS]: { success: true },
    [CUSTOMER_EVENTS.CHECK_EXISTS]: { success: true, customer: { user_id: "cu1", full_name: "Guest" } },
    [EMPLOYEE_EVENTS.CHECK_EXISTS]: { found: true, employee: { user_id: "eu1" } },
    [USER_EVENTS.GET_MANAGERS]: { success: true, managers: [] },
    ...over,
  };
  return async (event) => map[event] ?? { success: true };
};

const daysFromNow = (n) => {
  const d = new Date();
  d.setDate(d.getDate() + n);
  return d;
};

let Booking, BookingDetail, BookingStatusLog, BookingCancellation, eventBus, svc;

beforeEach(() => {
  Booking = makeFullModel();
  BookingDetail = makeFullModel();
  BookingStatusLog = makeFullModel();
  BookingCancellation = makeFullModel();
  eventBus = { safeRequest: jest.fn(makeRouter()), publish: jest.fn(), connect: jest.fn() };
  svc = new BookingService({
    Booking, BookingDetail, BookingStatusLog, BookingCancellation, eventBus, ...makeNotifiers(),
  });
  BookingStatusLog.findOneAndUpdate.mockResolvedValue({});
  BookingStatusLog.create.mockResolvedValue({});
  BookingCancellation.create.mockResolvedValue({});
});

const bookingDoc = (over = {}) =>
  makeDoc({
    _id: "bk1",
    status: "confirmed",
    customer_id: CID,
    handled_by: "emp1",
    expected_checkin: daysFromNow(2),
    ...over,
  });

// TC113-CancelBooking-01 — booking must exist
test("TC113-CancelBooking-01: rejects when the booking is not found", async () => {
  Booking.findById.mockResolvedValue(null);
  await expect(svc.cancelBooking("u1", "bk1", "reason", "employee")).rejects.toThrow(
    "Không tìm thấy booking"
  );
});

// TC114-CancelBooking-02 — only pending/confirmed can be cancelled
test("TC114-CancelBooking-02: rejects cancelling a booking not pending/confirmed", async () => {
  Booking.findById.mockResolvedValue(bookingDoc({ status: "checked_in" }));
  await expect(svc.cancelBooking("u1", "bk1", "reason", "employee")).rejects.toThrow(
    "Không thể hủy booking này"
  );
});

// TC115-CancelBooking-03 — cannot cancel after check-in date
test("TC115-CancelBooking-03: rejects cancelling after the check-in date", async () => {
  Booking.findById.mockResolvedValue(bookingDoc({ status: "confirmed", expected_checkin: daysFromNow(-1) }));
  await expect(svc.cancelBooking("u1", "bk1", "reason", "employee")).rejects.toThrow(
    "Không thể hủy booking sau ngày check-in"
  );
});

// TC116-CancelBooking-04 — booking + details set to cancelled
test("TC116-CancelBooking-04: marks the booking and its details cancelled", async () => {
  const booking = bookingDoc();
  Booking.findById.mockResolvedValue(booking);
  const detail = makeDoc({ room_id: RID, status: "confirmed" });
  BookingDetail.find.mockResolvedValue([detail]);

  await svc.cancelBooking("u1", "bk1", "changed plans", "employee");

  expect(booking.status).toBe("cancelled");
  expect(detail.status).toBe("cancelled");
  expect(detail.cancellation_reason).toBe("changed plans");
});

// TC117-CancelBooking-05 — rooms released
test("TC117-CancelBooking-05: releases the rooms with an available room log", async () => {
  Booking.findById.mockResolvedValue(bookingDoc());
  BookingDetail.find.mockResolvedValue([makeDoc({ room_id: RID, status: "confirmed" })]);

  await svc.cancelBooking("u1", "bk1", "reason", "employee");

  const insertCalls = eventBus.safeRequest.mock.calls.filter((c) => c[0] === ROOM_EVENTS.INSERT_ROOM_LOG);
  const released = insertCalls.some((c) => {
    const data = c[1]?.data;
    const arr = Array.isArray(data) ? data : [data];
    return arr.some((l) => l && l.status === "available");
  });
  expect(released).toBe(true);
});

// TC118-CancelBooking-06 — cancellation record created with canceller role
test("TC118-CancelBooking-06: records a cancellation entry with the canceller role", async () => {
  Booking.findById.mockResolvedValue(bookingDoc());
  BookingDetail.find.mockResolvedValue([makeDoc({ room_id: RID, status: "confirmed" })]);

  await svc.cancelBooking("u1", "bk1", "reason", "customer");

  expect(BookingCancellation.create).toHaveBeenCalledWith(
    expect.objectContaining({ cancelled_by: "customer", reason: "reason" })
  );
});

// TC119-CancelBooking-07 — loyalty point penalty
test("TC119-CancelBooking-07: deducts 20 loyalty points on cancellation", async () => {
  Booking.findById.mockResolvedValue(bookingDoc());
  BookingDetail.find.mockResolvedValue([makeDoc({ room_id: RID, status: "confirmed" })]);

  await svc.cancelBooking("u1", "bk1", "reason", "employee");

  const pointsCall = eventBus.safeRequest.mock.calls.find((c) => c[0] === CUSTOMER_EVENTS.UPDATE_POINTS);
  expect(pointsCall).toBeDefined();
  expect(pointsCall[1].points).toBe(-20);
});

// TC120-CancelBooking-08 — cancel a single room and recalculate booking status
test("TC120-CancelBooking-08: cancels a single room and recalculates booking status", async () => {
  Booking.findById.mockResolvedValue(bookingDoc({ status: "confirmed" }));
  const detail = makeDoc({ _id: "det1", room_id: RID, status: "reserved", expected_checkin: daysFromNow(2) });
  BookingDetail.findOne.mockResolvedValue(detail);
  BookingDetail.find.mockResolvedValue([{ status: "cancelled" }]); // all remaining cancelled

  await svc.cancelBookingDetail("u1", "bk1", "det1", "reason", "employee");

  expect(detail.status).toBe("cancelled");
});
