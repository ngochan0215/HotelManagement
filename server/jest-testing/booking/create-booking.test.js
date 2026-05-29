// RTM: Create booking flow (TC102-CreateBooking-01 .. TC112-CreateBooking-11)
// Covers the staff flow (createBooking), the customer flow (createCustomerBooking)
// and deposit confirmation (confirmBooking). All inter-service calls go through a
// single mocked event bus driven by a small router keyed on the event name.
import { BookingService } from "../../main-services/booking-service/services/bookingService.js";
import { makeFullModel, makeDoc, makeNotifiers, oid } from "../helpers/mocks.js";
import { CUSTOMER_EVENTS } from "../../shared/events/customerEvents.js";
import { EMPLOYEE_EVENTS } from "../../shared/events/employeeEvents.js";
import { ROOM_EVENTS } from "../../shared/events/roomEvents.js";
import { PAYMENT_EVENTS } from "../../shared/events/paymentEvents.js";
import { DISCOUNT_EVENTS } from "../../shared/events/discountEvents.js";
import { USER_EVENTS } from "../../shared/events/userEvents.js";

const CID = oid("c1");
const RID = oid("d1");

// Build a safeRequest router: defaults that make the happy path succeed, with
// per-test overrides keyed by event name.
const makeRouter = (over = {}) => {
  const map = {
    [CUSTOMER_EVENTS.CHECK_EXISTS]: { success: true, customer: { _id: CID, user_id: "cu1", full_name: "Guest" } },
    [CUSTOMER_EVENTS.CHECK_EXISTS_USERID]: { found: true, customer: { _id: CID, user_id: "cu1", full_name: "Guest" } },
    [EMPLOYEE_EVENTS.CHECK_EXISTS_USERID]: { found: true, employee: { _id: "emp1", user_id: "eu1" } },
    [EMPLOYEE_EVENTS.CHECK_EXISTS]: { found: true, employee: { _id: "emp1", user_id: "eu1" } },
    [EMPLOYEE_EVENTS.GET_RECEPTIONISTS]: { found: false },
    [ROOM_EVENTS.CHECK_EXISTS]: { found: true, room: { _id: RID, room_status: "available", room_number: "101" } },
    [ROOM_EVENTS.GET_ROOMS_INFO]: { rooms: [{ _id: RID, room_number: "101", category_id: { max_adults: 2, max_children: 1, price: 100 } }] },
    [ROOM_EVENTS.FIND_ROOM_LOGS]: { success: true, roomLogs: [] },
    [ROOM_EVENTS.UPDATE_ROOM_INFO]: { success: true },
    [ROOM_EVENTS.UPDATE_ROOM_LOG]: { success: true },
    [ROOM_EVENTS.INSERT_ROOM_LOG]: { success: true, roomLogs: [{ _id: "log1" }] },
    [PAYMENT_EVENTS.CREATE_RECEIPT]: { success: true },
    [DISCOUNT_EVENTS.GET_ACTIVE_DISCOUNTS]: { discounts: [] },
    [USER_EVENTS.GET_MANAGERS]: { success: true, managers: [] },
    ...over,
  };
  return async (event) => map[event] ?? { success: true };
};

const daysFromNow = (n) => {
  const d = new Date();
  d.setDate(d.getDate() + n);
  return d.toISOString();
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
  Booking.create.mockResolvedValue(makeDoc({ _id: "bk1" }));
  BookingDetail.insertMany.mockResolvedValue([]);
  BookingStatusLog.create.mockResolvedValue({});
});

const staffPayload = (over = {}) => ({
  customer_id: CID,
  adults: 2,
  children: 0,
  deposit: 100,
  total_fee: 300,
  rooms: [{ room_id: RID, base_fee: 100 }],
  expected_checkin: daysFromNow(1),
  expected_checkout: daysFromNow(3),
  ...over,
});

// TC102-CreateBooking-01 — booking form display (front-end / manual)
test.todo("TC102-CreateBooking-01: booking form displays customer/dates/guests/rooms (UI/manual)");

// TC103-CreateBooking-02 — required fields
test("TC103-CreateBooking-02: rejects when required fields are missing", async () => {
  await expect(svc.createBooking("eu1", staffPayload({ customer_id: undefined }))).rejects.toThrow(
    "Phải điền đầy đủ các thông tin bắt buộc"
  );
});

// TC104-CreateBooking-03 — date order / not in the past
test("TC104-CreateBooking-03: rejects when checkout is before checkin", async () => {
  await expect(
    svc.createBooking("eu1", staffPayload({ expected_checkin: daysFromNow(3), expected_checkout: daysFromNow(1) }))
  ).rejects.toThrow("Ngày check-out dự kiến phải sau");
});

// TC105-CreateBooking-04 — at least one room
test("TC105-CreateBooking-04: rejects when no room is selected", async () => {
  await expect(svc.createBooking("eu1", staffPayload({ rooms: [] }))).rejects.toThrow(
    "Phải đặt ít nhất một phòng"
  );
});

// TC106-CreateBooking-05 — selected room must be available
test("TC106-CreateBooking-05: rejects when a selected room is not available", async () => {
  eventBus.safeRequest.mockImplementation(
    makeRouter({ [ROOM_EVENTS.CHECK_EXISTS]: { found: true, room: { _id: RID, room_status: "occupied", room_number: "101" } } })
  );
  await expect(svc.createBooking("eu1", staffPayload())).rejects.toThrow("đang không trống");
});

// TC107-CreateBooking-06 — combined capacity (customer flow)
test("TC107-CreateBooking-06: rejects when guests exceed combined room capacity", async () => {
  await expect(
    svc.createCustomerBooking("cu1", {
      expected_checkin: daysFromNow(1),
      expected_checkout: daysFromNow(3),
      adults: 5, // capacity is 2
      children: 0,
      rooms: [{ room_id: RID }],
    })
  ).rejects.toThrow("vượt quá sức chứa");
});

// TC108-CreateBooking-07 — invalid discount is rejected
test("TC108-CreateBooking-07: rejects an invalid discount id", async () => {
  await expect(svc.createBooking("eu1", staffPayload({ discount_id: "bad-id" }))).rejects.toThrow(
    "ID Khuyến mãi không hợp lệ"
  );
});

// TC109-CreateBooking-08 — creates booking + details + room logs + receipt
test("TC109-CreateBooking-08: creates the booking, details, room logs and receipt", async () => {
  await svc.createBooking("eu1", staffPayload());

  expect(Booking.create).toHaveBeenCalled();
  expect(BookingDetail.insertMany).toHaveBeenCalled();
  const events = eventBus.safeRequest.mock.calls.map((c) => c[0]);
  expect(events).toContain(ROOM_EVENTS.INSERT_ROOM_LOG);
  expect(events).toContain(PAYMENT_EVENTS.CREATE_RECEIPT);
});

// TC110-CreateBooking-09 — customer deposit is 30% of the total fee
test("TC110-CreateBooking-09: customer-flow deposit equals 30% of the total fee", async () => {
  // 1 room x price 100 x 2 nights = 200 total -> deposit ceil(200*0.3) = 60
  await svc.createCustomerBooking("cu1", {
    expected_checkin: daysFromNow(1),
    expected_checkout: daysFromNow(3),
    adults: 2,
    children: 0,
    rooms: [{ room_id: RID }],
  });

  expect(Booking.create).toHaveBeenCalledWith(
    expect.objectContaining({ total_fee: 200, deposit: 60 })
  );
});

// TC111-CreateBooking-10 — zero-deposit booking auto check-in
test("TC111-CreateBooking-10: a zero-deposit booking is created in_progress (auto check-in)", async () => {
  await svc.createBooking("eu1", staffPayload({ deposit: 0 }));
  expect(Booking.create).toHaveBeenCalledWith(expect.objectContaining({ status: "in_progress" }));
});

// TC112-CreateBooking-11 — booking confirmed and rooms booked after deposit
test("TC112-CreateBooking-11: confirms the booking and books its rooms after deposit", async () => {
  const booking = makeDoc({
    _id: "bk1", status: "pending", customer_id: CID, handled_by: "emp1",
    expected_checkin: new Date(daysFromNow(1)), expected_checkout: new Date(daysFromNow(3)),
  });
  Booking.findById.mockResolvedValue(booking);
  BookingDetail.find.mockResolvedValue([
    { booking_id: "bk1", room_id: RID, expected_checkin: new Date(daysFromNow(1)), expected_checkout: new Date(daysFromNow(3)) },
  ]);
  BookingStatusLog.findOneAndUpdate.mockResolvedValue({});
  BookingDetail.updateMany.mockResolvedValue({});

  const result = await svc.confirmBooking("bk1", "emp1");

  expect(result.status).toBe("confirmed");
  const insertCalls = eventBus.safeRequest.mock.calls.filter((c) => c[0] === ROOM_EVENTS.INSERT_ROOM_LOG);
  const bookedLog = insertCalls.some((c) => {
    const data = c[1]?.data;
    const arr = Array.isArray(data) ? data : [data];
    return arr.some((l) => l && l.status === "booked");
  });
  expect(bookedLog).toBe(true);
});
