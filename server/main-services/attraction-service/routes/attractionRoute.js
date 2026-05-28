import express from "express";
import { AttractionController } from "../controllers/attractionController.js";
import { verifyToken, isEmployee, isManager } from "../../../shared/middleware/authMiddleware.js";

const router = express.Router();
const controller = new AttractionController();

// specific paths MUST be before /:id
router.get("/admin/all", verifyToken, isEmployee, controller.getAllAttractionsAdmin);
router.post("/admin/sync", verifyToken, isManager, controller.triggerSync);

// public — customers and guests
router.get("/", controller.getAllAttractions);
router.get("/:id", controller.getAttractionById);

// manager — edit single attraction
router.patch("/:id", verifyToken, isManager, controller.updateAttraction);

export default router;
