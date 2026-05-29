// RTM: PayOS payment flow (TC033-Payment-01 .. TC044-Payment-12)
// TransactionService with a mocked PayOS gateway, Receipt/Transaction models and
// event bus. enrichTransactionDetail (receipt/booking joins) is spied out so each
// test focuses on the transaction/receipt state transitions.
import { TransactionService } from "../../main-services/payment-service/services/transactionService.js";
import { findPendingCompensationTickets } from "../mocks.js";
import { makeFullModel, makeDoc, makeEventBus, makeQuery } from "../helpers/mocks.js";

let Receipt, Transaction, paymentGateway, eventBus, svc;

beforeEach(() => {
  Receipt = makeFullModel();
  Transaction = makeFullModel();
  paymentGateway = {
    createPaymentRequest: jest.fn(async () => ({ data: { id: "payos-1", checkoutUrl: "http://pay" } })),
    getPaymentRequest: jest.fn(async () => ({ data: { id: "payos-1" } })),
  };
  eventBus = makeEventBus();
  svc = new TransactionService({
    Receipt,
    Transaction,
    paymentGateway,
    eventBus,
    sendNotification: jest.fn(),
    sendNotificationsToUsers: jest.fn(),
  });
  // Isolate from receipt/booking enrichment.
  jest.spyOn(svc, "enrichTransactionDetail").mockResolvedValue({ enriched: true });
});

// TC033-Payment-01 — amount must be valid
test("TC033-Payment-01: rejects a missing/invalid amount", async () => {
  await expect(svc.createPayment({ booking_id: "bk1" }, "u1")).rejects.toThrow(
    "Invalid amount for PayOS payment"
  );
});

// TC034-Payment-02 — a pending transaction record is created with an order code
test("TC034-Payment-02: creates a pending transaction with an order code", async () => {
  Transaction.create.mockResolvedValue(makeDoc({ _id: "t1" }));
  await svc.createPayment({ booking_id: "bk1", amount: 100000 }, "u1");

  expect(Transaction.create).toHaveBeenCalledWith(
    expect.objectContaining({ status: "pending", amount: 100000, user_id: "u1" })
  );
  const arg = Transaction.create.mock.calls[0][0];
  expect(typeof arg.booking_code).toBe("number");
});

// TC035-Payment-03 — PayOS link built with return/cancel URLs + 15-min expiry
test("TC035-Payment-03: builds a PayOS link with return/cancel URLs and a 15-minute expiry", async () => {
  Transaction.create.mockResolvedValue(makeDoc({ _id: "t1" }));
  const before = Math.floor(Date.now() / 1000);
  await svc.createPayment({ booking_id: "bk1", amount: 100000 }, "u1");

  expect(paymentGateway.createPaymentRequest).toHaveBeenCalledTimes(1);
  const payload = paymentGateway.createPaymentRequest.mock.calls[0][0];
  expect(payload.returnUrl).toContain("/payment/success");
  expect(payload.cancelUrl).toContain("/payment/cancel");
  // ~15 minutes (900s) ahead.
  expect(payload.expiredAt).toBeGreaterThanOrEqual(before + 890);
  expect(payload.expiredAt).toBeLessThanOrEqual(before + 910);
});

// TC036-Payment-04 — payment link data is returned to the caller
test("TC036-Payment-04: returns the PayOS payment link data", async () => {
  Transaction.create.mockResolvedValue(makeDoc({ _id: "t1" }));
  const data = await svc.createPayment({ booking_id: "bk1", amount: 100000 }, "u1");
  expect(data).toMatchObject({ id: "payos-1", checkoutUrl: "http://pay" });
});

// TC037-Payment-05 — successful payment marks the transaction completed
test("TC037-Payment-05: marks the transaction completed on success", async () => {
  const txn = makeDoc({ booking_code: 123, status: "pending", amount: 50000, booking_id: "bk1" });
  Transaction.findOne.mockResolvedValue(txn);
  Receipt.findOne.mockResolvedValue(
    makeDoc({ status: "pending", deposit_amount: 50000, amount_due: 150000, final_amount: 200000, booking_id: "bk1" })
  );
  eventBus.safeRequest.mockResolvedValue({ success: true, booking: { status: "pending" } });

  await svc.paymentSucceeded(123);

  expect(txn.status).toBe("completed");
  expect(txn.completed_at).toBeInstanceOf(Date);
});

// TC038-Payment-06 — already-completed transaction is not reprocessed
test("TC038-Payment-06: an already-completed transaction is returned without reprocessing", async () => {
  const txn = makeDoc({ booking_code: 123, status: "completed", amount: 50000 });
  Transaction.findOne.mockResolvedValue(txn);
  Receipt.findById.mockResolvedValue(null);

  await svc.paymentSucceeded(123);
  expect(txn.save).not.toHaveBeenCalled();
});

// TC039-Payment-07 — a deposit payment confirms the booking reservation
test("TC039-Payment-07: a deposit payment asks booking-service to confirm the reservation", async () => {
  const txn = makeDoc({ booking_code: 123, status: "pending", amount: 50000, booking_id: "bk1" });
  Transaction.findOne.mockResolvedValue(txn);
  Receipt.findOne.mockResolvedValue(
    makeDoc({ status: "pending", deposit_amount: 50000, amount_due: 150000, final_amount: 200000, booking_id: "bk1" })
  );
  eventBus.safeRequest.mockResolvedValue({ success: true, booking: { status: "pending" } });

  await svc.paymentSucceeded(123);

  const confirmedWithBooking = eventBus.safeRequest.mock.calls.some(
    ([, payload]) => payload && payload.bookingId === "bk1"
  );
  expect(confirmedWithBooking).toBe(true);
});

// TC040-Payment-08 — full payment marks the receipt paid
test("TC040-Payment-08: full payment sets the receipt to paid with amount_due=0", async () => {
  const txn = makeDoc({ booking_code: 123, status: "pending", amount: 200000, booking_id: "bk1" });
  Transaction.findOne.mockResolvedValue(txn);
  const receipt = makeDoc({
    status: "pending", deposit_amount: 0, amount_due: 200000, final_amount: 200000, booking_id: "bk1",
  });
  Receipt.findOne.mockResolvedValue(receipt);
  eventBus.safeRequest.mockResolvedValue({ success: true, booking: { status: "confirmed" } });

  await svc.paymentSucceeded(123);

  expect(receipt.status).toBe("paid");
  expect(receipt.amount_due).toBe(0);
  expect(receipt.paid_at).toBeInstanceOf(Date);
});

// TC041-Payment-09 — partial payment marks the receipt half-paid
test("TC041-Payment-09: partial payment sets the receipt half-paid with the remaining due", async () => {
  const txn = makeDoc({ booking_code: 123, status: "pending", amount: 50000, booking_id: "bk1" });
  Transaction.findOne.mockResolvedValue(txn);
  const receipt = makeDoc({
    status: "pending", deposit_amount: 50000, amount_due: 150000, final_amount: 200000, booking_id: "bk1",
  });
  Receipt.findOne.mockResolvedValue(receipt);
  eventBus.safeRequest.mockResolvedValue({ success: true, booking: { status: "pending" } });

  await svc.paymentSucceeded(123);

  expect(receipt.status).toBe("half-paid");
  expect(receipt.amount_due).toBe(100000); // final 200k - (deposit 50k + paid 50k)
});

// TC042-Payment-10 — fully paid receipt settles pending compensation tickets
test("TC042-Payment-10: settles pending compensation tickets when the receipt is fully paid", async () => {
  const txn = makeDoc({ booking_code: 123, status: "pending", amount: 200000, booking_id: "bk1" });
  Transaction.findOne.mockResolvedValue(txn);
  const receipt = makeDoc({
    status: "pending", deposit_amount: 0, amount_due: 200000, final_amount: 200000,
    booking_id: "bk1", compensate_fee: 80000,
  });
  Receipt.findOne.mockResolvedValue(receipt);
  eventBus.safeRequest.mockResolvedValue({ success: true, booking: { status: "confirmed" } });
  const ticket = makeDoc({ status: "pending" });
  findPendingCompensationTickets.mockResolvedValueOnce([ticket]);

  await svc.paymentSucceeded(123);

  expect(ticket.status).toBe("paid");
  expect(ticket.paid_at).toBeInstanceOf(Date);
});

// TC043-Payment-11 — failed payment marks the transaction failed
test("TC043-Payment-11: marks the transaction failed with a reason", async () => {
  const txn = makeDoc({ booking_code: 123, status: "pending" });
  Transaction.findOne.mockResolvedValue(txn);
  Receipt.findById.mockResolvedValue(null);
  Receipt.findOne.mockResolvedValue(null);

  await svc.paymentFailed(123);

  expect(txn.status).toBe("failed");
  expect(txn.failed_reason).toBeTruthy();
});

// TC044-Payment-12 — payment detail can be retrieved by order code
test("TC044-Payment-12: retrieves payment detail by order/booking code", async () => {
  Transaction.findOne.mockReturnValue(makeQuery(makeDoc({ booking_code: 123 })));
  const detail = await svc.getPaymentDetail(123);
  expect(Transaction.findOne).toHaveBeenCalled();
  expect(detail).toEqual({ enriched: true });
});
