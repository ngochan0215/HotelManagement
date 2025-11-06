import express from "express";
import { registerEmployee, getAllEmployess, getAllCustomers, updateEmployee, getEmployeeById } from "../controllers/adminController.js";
import { verifyToken, isManager  } from "../middleware/authMiddleware.js";

const router = express.Router();

// EMPLOYEE
router.post("/registerEmployee", verifyToken, isManager, registerEmployee);
router.get("/employees", verifyToken, isManager, getAllEmployess);
router.get("/employee/:id", verifyToken, getEmployeeById);
router.put("/employess/update", verifyToken, isManager, updateEmployee);

// CUSTOMER
router.get("/customers", verifyToken, isManager, getAllCustomers);

export default router;
    