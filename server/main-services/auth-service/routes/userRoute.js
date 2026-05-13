import express from "express";
import { UserController } from "../controllers/userController.js";
import uploadAvatar from "../utils/uploadAvatar.js";
import { verifyToken, isManager, isAdmin, isEmployee } 
    from "../../../shared/middleware/authMiddleware.js";

const router = express.Router();
const userController = new UserController();

router.get("/", verifyToken, isAdmin, userController.getAllUsers);
router.get("/:id", verifyToken, isEmployee, userController.getUserById);
router.get("/profile/:id", verifyToken, isEmployee, userController.getUserProfile);

router.patch("/admin-reset-role", verifyToken, isAdmin, userController.adminResetRole);

router.patch("/change-password", verifyToken, userController.changePassword);
router.post("/change-email/send-otp", verifyToken, userController.sendEmail);
router.post("/change-email/verify-otp", verifyToken, userController.verifyEmail);
router.put("/update-avatar", verifyToken, uploadAvatar.single("avatar"), userController.updateAvatar); 

export default router;