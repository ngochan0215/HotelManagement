import express from "express";
import { updateProfile, viewProfile, changePassword, sendEmail, verifyEmail } from "../controllers/userController.js";
import { verifyTokenForProfile } from "../middleware/authMiddleware.js";

const router = express.Router();

router.get("/view-profile", verifyTokenForProfile, viewProfile);
router.put("/update-profile", verifyTokenForProfile, updateProfile);
router.put("/change-password", verifyTokenForProfile, changePassword);
router.post("/change-email/send-otp", verifyTokenForProfile, sendEmail);
router.post("/change-email/verify-otp", verifyTokenForProfile, verifyEmail);

export default router;