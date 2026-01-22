import express from "express";
import { updateProfile, viewProfile, changePassword, sendEmail, verifyEmail, updateAvatar } from "../controllers/userController.js";
import { verifyToken } from "../middleware/authMiddleware.js";
import uploadAvatar from "../middleware/uploadAvatar.js";

const router = express.Router();

router.get("/profile/view", verifyToken, viewProfile);
router.patch("/profile/update", verifyToken, updateProfile);
router.patch("/change-password", verifyToken, changePassword);
router.post("/change-email/send-otp", verifyToken, sendEmail);
router.post("/change-email/verify-otp", verifyToken, verifyEmail);
router.put("/update-avatar", verifyToken, uploadAvatar.single("avatar"), updateAvatar);

export default router;