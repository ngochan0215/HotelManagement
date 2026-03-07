import express from "express";
import { AuthController} from "../controllers/authController.js";

const router = express.Router();
const authController = new AuthController();

router.post("/register", authController.register);
router.post("/verify-email", authController.verifyEmail);
router.post("/login", authController.login);
router.post("/forgot-password", authController.forgotPassword);
router.post("/reset-password", authController.resetPassword);

router.get("/get-user/:id", authController.getUserById);
router.get("/get-email/:email", authController.getUserByEmail);
router.patch("/update-user/:id", authController.updateUser);

export default router;
    