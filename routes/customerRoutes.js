import express from "express";
import { createAccount, getAllCustomers, verifyEmail } from "../controllers/customerController.js";
import { isManager, verifyToken } from "../middleware/authMiddleware.js";

const router = express.Router();

router.post("/register", createAccount);
router.post("/verify-email", verifyEmail);
router.get("/all", verifyToken, isManager, getAllCustomers);

export default router;