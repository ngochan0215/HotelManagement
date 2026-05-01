import express from "express";
import { CustomerController } from "../controllers/customerController.js";
import { isManager, verifyToken, isEmployee } from "../../../shared/middleware/authMiddleware.js";

const router = express.Router();
const customerController = new CustomerController();

// manager and customer 
router.get("/all", verifyToken, isEmployee, customerController.getAllCustomers);
router.patch("/:id", verifyToken, isManager, customerController.updateCustomer);
router.get("/:id", verifyToken, isManager, customerController.getCustomerById);
router.patch("/:id/ban", verifyToken, isManager, customerController.banCustomer);
router.patch("/:id/unban", verifyToken, isManager, customerController.unbanCustomer);

// for communication between services
router.post("/create-customer/:userId", customerController.createCustomer);

export default router;