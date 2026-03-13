import express from "express";
import { UserController } from "../controllers/userController.js";

const router = express.Router();
const userController = new UserController();

router.get("/profile/view", verifyToken, userController.viewProfile);
router.patch("/profile/update", verifyToken, userController.updateProfile);
router.patch("/change-password", verifyToken, userController.changePassword);
router.post("/change-email/send-otp", verifyToken, userController.sendEmail);
router.post("/change-email/verify-otp", verifyToken, userController.verifyEmail);
router.put("/update-avatar", verifyToken, uploadAvatar.single("avatar"), userController.updateAvatar); 

export default router;