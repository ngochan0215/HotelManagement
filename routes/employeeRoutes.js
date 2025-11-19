import express from "express";
import { registerEmployee, getAllEmployess, updateEmployee, getEmployeeById, registerSchedule,
    viewMySchedule, updateSchedule
} from "../controllers/employeeController.js";
import { verifyToken, isManager, isEmployee } from "../middleware/authMiddleware.js";

const router = express.Router();

// EMPLOYEE
router.post("/add", verifyToken, isManager, registerEmployee);
router.get("/all", verifyToken, isManager, getAllEmployess);
router.get("/:id", verifyToken, getEmployeeById);
router.put("/:id", verifyToken, isManager, updateEmployee);

// SCHEDULES
router.post("/schedule/register", verifyToken, isEmployee, registerSchedule);
router.get("/schedule", verifyToken, isEmployee, viewMySchedule);
router.put("/schedule/:id", verifyToken, isEmployee, updateEmployee);

export default router;
    