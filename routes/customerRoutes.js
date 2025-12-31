import express from "express";
import { banCustomer, createAccount, getAllCustomers, updateCustomer, verifyEmail } from "../controllers/customerController.js";
import { isManager, verifyToken } from "../middleware/authMiddleware.js";

const router = express.Router();

router.post("/register", createAccount);
router.post("/verify-email", verifyEmail);
router.get("/all", verifyToken, isManager, getAllCustomers);
router.patch("/:id", verifyToken, isManager, updateCustomer);
router.patch("/:id/ban", verifyToken, isManager, banCustomer);

export default router;