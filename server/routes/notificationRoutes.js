import express from "express";
import { verifyToken } from "../middleware/authMiddleware.js";
import { getMyNotifications, markAsDeleted, markAsRead, markAsReadAll } 
from "../controllers/notificationController.js";

const router = express.Router();

router.get("/all", verifyToken, getMyNotifications);
router.patch("/read-all", verifyToken, markAsReadAll);
router.patch("/:id", verifyToken, markAsRead);
router.delete("/:id", verifyToken, markAsDeleted);

export default router;