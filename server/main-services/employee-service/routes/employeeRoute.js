import { EmployeeController } from "../controllers/employeeController.js";
import { ScheduleController } from "../controllers/scheduleController.js";
import { verifyToken, isManager, isEmployee } from "../../../shared/middleware/authMiddleware.js";
import express from "express";

const router = express.Router();
const controller = new EmployeeController();
const scheduleController = new ScheduleController();

router.get("/profile/me", verifyToken, controller.getMyProfile);
router.get("/available/technicians", verifyToken, isManager, controller.getAvailableTechnicians);
router.post("/add", verifyToken, isManager, controller.createEmployee);
router.get("/all", verifyToken, isEmployee, controller.getAllEmployees);
router.get("/:id", verifyToken, isManager, controller.getEmployeeById);
router.patch("/:id", verifyToken, isManager, controller.updateEmployee);

router.post("/:id/create-account", verifyToken, isManager, controller.createAccountForExistingEmployee);
router.patch("/reset-password/:id", verifyToken, isManager, controller.resetPasswordForEmployee);
router.patch("/toggle-ban/:id", verifyToken, isManager, controller.toggleBanUser);


// shifts
router.post("/shifts/add", verifyToken, isManager, scheduleController.createShift);
router.get("/shifts/all", verifyToken, isManager, scheduleController.getAllShifts);
router.get("/shifts/:id", verifyToken, isManager, scheduleController.getShiftById);
router.patch("/shifts/:id", verifyToken, isManager, scheduleController.updateShift);
router.delete("/shifts/:id", verifyToken, isManager, scheduleController.deleteShift);

// ATTENDANCE
// router.post("/attendance/checkin", verifyToken, isEmployee, controller.checkInShift);
// router.post("/attendance/checkout", verifyToken, isEmployee, controller.checkOutShift);

// CASH OUT
// router.put("/cashOut", verifyToken, isEmployee, cashOut);
// router.get("/cashOut", verifyToken, isEmployee, amountCashout);
// router.get("/cashOut/available", verifyToken, isEmployee, availableCashoutAmount);

// // EARNINGS & PAYOUTS
// router.get("/earnings", verifyToken, isEmployee, getEarningsHistory);
// router.get("/payouts", verifyToken, isEmployee, getPayoutHistory);

// // SALARY CALCULATION (Manager only)
// router.post("/salary/calculate", verifyToken, isManager, calculateEmployeeSalary);

export default router;