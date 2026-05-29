// RTM: Login use case (TC001-Login-01 .. TC009-Login-09)
// Unit tests against AuthService.login / AuthService.loginGoogle with a mocked
// User model, event bus, bcrypt and jwt.
import bcrypt from "bcrypt";
import { __verifyIdToken } from "google-auth-library";
import { AuthService } from "../../main-services/auth-service/services/authService.js";
import { makeFullModel, makeDoc, makeEventBus } from "../helpers/mocks.js";

const activeUser = (over = {}) =>
  makeDoc({
    _id: "u1",
    email: "staff@hotel.com",
    password: "hashed:secret",
    system_role: "employee",
    emailVerified: true,
    status: "active",
    avatar: "a.png",
    ...over,
  });

let User, eventBus, svc;

beforeEach(() => {
  User = makeFullModel();
  eventBus = makeEventBus();
  svc = new AuthService({
    User,
    mailService: { sendVerificationEmail: jest.fn(), sendResetPasswordEmail: jest.fn() },
    defaultAvatars: ["a.png"],
    eventBus,
  });
});

// TC001-Login-01 — login form display (front-end / manual, not service-level)
test.todo("TC001-Login-01: Login form displays email, password fields and Login button (UI/manual)");

// TC002-Login-02 — required-field validation (front-end / controller layer)
test.todo("TC002-Login-02: shows error when email or password is empty (UI/validation layer)");

// TC003-Login-03 — email format validation (front-end / controller layer)
test.todo("TC003-Login-03: shows error when email format is invalid (UI/validation layer)");

// TC004-Login-04 — account must exist
test("TC004-Login-04: rejects when the email is not registered", async () => {
  User.findOne.mockResolvedValue(null);
  await expect(svc.login("nobody@hotel.com", "secret")).rejects.toThrow("Tài khoản không tồn tại");
});

// TC005-Login-05 — email must be verified
test("TC005-Login-05: rejects when the account email is unverified", async () => {
  User.findOne.mockResolvedValue(activeUser({ emailVerified: false }));
  await expect(svc.login("staff@hotel.com", "secret")).rejects.toThrow("Email chưa được xác thực");
});

// TC006-Login-06 — banned or inactive accounts are blocked
test("TC006-Login-06: rejects banned and inactive accounts", async () => {
  User.findOne.mockResolvedValueOnce(activeUser({ status: "banned" }));
  await expect(svc.login("staff@hotel.com", "secret")).rejects.toThrow("Tài khoản đã bị ban");

  User.findOne.mockResolvedValueOnce(activeUser({ status: "inactive" }));
  await expect(svc.login("staff@hotel.com", "secret")).rejects.toThrow("Tài khoản đã ngừng hoạt động");
});

// TC007-Login-07 — password must match
test("TC007-Login-07: rejects when the password does not match", async () => {
  User.findOne.mockResolvedValue(activeUser());
  bcrypt.compare.mockResolvedValueOnce(false);
  await expect(svc.login("staff@hotel.com", "wrong")).rejects.toThrow("Sai mật khẩu");
});

// TC008-Login-08 — successful login returns a token + user profile
test("TC008-Login-08: returns a JWT token and user profile on success", async () => {
  User.findOne.mockResolvedValue(activeUser());
  bcrypt.compare.mockResolvedValueOnce(true);
  eventBus.safeRequest.mockResolvedValueOnce({
    found: true,
    employee: { _id: "e1", full_name: "Jane Staff", position: "manager" },
  });

  const result = await svc.login("staff@hotel.com", "secret");

  expect(result.token).toBe("mocked.jwt.token");
  expect(result.theUser).toMatchObject({
    email: "staff@hotel.com",
    role: "employee",
    name: "Jane Staff",
    position: "manager",
  });
});

// TC009-Login-09 — Google OAuth login
describe("TC009-Login-09: Google OAuth login", () => {
  test("returns a token for an existing Google user", async () => {
    __verifyIdToken.mockResolvedValueOnce({
      getPayload: () => ({ email: "staff@hotel.com", name: "Jane", picture: "p", sub: "g-1" }),
    });
    User.findOne.mockResolvedValue(activeUser());
    eventBus.safeRequest.mockResolvedValueOnce({
      found: true,
      employee: { _id: "e1", full_name: "Jane Staff", position: "manager" },
    });

    const result = await svc.loginGoogle("google-id-token");
    expect(result.token).toBe("mocked.jwt.token");
    expect(result.theUser.email).toBe("staff@hotel.com");
  });

  test("flags a brand-new user for registration", async () => {
    __verifyIdToken.mockResolvedValueOnce({
      getPayload: () => ({ email: "new@gmail.com", name: "New", picture: "p", sub: "g-2" }),
    });
    User.findOne.mockResolvedValue(null);

    const result = await svc.loginGoogle("google-id-token");
    expect(result.isNewUser).toBe(true);
    expect(result.googleData).toMatchObject({ email: "new@gmail.com", googleId: "g-2" });
  });
});
