import express from "express";
import {
    registerEmployee,
    getAllEmployees,
    updateEmployee,
    getEmployeeById,
    registerSchedule,
    viewMySchedule,
    updateSchedule,
    checkInShift,
    checkOutShift,
    getAllSchedules,
    getScheduleById,
    deleteSchedule,
    createAccountForExistingEmployee,
    resetPasswordForEmployee,
    toggleBanUser,
    getMyProfile,
    calculateEmployeeSalary
} from "../controllers/employeeController.js";
import { cashOut, amountCashout, availableCashoutAmount, getEarningsHistory, getPayoutHistory } from "../controllers/paymentController.js";
import { verifyToken, isManager, isEmployee, isNotCustomer } from "../middleware/authMiddleware.js";

const router = express.Router();
router.get("/profile/me", verifyToken, getMyProfile);
router.post("/add", verifyToken, isManager, registerEmployee);
router.get("/all", verifyToken, isEmployee, getAllEmployees);
router.get("/:id", verifyToken, isManager, getEmployeeById);
router.patch("/:id", verifyToken, isManager, updateEmployee);

router.post("/:id/create-account", verifyToken, isManager, createAccountForExistingEmployee);
router.patch("/reset-password/:id", verifyToken, isManager, resetPasswordForEmployee);
router.patch("/toggle-ban/:id", verifyToken, isManager, toggleBanUser);

router.post("/schedules/register", verifyToken, isEmployee, registerSchedule);
router.get("/schedules/my", verifyToken, isEmployee, viewMySchedule);
router.patch("/schedules/:id", verifyToken, isEmployee, updateSchedule);
router.delete("/schedules/:id", verifyToken, isEmployee, deleteSchedule);
router.get("/schedules/all", verifyToken, isManager, getAllSchedules);
router.get("/schedules/:id", verifyToken, isNotCustomer, getScheduleById);

// ATTENDANCE
router.post("/attendance/checkin", verifyToken, isEmployee, checkInShift);
router.post("/attendance/checkout", verifyToken, isEmployee, checkOutShift);

// CASH OUT
router.put("/cashOut", verifyToken, isEmployee, cashOut);
router.get("/cashOut", verifyToken, isEmployee, amountCashout);
router.get("/cashOut/available", verifyToken, isEmployee, availableCashoutAmount);

// EARNINGS & PAYOUTS
router.get("/earnings", verifyToken, isEmployee, getEarningsHistory);
router.get("/payouts", verifyToken, isEmployee, getPayoutHistory);

// SALARY CALCULATION (Manager only)
router.post("/salary/calculate", verifyToken, isManager, calculateEmployeeSalary);

export default router;