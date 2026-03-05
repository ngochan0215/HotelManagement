import express from "express";
import { EmployeeController } from "../controllers/employeeController.js";
import { verifyToken, isManager, isEmployee } from "../middleware/authMiddleware.js";

const router = express.Router();
const controller = new EmployeeController();

router.get("/profile/me", verifyToken, controller.getMyProfile);
router.post("/add", verifyToken, isManager, controller.registerEmployee);
router.get("/all", verifyToken, isEmployee, controller.getAllEmployees);
router.get("/:id", verifyToken, isManager, controller.getEmployeeById);
router.patch("/:id", verifyToken, isManager, controller.updateEmployee);

router.post("/:id/create-account", verifyToken, isManager, controller.createAccountForExistingEmployee);
router.patch("/reset-password/:id", verifyToken, isManager, controller.resetPasswordForEmployee);
router.patch("/toggle-ban/:id", verifyToken, isManager, controller.toggleBanUser);

// ATTENDANCE
router.post("/attendance/checkin", verifyToken, isEmployee, controller.checkInShift);
router.post("/attendance/checkout", verifyToken, isEmployee, controller.checkOutShift);

// router.post("/schedules/register", verifyToken, isEmployee, registerSchedule);
// router.get("/schedules/my", verifyToken, isEmployee, viewMySchedule);
// router.patch("/schedules/:id", verifyToken, isEmployee, updateSchedule);
// router.delete("/schedules/:id", verifyToken, isEmployee, deleteSchedule);
// router.get("/schedules/all", verifyToken, isManager, getAllSchedules);
// router.get("/schedules/:id", verifyToken, isNotCustomer, getScheduleById);

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