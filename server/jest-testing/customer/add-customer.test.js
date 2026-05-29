// RTM: Add customer (TC045-AddCustomer-01 .. TC053-AddCustomer-09)
// AuthService.register (system_role=customer) handles account validation, OTP email
// and atomic rollback; CustomerService.createCustomer handles record uniqueness.
import { AuthService } from "../../main-services/auth-service/services/authService.js";
import { CustomerService } from "../../main-services/customer-service/services/customerService.js";
import { makeFullModel, makeDoc, makeEventBus } from "../helpers/mocks.js";

const validReg = (over = {}) => ({
  email: "guest@mail.com",
  password: "Str0ng@Pass",
  date_birth: "1996-02-20",
  full_name: "New Guest",
  phone_number: "0907654321",
  CCCD: "987654321098",
  nationality: "Vietnam",
  system_role: "customer",
  ...over,
});

let User, mailService, eventBus, auth;
let Customer, custBus, customerSvc;

beforeEach(() => {
  User = makeFullModel();
  mailService = { sendVerificationEmail: jest.fn(), sendResetPasswordEmail: jest.fn() };
  eventBus = makeEventBus();
  auth = new AuthService({ User, mailService, defaultAvatars: ["a.png"], eventBus });

  Customer = makeFullModel();
  custBus = makeEventBus();
  customerSvc = new CustomerService({ Customer, PointsLog: makeFullModel(), eventBus: custBus });
});

// TC045-AddCustomer-01 — form display (front-end / manual)
test.todo("TC045-AddCustomer-01: add-customer form shows required fields (UI/manual)");

// TC046-AddCustomer-02 — required fields
test("TC046-AddCustomer-02: rejects when a required field is missing", async () => {
  await expect(auth.register(validReg({ phone_number: undefined }))).rejects.toThrow(
    "Vui lòng nhập đầy đủ thông tin"
  );
});

// TC047-AddCustomer-03 — minimum age 18
test("TC047-AddCustomer-03: rejects a customer under 18", async () => {
  const recentDob = new Date();
  recentDob.setFullYear(recentDob.getFullYear() - 15);
  await expect(auth.register(validReg({ date_birth: recentDob.toISOString() }))).rejects.toThrow(
    "Bạn phải đủ 18 tuổi"
  );
});

// TC048-AddCustomer-04 — email uniqueness
test("TC048-AddCustomer-04: rejects a duplicate email", async () => {
  User.findOne.mockResolvedValue(makeDoc({ _id: "existing" }));
  await expect(auth.register(validReg())).rejects.toThrow("Email đã tồn tại");
});

// TC049-AddCustomer-05 — phone uniqueness (customer record)
test("TC049-AddCustomer-05: rejects a duplicate phone number", async () => {
  Customer.findOne
    .mockResolvedValueOnce(null) // user_id lookup
    .mockResolvedValueOnce(makeDoc({ phone_number: "0907654321" })) // phone exists
    .mockResolvedValueOnce(null); // CCCD
  await expect(
    customerSvc.createCustomer("u1", { phone_number: "0907654321", CCCD: "987654321098" })
  ).rejects.toThrow("Số điện thoại đã tồn tại");
});

// TC050-AddCustomer-06 — CCCD uniqueness (customer record)
test("TC050-AddCustomer-06: rejects a duplicate CCCD", async () => {
  Customer.findOne
    .mockResolvedValueOnce(null)
    .mockResolvedValueOnce(null)
    .mockResolvedValueOnce(makeDoc({ CCCD: "987654321098" }));
  await expect(
    customerSvc.createCustomer("u1", { phone_number: "0907654321", CCCD: "987654321098" })
  ).rejects.toThrow("Số căn cước công dân đã tồn tại");
});

// TC051-AddCustomer-07 — verification OTP email sent, emailVerified=false
test("TC051-AddCustomer-07: sends a verification OTP email and creates an unverified account", async () => {
  User.findOne.mockResolvedValue(null);
  User.create.mockResolvedValue(makeDoc({ _id: "u-new" }));
  eventBus.safeRequest.mockResolvedValue({ success: true });

  await auth.register(validReg());

  expect(User.create).toHaveBeenCalledWith(
    expect.objectContaining({ emailVerified: false })
  );
  expect(mailService.sendVerificationEmail).toHaveBeenCalledWith("guest@mail.com", expect.any(String));
});

// TC052-AddCustomer-08 — atomic rollback of the user when customer creation fails
test("TC052-AddCustomer-08: rolls back the created user when customer creation fails", async () => {
  User.findOne.mockResolvedValue(null);
  User.create.mockResolvedValue(makeDoc({ _id: "u-new" }));
  User.deleteOne.mockResolvedValue({ deletedCount: 1 });
  eventBus.safeRequest.mockResolvedValue({ success: false, message: "Tạo khách hàng thất bại." });

  await expect(auth.register(validReg())).rejects.toThrow("Tạo khách hàng thất bại");
  expect(User.deleteOne).toHaveBeenCalledWith({ _id: "u-new" });
});

// TC053-AddCustomer-09 — successful creation returns the customer
test("TC053-AddCustomer-09: creates and returns the customer on success", async () => {
  Customer.findOne.mockResolvedValue(null);
  const created = makeDoc({ _id: "c-new", full_name: "New Guest" });
  Customer.create.mockResolvedValue(created);

  const result = await customerSvc.createCustomer("u-new", {
    phone_number: "0907654321",
    CCCD: "987654321098",
  });

  expect(Customer.create).toHaveBeenCalled();
  expect(result).toBe(created);
});
