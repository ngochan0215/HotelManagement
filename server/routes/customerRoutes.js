import express from "express";
import { CustomerController } from "../controllers/customerController.js";
import { isManager, verifyToken, isEmployee} from "../middleware/authMiddleware.js";

const router = express.Router();
const customerController = new CustomerController();

router.get("/all", verifyToken, isEmployee, customerController.getAllCustomers);
router.patch("/:id", verifyToken, isManager, customerController.updateCustomer);

router.patch("/:id/ban", verifyToken, isManager, customerController.banCustomer);
router.patch("/:id/unban", verifyToken, isManager, customerController.unbanCustomer);

export default router;