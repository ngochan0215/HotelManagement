// RTM: Add new employee (TC010-AddEmployee-01 .. TC019-AddEmployee-10)
// Spans AuthService.register (account-level validation + atomic create/rollback)
// and EmployeeService.createEmployee (employee-record uniqueness + position).
import { AuthService } from "../../main-services/auth-service/services/authService.js";
import { EmployeeService } from "../../main-services/employee-service/services/employeeService.js";
import { makeFullModel, makeDoc, makeEventBus } from "../helpers/mocks.js";

// A complete, valid employee registration payload (DOB clearly over 18).
const validReg = (over = {}) => ({
  email: "newstaff@hotel.com",
  password: "Str0ng@Pass",
  date_birth: "1995-04-10",
  full_name: "New Staff",
  phone_number: "0901234567",
  CCCD: "012345678901",
  system_role: "employee",
  position: "receptionist",
  fixed_salary: 50000,
  ...over,
});

let User, eventBus, auth;
let Employee, empBus, employeeSvc;

beforeEach(() => {
  User = makeFullModel();
  eventBus = makeEventBus();
  auth = new AuthService({
    User,
    mailService: { sendVerificationEmail: jest.fn(), sendResetPasswordEmail: jest.fn() },
    defaultAvatars: ["a.png"],
    eventBus,
  });

  Employee = makeFullModel();
  empBus = makeEventBus();
  employeeSvc = new EmployeeService({ Employee, eventBus: empBus });
});

// TC010-AddEmployee-01 — form display (front-end / manual)
test.todo("TC010-AddEmployee-01: add-employee form shows all required fields (UI/manual)");

// TC011-AddEmployee-02 — all required fields must be present
test("TC011-AddEmployee-02: rejects when a required field is missing", async () => {
  await expect(auth.register(validReg({ full_name: undefined }))).rejects.toThrow(
    "Vui lòng nhập đầy đủ thông tin"
  );
});

// TC012-AddEmployee-03 — password strength
test("TC012-AddEmployee-03: rejects a weak password", async () => {
  User.findOne.mockResolvedValue(null); // email not taken
  await expect(auth.register(validReg({ password: "weak" }))).rejects.toThrow(
    "Mật khẩu mới phải có ít nhất 8 ký tự"
  );
});

// TC013-AddEmployee-04 — minimum age 18
test("TC013-AddEmployee-04: rejects an employee under 18", async () => {
  const recentDob = new Date();
  recentDob.setFullYear(recentDob.getFullYear() - 16);
  await expect(
    auth.register(validReg({ date_birth: recentDob.toISOString() }))
  ).rejects.toThrow("Bạn phải đủ 18 tuổi");
});

// TC014-AddEmployee-05 — position required (and validated by the employee service)
test("TC014-AddEmployee-05: rejects an employee registration without a position", async () => {
  await expect(auth.register(validReg({ position: undefined }))).rejects.toThrow(
    "Vui lòng nhập chức vụ của nhân viên"
  );
});

test("TC014-AddEmployee-05: employee service rejects an invalid position", async () => {
  Employee.findOne.mockResolvedValue(null);
  await expect(
    employeeSvc.createEmployee("u1", {
      phone_number: "0901234567",
      CCCD: "012345678901",
      position: "astronaut",
    })
  ).rejects.toThrow("Chức vụ không hợp lệ");
});

// TC015-AddEmployee-06 — email uniqueness
test("TC015-AddEmployee-06: rejects a duplicate email", async () => {
  User.findOne.mockResolvedValue(makeDoc({ _id: "existing", email: "newstaff@hotel.com" }));
  await expect(auth.register(validReg())).rejects.toThrow("Email đã tồn tại");
});

// TC016-AddEmployee-07 — phone uniqueness (employee record)
test("TC016-AddEmployee-07: rejects a duplicate phone number", async () => {
  Employee.findOne
    .mockResolvedValueOnce(null) // user_id lookup
    .mockResolvedValueOnce(makeDoc({ phone_number: "0901234567" })) // phone exists
    .mockResolvedValueOnce(null); // CCCD
  await expect(
    employeeSvc.createEmployee("u1", {
      phone_number: "0901234567",
      CCCD: "012345678901",
      position: "receptionist",
    })
  ).rejects.toThrow("Số điện thoại đã tồn tại");
});

// TC017-AddEmployee-08 — CCCD uniqueness (employee record)
test("TC017-AddEmployee-08: rejects a duplicate CCCD", async () => {
  Employee.findOne
    .mockResolvedValueOnce(null) // user_id lookup
    .mockResolvedValueOnce(null) // phone
    .mockResolvedValueOnce(makeDoc({ CCCD: "012345678901" })); // CCCD exists
  await expect(
    employeeSvc.createEmployee("u1", {
      phone_number: "0901234567",
      CCCD: "012345678901",
      position: "receptionist",
    })
  ).rejects.toThrow("Số căn cước công dân đã tồn tại");
});

// TC018-AddEmployee-09 — atomic create with rollback of the user on failure
test("TC018-AddEmployee-09: rolls back the created user when employee creation fails", async () => {
  User.findOne.mockResolvedValue(null);
  User.create.mockResolvedValue(makeDoc({ _id: "u-new" }));
  User.deleteOne.mockResolvedValue({ deletedCount: 1 });
  // employee-service replies failure to the REGISTERED event
  eventBus.safeRequest.mockResolvedValue({ success: false, message: "Tạo nhân viên thất bại." });

  await expect(auth.register(validReg())).rejects.toThrow("Tạo nhân viên thất bại");
  expect(User.deleteOne).toHaveBeenCalledWith({ _id: "u-new" });
});

// TC019-AddEmployee-10 — successful creation returns the employee record
test("TC019-AddEmployee-10: creates and returns the employee on success", async () => {
  Employee.findOne.mockResolvedValue(null); // no existing user_id / phone / CCCD
  const created = makeDoc({ _id: "e-new", full_name: "New Staff", position: "receptionist" });
  Employee.create.mockResolvedValue(created);

  const result = await employeeSvc.createEmployee("u-new", {
    phone_number: "0901234567",
    CCCD: "012345678901",
    position: "receptionist",
  });

  expect(Employee.create).toHaveBeenCalled();
  expect(result).toBe(created);
});
