// RTM: Update employee (TC020-UpdateEmployee-01 .. TC027-UpdateEmployee-08)
import { EmployeeService } from "../../main-services/employee-service/services/employeeService.js";
import { makeFullModel, makeDoc, makeEventBus, makeQuery } from "../helpers/mocks.js";
import { cache } from "../mocks.js";

const employeeDoc = (over = {}) =>
  makeDoc({
    _id: "e1",
    user_id: "u1",
    full_name: "Old Name",
    phone_number: "0901111111",
    CCCD: "012345678901",
    position: "receptionist",
    status: "working",
    fixed_salary: 40000,
    ...over,
  });

let Employee, eventBus, svc;

beforeEach(() => {
  Employee = makeFullModel();
  eventBus = makeEventBus();
  svc = new EmployeeService({ Employee, eventBus });
});

// TC020-UpdateEmployee-01 — employee must exist
test("TC020-UpdateEmployee-01: rejects when the employee id is not found", async () => {
  Employee.findById.mockReturnValue(makeQuery(null));
  await expect(svc.updateEmployee("missing", { full_name: "X" })).rejects.toThrow(
    "Không tìm thấy nhân viên"
  );
});

// TC021-UpdateEmployee-02 — status must be valid
test("TC021-UpdateEmployee-02: rejects an invalid status", async () => {
  Employee.findById.mockReturnValue(makeQuery(employeeDoc()));
  await expect(svc.updateEmployee("e1", { status: "vacation" })).rejects.toThrow(
    "Trạng thái không hợp lệ"
  );
});

// TC022-UpdateEmployee-03 — position must be valid
test("TC022-UpdateEmployee-03: rejects an invalid position", async () => {
  Employee.findById.mockReturnValue(makeQuery(employeeDoc()));
  await expect(svc.updateEmployee("e1", { position: "astronaut" })).rejects.toThrow(
    "Vị trí không hợp lệ"
  );
});

// TC023-UpdateEmployee-04 — email uniqueness on change
test("TC023-UpdateEmployee-04: rejects changing to an email already in use", async () => {
  Employee.findById.mockReturnValue(makeQuery(employeeDoc()));
  eventBus.safeRequest
    .mockResolvedValueOnce({ found: true, user: { email: "old@hotel.com" } }) // GET_USER_INFO
    .mockResolvedValueOnce({ found: true }); // CHECK_EXISTED_EMAIL -> taken
  await expect(svc.updateEmployee("e1", { email: "taken@hotel.com" })).rejects.toThrow(
    "Email đã tồn tại"
  );
});

// TC024-UpdateEmployee-05 — CCCD format + uniqueness
test("TC024-UpdateEmployee-05: validates CCCD format and uniqueness", async () => {
  Employee.findById.mockReturnValue(makeQuery(employeeDoc()));
  await expect(svc.updateEmployee("e1", { CCCD: "123" })).rejects.toThrow(
    "CCCD không hợp lệ"
  );

  Employee.findById.mockReturnValue(makeQuery(employeeDoc()));
  Employee.findOne.mockResolvedValue(makeDoc({ CCCD: "999999999999" })); // already used
  await expect(svc.updateEmployee("e1", { CCCD: "999999999999" })).rejects.toThrow(
    "CCCD đã tồn tại"
  );
});

// TC025-UpdateEmployee-06 — phone format + uniqueness
test("TC025-UpdateEmployee-06: validates phone format and uniqueness", async () => {
  Employee.findById.mockReturnValue(makeQuery(employeeDoc()));
  await expect(svc.updateEmployee("e1", { phone_number: "12345" })).rejects.toThrow(
    "Số điện thoại không hợp lệ"
  );

  Employee.findById.mockReturnValue(makeQuery(employeeDoc()));
  Employee.findOne.mockResolvedValue(makeDoc({ phone_number: "0902222222" }));
  await expect(svc.updateEmployee("e1", { phone_number: "0902222222" })).rejects.toThrow(
    "Số điện thoại đã tồn tại"
  );
});

// TC026-UpdateEmployee-07 — valid changes persist
test("TC026-UpdateEmployee-07: saves valid changes and returns the employee", async () => {
  const doc = employeeDoc();
  Employee.findById.mockReturnValue(makeQuery(doc));

  const result = await svc.updateEmployee("e1", { full_name: "Updated Name", fixed_salary: 55000 });

  expect(doc.save).toHaveBeenCalled();
  expect(result.full_name).toBe("Updated Name");
  expect(result.fixed_salary).toBe(55000);
});

// TC027-UpdateEmployee-08 — caches invalidated after update
test("TC027-UpdateEmployee-08: clears employee caches after a successful update", async () => {
  const doc = employeeDoc();
  Employee.findById.mockReturnValue(makeQuery(doc));

  await svc.updateEmployee("e1", { full_name: "Updated Name" });

  expect(cache.del).toHaveBeenCalledWith("emp:one:e1");
  expect(cache.delByPattern).toHaveBeenCalledWith("emp:list:*");
});
