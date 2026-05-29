// RTM: Update customer loyalty (TC054-CustomerLoyalty-01 .. TC061-CustomerLoyalty-08)
import { CustomerService } from "../../main-services/customer-service/services/customerService.js";
import { makeFullModel, makeDoc, makeEventBus, oid } from "../helpers/mocks.js";

let Customer, PointsLog, svc;

beforeEach(() => {
  Customer = makeFullModel();
  PointsLog = makeFullModel();
  svc = new CustomerService({ Customer, PointsLog, eventBus: makeEventBus() });
});

const CID = oid("c1");

// TC054-CustomerLoyalty-01 — customer id must be valid
test("TC054-CustomerLoyalty-01: rejects an invalid customer id", async () => {
  await expect(
    svc.updateCustomerPoints({ customer_id: "not-an-id", points: 10, reason: "x" })
  ).rejects.toThrow("customer_id không hợp lệ");
});

// TC055-CustomerLoyalty-02 — points must be a non-zero integer
test("TC055-CustomerLoyalty-02: rejects a zero or non-integer points value", async () => {
  await expect(
    svc.updateCustomerPoints({ customer_id: CID, points: 0, reason: "x" })
  ).rejects.toThrow("points phải là số nguyên khác 0");
  await expect(
    svc.updateCustomerPoints({ customer_id: CID, points: 1.5, reason: "x" })
  ).rejects.toThrow("points phải là số nguyên khác 0");
});

// TC056-CustomerLoyalty-03 — reason is required
test("TC056-CustomerLoyalty-03: rejects when reason is missing", async () => {
  await expect(
    svc.updateCustomerPoints({ customer_id: CID, points: 10 })
  ).rejects.toThrow("reason là bắt buộc");
});

// TC057-CustomerLoyalty-04 — customer must exist
test("TC057-CustomerLoyalty-04: rejects when the customer does not exist", async () => {
  Customer.findById.mockResolvedValue(null);
  await expect(
    svc.updateCustomerPoints({ customer_id: CID, points: 10, reason: "earn" })
  ).rejects.toThrow("Không tìm thấy customer");
});

// TC058-CustomerLoyalty-05 — balance floors at 0
test("TC058-CustomerLoyalty-05: never lets the points balance go negative", async () => {
  Customer.findById.mockResolvedValue(makeDoc({ _id: CID, user_id: "u1", points: 10 }));
  PointsLog.create.mockResolvedValue({});

  const result = await svc.updateCustomerPoints({ customer_id: CID, points: -50, reason: "deduct" });
  expect(result.after).toBe(0);
});

// TC059-CustomerLoyalty-06 — points change is logged
test("TC059-CustomerLoyalty-06: records the change in a PointsLog", async () => {
  Customer.findById.mockResolvedValue(makeDoc({ _id: CID, user_id: "u1", points: 100 }));
  PointsLog.create.mockResolvedValue({});

  await svc.updateCustomerPoints({ customer_id: CID, points: 30, reason: "earn" });

  expect(PointsLog.create).toHaveBeenCalledWith(
    expect.objectContaining({ points_before: 100, points_after: 130, points_change: 30 })
  );
});

// TC060-CustomerLoyalty-07 — tier thresholds
test("TC060-CustomerLoyalty-07: resolves the loyalty tier from booking_count and points", () => {
  expect(svc.calculateMembershipTier({ booking_count: 20, points: 5000 })).toBe("platinum");
  expect(svc.calculateMembershipTier({ booking_count: 10, points: 2000 })).toBe("gold");
  expect(svc.calculateMembershipTier({ booking_count: 5, points: 500 })).toBe("silver");
  expect(svc.calculateMembershipTier({ booking_count: 1, points: 50 })).toBe("bronze");
});

// TC061-CustomerLoyalty-08 — tier saved only when it changes
describe("TC061-CustomerLoyalty-08: tier updated only when it differs", () => {
  test("does not save when the tier is unchanged", async () => {
    const doc = makeDoc({ _id: CID, user_id: "u1", loyalty: "bronze", booking_count: 0, points: 10 });
    Customer.findById.mockResolvedValue(doc);
    const tier = await svc.updateCustomerTier(CID);
    expect(tier).toBe("bronze");
    expect(doc.save).not.toHaveBeenCalled();
  });

  test("saves when the tier changes", async () => {
    const doc = makeDoc({ _id: CID, user_id: "u1", loyalty: "bronze", booking_count: 20, points: 5000 });
    Customer.findById.mockResolvedValue(doc);
    const tier = await svc.updateCustomerTier(CID);
    expect(tier).toBe("platinum");
    expect(doc.save).toHaveBeenCalled();
  });
});
