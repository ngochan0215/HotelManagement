// RTM: View and export statistics (TC094-Statistics-01 .. TC101-Statistics-08)
import { BookingStatisticService } from "../../main-services/booking-service/services/statisticService.js";
import { CustomerService } from "../../main-services/customer-service/services/customerService.js";
import { makeFullModel, makeDoc, makeEventBus, makeQuery } from "../helpers/mocks.js";

let Booking, BookingDetail, BookingStatusLog, BookingCancellation, eventBus, stat;
let Customer, custBus, customerSvc;

beforeEach(() => {
  Booking = makeFullModel();
  BookingDetail = makeFullModel();
  BookingStatusLog = makeFullModel();
  BookingCancellation = makeFullModel();
  eventBus = makeEventBus();
  stat = new BookingStatisticService({ Booking, BookingDetail, BookingStatusLog, BookingCancellation, eventBus });

  Customer = makeFullModel();
  custBus = makeEventBus();
  customerSvc = new CustomerService({ Customer, PointsLog: makeFullModel(), eventBus: custBus });
});

const FROM = "2026-01-01";
const TO = "2026-01-31";

// TC094-Statistics-01 — date range is validated
test("TC094-Statistics-01: rejects an invalid date in the report range", async () => {
  await expect(stat.getCancellationReasonStats({ fromDate: "not-a-date" })).rejects.toThrow(
    "Thời gian bắt đầu không hợp lệ"
  );
});

// TC095-Statistics-02 — booking report aggregates revenue/summary
test("TC095-Statistics-02: aggregates revenue and summary figures for the range", async () => {
  const booking = { _id: "b1", total_fee: 500000, created_at: new Date("2026-01-10") };
  Booking.find.mockReturnValue(makeQuery([booking]));
  BookingDetail.find.mockReturnValue(makeQuery([]));
  BookingStatusLog.aggregate.mockResolvedValue([{ _id: "b1", status: "completed" }]);

  const report = await stat.generateBookingReport(FROM, TO);

  expect(report.summary.total_bookings).toBe(1);
  expect(report.summary.completed).toBe(1);
  expect(report.summary.total_revenue).toBe(500000);
});

// TC096-Statistics-03 — dashboard rendering (front-end / manual)
test.todo("TC096-Statistics-03: dashboard displays the summary metrics (UI/manual)");

// TC097-Statistics-04 — export booking report to Excel
test("TC097-Statistics-04: exports the booking report as an Excel workbook", async () => {
  Booking.find.mockReturnValue(makeQuery([]));
  BookingDetail.find.mockReturnValue(makeQuery([]));
  BookingStatusLog.aggregate.mockResolvedValue([]);

  const wb = await stat.exportBookingReportExcel(FROM, TO);
  const names = wb.worksheets.map((w) => w.name);
  expect(names).toContain("Tổng quan");
});

// TC098-Statistics-05 — export booking report to PDF
test("TC098-Statistics-05: exports the booking report as a PDF document", async () => {
  Booking.find.mockReturnValue(makeQuery([]));
  BookingDetail.find.mockReturnValue(makeQuery([]));
  BookingStatusLog.aggregate.mockResolvedValue([]);

  const doc = await stat.exportBookingReportPDF(FROM, TO);
  expect(typeof doc.pipe).toBe("function");
});

// TC099-Statistics-06 — room status statistics (separate roomStatisticService)
test.todo("TC099-Statistics-06: room status summary & top-booked categories (roomStatisticService)");

// TC100-Statistics-07 — export customer report to Excel
test("TC100-Statistics-07: exports the customer report as an Excel workbook", async () => {
  Customer.find.mockReturnValue(makeQuery([]));
  custBus.safeRequest
    .mockResolvedValueOnce({ success: true, bookings: [] }) // GET_BOOKINGS_CUSTOMER_REPORT
    .mockResolvedValueOnce({ success: true, logs: [] }); // GET_LOGS_CUSTOMER_REPORT

  const wb = await customerSvc.exportCustomerReportExcel(FROM, TO);
  const names = wb.worksheets.map((w) => w.name);
  expect(names).toContain("Summary");
});

// TC101-Statistics-08 — empty range returns zeroed totals
test("TC101-Statistics-08: handles an empty range with zeroed totals", async () => {
  Booking.find.mockReturnValue(makeQuery([]));
  BookingDetail.find.mockReturnValue(makeQuery([]));
  BookingStatusLog.aggregate.mockResolvedValue([]);

  const report = await stat.generateBookingReport(FROM, TO);
  expect(report.summary.total_bookings).toBe(0);
  expect(report.summary.total_revenue).toBe(0);
  expect(report.summary.cancel_rate).toBe(0);
});
