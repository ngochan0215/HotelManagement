import { EmployeeController } from "../controllers/employeeController.js";
import { ScheduleController } from "../controllers/scheduleController.js";
import { verifyToken, isManager, isEmployee, isAdmin } from "../../../shared/middleware/authMiddleware.js";
import express from "express";

const router = express.Router();
const controller = new EmployeeController();
const scheduleController = new ScheduleController();

router.get("/my-profile", verifyToken, isEmployee, controller.getMyProfile);
router.get("/available-technicians", verifyToken, isManager, controller.getAvailableTechnicians);

router.post("/", verifyToken, isManager, controller.createEmployee);
router.get("/", verifyToken, isManager, controller.getAllEmployees);
router.get("/:id", verifyToken, isManager, controller.getEmployeeById);
router.patch("/:id", verifyToken, isManager, controller.updateEmployee);

router.post("/create-account/:id", verifyToken, isManager, controller.createAccountForExistingEmployee);
router.patch("/reset-password/:id", verifyToken, isManager, controller.resetPasswordForEmployee);
router.patch("/toggle-ban/:id", verifyToken, isManager, controller.toggleBanUser);

// shifts
router.post("/shifts", verifyToken, isAdmin, scheduleController.createShift);
router.get("/shifts", verifyToken, isEmployee, scheduleController.getAllShifts);
router.get("/shifts/:id", verifyToken, isEmployee, scheduleController.getShiftById);
router.patch("/shifts/:id", verifyToken, isAdmin, scheduleController.updateShift);
router.delete("/shifts/:id", verifyToken, isAdmin, scheduleController.deleteShift);

// attendance and earnings
router.get("/earnings/my", verifyToken, isEmployee, controller.getMyEarnings);
router.get("/earnings/all", verifyToken, isManager, controller.getAllEmployeesEarnings);
router.get("/earnings/:employeeId", verifyToken, isManager, controller.getEmployeeEarningById);

router.post("/attendances/check-in/:scheduleId", verifyToken, isEmployee, controller.checkInShift);
router.post("/attendances/check-out", verifyToken, isEmployee, controller.checkOutShift);

// CASH OUT
// router.put("/cashOut", verifyToken, isEmployee, cashOut);
// router.get("/cashOut", verifyToken, isEmployee, amountCashout);
// router.get("/cashOut/available", verifyToken, isEmployee, availableCashoutAmount);

export default router;