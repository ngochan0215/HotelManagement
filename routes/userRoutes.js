import express from "express";
import { updateProfile, viewProfile, changePassword, sendEmail, verifyEmail, updateAvatar } from "../controllers/userController.js";
import { verifyTokenForProfile } from "../middleware/authMiddleware.js";
import uploadAvatar from "../middleware/uploadAvatar.js";

const router = express.Router();

router.get("/view-profile", verifyTokenForProfile, viewProfile);
router.put("/update-profile", verifyTokenForProfile, updateProfile);
router.put("/change-password", verifyTokenForProfile, changePassword);
router.post("/change-email/send-otp", verifyTokenForProfile, sendEmail);
router.post("/change-email/verify-otp", verifyTokenForProfile, verifyEmail);
router.put("/update-avatar", verifyTokenForProfile, uploadAvatar.single("avatar"), updateAvatar);

export default router;