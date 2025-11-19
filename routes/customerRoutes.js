import express from "express";
import { createAccount, addCustomerInfo, verifyEmail } from "../controllers/customerController.js";
import { verifyToken } from "../middleware/authMiddleware.js";
import uploadAvatar from "../middleware/uploadAvatar.js";

const router = express.Router();

router.post("/register", createAccount);
router.post("/verify-email", verifyEmail);
router.post("/add-info", verifyToken, addCustomerInfo);

export default router;