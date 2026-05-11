import express from "express";
import { AuthController} from "../controllers/authController.js";
import { verifyToken, isManager, isEmployee } from "../../../shared/middleware/authMiddleware.js";

const router = express.Router();
const authController = new AuthController();

router.post("/create-account", authController.createAccount);
router.post("/register", authController.register);
router.post("/verify-email", verifyToken, authController.verifyEmail);
router.post("/login", authController.login);
router.post("/login-google", authController.loginGoogle);
router.post("/forgot-password", authController.forgotPassword);
router.post("/reset-password", authController.resetPassword);

router.patch("/admin-reset-pass", verifyToken, isManager, authController.adminResetPassword);

// for communication between services
router.delete("/delete-user/:id", authController.deleteUser);

export default router;
    