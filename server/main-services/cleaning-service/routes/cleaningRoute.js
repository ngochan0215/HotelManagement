import express from "express";
import { CleaningController } from "../controllers/cleaningController.js";
import { verifyToken, isManager } from "../../../shared/middleware/authMiddleware.js";

const router = express.Router();
const controller = new CleaningController();

router.post("/assign", verifyToken, isManager, controller.assignCleaningTask);
router.put("/start/:id", verifyToken, isManager, controller.startCleaningTask);
router.put("/complete/:id", verifyToken, isManager, controller.completeCleaningTask);

export default router;