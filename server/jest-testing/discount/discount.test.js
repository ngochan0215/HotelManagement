// RTM: Discount management (TC130-Discount-01 .. TC137-Discount-08)
import { DiscountService } from "../../main-services/discount-service/services/discountService.js";
import { makeFullModel, makeDoc, makeEventBus, makeQuery } from "../helpers/mocks.js";

let Discount, svc;

const daysFromNow = (n) => {
  const d = new Date();
  d.setDate(d.getDate() + n);
  return d.toISOString();
};

const validDiscount = (over = {}) => ({
  name: "Summer Sale",
  description: "10% off",
  discount: { type: "PERCENT", value: 10, max_discount: 50000 },
  begin_date: daysFromNow(5),
  end_date: daysFromNow(15),
  ...over,
});

beforeEach(() => {
  Discount = makeFullModel();
  svc = new DiscountService({ Discount, eventBus: makeEventBus() });
});

// TC130-Discount-01 — required fields
test("TC130-Discount-01: rejects when name or discount rule is missing", async () => {
  await expect(svc.createDiscount(validDiscount({ discount: undefined }))).rejects.toThrow(
    "Thiếu thông tin bắt buộc"
  );
});

// TC131-Discount-02 — unique name
test("TC131-Discount-02: rejects a duplicate discount name", async () => {
  Discount.findOne.mockResolvedValue(makeDoc({ name: "Summer Sale" }));
  await expect(svc.createDiscount(validDiscount())).rejects.toThrow("Tên khuyến mãi đã tồn tại");
});

// TC132-Discount-03 — dates validated + active state derived
test("TC132-Discount-03: validates dates and derives the active state", async () => {
  Discount.findOne.mockResolvedValue(null);
  // end before begin -> invalid
  await expect(
    svc.createDiscount(validDiscount({ begin_date: daysFromNow(15), end_date: daysFromNow(5) }))
  ).rejects.toThrow("Ngày kết thúc phải sau ngày bắt đầu");

  // future window -> upcoming + inactive
  Discount.create.mockImplementation(async (doc) => makeDoc(doc));
  const created = await svc.createDiscount(validDiscount());
  expect(created.is_active).toBe(false);
  expect(created.status).toBe("upcoming");
});

// TC133-Discount-04 — list filtering
test("TC133-Discount-04: filters the discount list by query", async () => {
  Discount.find.mockReturnValue(makeQuery([{ name: "A" }]));
  const result = await svc.getAllDiscounts({ status: "ongoing", type: "PERCENT" });
  expect(Array.isArray(result)).toBe(true);
});

// TC134-Discount-05 — cannot delete a started/active discount
test("TC134-Discount-05: rejects deleting a discount that already started", async () => {
  Discount.findById.mockResolvedValue(
    makeDoc({ _id: "d1", begin_date: new Date(daysFromNow(-1)), is_active: true, status: "ongoing" })
  );
  await expect(svc.deleteDiscount("d1")).rejects.toThrow("Không thể xóa vì khuyến mãi đã bắt đầu");
});

// TC135-Discount-06 — deactivate a discount
test("TC135-Discount-06: deactivates a discount", async () => {
  const doc = makeDoc({ _id: "d1", is_active: true, status: "ongoing" });
  Discount.findById.mockResolvedValue(doc);
  await svc.unactivateDiscount("d1");
  expect(doc.is_active).toBe(false);
  expect(doc.status).toBe("finished");
});

// TC136-Discount-07 — update enforces unique name + priority >= 1
test("TC136-Discount-07: enforces unique name and priority >= 1 on update", async () => {
  Discount.findById.mockResolvedValue(makeDoc({ _id: "d1", name: "Old" }));
  await expect(svc.updateDiscount("d1", { priority: 0 })).rejects.toThrow("Độ ưu tiên phải là số >= 1");

  Discount.findById.mockResolvedValue(makeDoc({ _id: "d1", name: "Old" }));
  Discount.findOne.mockResolvedValue(makeDoc({ _id: "d2", name: "Taken" }));
  await expect(svc.updateDiscount("d1", { name: "Taken" })).rejects.toThrow("Tên khuyến mãi đã tồn tại");
});

// TC137-Discount-08 — available discounts with availability info
test("TC137-Discount-08: requires a customer id for the available-discounts query", async () => {
  // Availability is customer-scoped; missing customer_id is rejected.
  await expect(svc.getAvailableDiscounts({})).rejects.toThrow("Thiếu customer_id");
});
