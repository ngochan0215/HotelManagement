import express from "express";
import { banCustomer, getAllCustomers, updateCustomer, unbanCustomer
} from "../controllers/customerController.js";
import { isManager, verifyToken } from "../middleware/authMiddleware.js";

const router = express.Router();

router.get("/all", verifyToken, isManager, getAllCustomers);
router.patch("/:id", verifyToken, isManager, updateCustomer);

router.patch("/:id/ban", verifyToken, isManager, banCustomer);
router.patch("/:id/unban", verifyToken, isManager, unbanCustomer);

export default router;