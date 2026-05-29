// RTM: Ban employee (TC028-BanEmployee-01 .. TC032-BanEmployee-05)
import { EmployeeService } from "../../main-services/employee-service/services/employeeService.js";
import { AuthService } from "../../main-services/auth-service/services/authService.js";
import { makeFullModel, makeDoc, makeEventBus } from "../helpers/mocks.js";

let Employee, eventBus, svc;

beforeEach(() => {
  Employee = makeFullModel();
  eventBus = makeEventBus();
  svc = new EmployeeService({ Employee, eventBus });
});

// TC028-BanEmployee-01 — employee must have a linked account
test("TC028-BanEmployee-01: rejects when the employee has no linked account", async () => {
  Employee.findById.mockResolvedValue(makeDoc({ _id: "e1", user_id: null }));
  await expect(svc.toggleBanUser("e1", true)).rejects.toThrow("Nhân viên chưa có tài khoản");
});

// TC029-BanEmployee-02 — banning flips the user to banned/isBanned=true
test("TC029-BanEmployee-02: bans the account (isBanned=true, status=banned)", async () => {
  Employee.findById.mockResolvedValue(makeDoc({ _id: "e1", user_id: "u1" }));
  eventBus.safeRequest.mockResolvedValue({ success: true });

  await svc.toggleBanUser("e1", true);

  expect(eventBus.safeRequest).toHaveBeenCalledWith(
    expect.anything(),
    expect.objectContaining({
      userId: "u1",
      payload: { isBanned: true, status: "banned" },
    })
  );
});

// TC030-BanEmployee-03 — unbanning restores active
test("TC030-BanEmployee-03: unbans the account (isBanned=false, status=active)", async () => {
  Employee.findById.mockResolvedValue(makeDoc({ _id: "e1", user_id: "u1" }));
  eventBus.safeRequest.mockResolvedValue({ success: true });

  await svc.toggleBanUser("e1", false);

  expect(eventBus.safeRequest).toHaveBeenCalledWith(
    expect.anything(),
    expect.objectContaining({
      userId: "u1",
      payload: { isBanned: false, status: "active" },
    })
  );
});

// TC031-BanEmployee-04 — a banned employee cannot authenticate (cross-checked at login)
test("TC031-BanEmployee-04: a banned account is blocked at login", async () => {
  const User = makeFullModel();
  const auth = new AuthService({ User, mailService: {}, defaultAvatars: [], eventBus: makeEventBus() });
  User.findOne.mockResolvedValue(
    makeDoc({ email: "x@hotel.com", emailVerified: true, status: "banned", password: "hashed:p" })
  );
  await expect(auth.login("x@hotel.com", "p")).rejects.toThrow("Tài khoản đã bị ban");
});

// TC032-BanEmployee-05 — success result returned
test("TC032-BanEmployee-05: returns success after ban/unban", async () => {
  Employee.findById.mockResolvedValue(makeDoc({ _id: "e1", user_id: "u1" }));
  eventBus.safeRequest.mockResolvedValue({ success: true });

  await expect(svc.toggleBanUser("e1", true)).resolves.toEqual({ success: true });
});
