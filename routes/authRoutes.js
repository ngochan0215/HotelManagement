import express from "express";
import { forgotPassword, resetPassword, login, register, verifyEmail
} from "../controllers/authControllers.js";

const router = express.Router();

router.post("/register", register);
router.post("/verify-email", verifyEmail);
router.post("/login", login);
router.post("/forgot-password", forgotPassword);
router.post("/reset-password", resetPassword);

export default router;
    