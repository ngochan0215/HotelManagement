import { NotificationController } from "../controllers/notificationController.js";
import express from "express";
import { verifyToken } from "../../../shared/middleware/authMiddleware.js";

const router = express.Router();
const controller = new NotificationController();

router.get("/", verifyToken, controller.getMyNotifications);
router.patch("/", verifyToken, controller.markAsReadAll);
router.patch("/:id", verifyToken, controller.markAsRead);
router.delete("/:id", verifyToken, controller.markAsDeleted);

export default router;