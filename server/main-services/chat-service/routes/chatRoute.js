import express from "express";
import { verifyToken } from "../../../shared/middleware/authMiddleware.js";
import { ChatController } from "../controllers/chatController.js";
const router = express.Router();
const controller = new ChatController();

router.use(verifyToken);

router.get("/conversations", controller.getMyConversations);
router.post("/conversations", controller.createConversation);
router.patch("/conversations/:id", controller.renameGroup);
router.patch("/conversations/:id/end", controller.endConversation);
router.get("/conversations/:id", controller.getConversationById);
router.get("/conversations/:id/messages", controller.getMessages);

export default router;
