import express from "express";
import { container } from "../containers/container.js";

const router = express.Router();
const controller = container.cleaningController;

router.post("/assign", controller.assignCleaningTask);
router.put("/start/:id", controller.startCleaningTask);
router.put("/complete/:id", controller.completeCleaningTask);

export default router;