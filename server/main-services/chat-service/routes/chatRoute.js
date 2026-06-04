import express from "express";
import { verifyToken } from "../../../shared/middleware/authMiddleware.js";
import { ChatController } from "../controllers/chatController.js";
const router = express.Router();
const controller = new ChatController();

// All chat routes require authentication
router.use(verifyToken);

// Conversations
router.get("/conversations", controller.getMyConversations);
router.post("/conversations", controller.createConversation);
router.get("/conversations/:id", controller.getConversationById);

// Messages (paginated history)
router.get("/conversations/:id/messages", controller.getMessages);

export default router;
