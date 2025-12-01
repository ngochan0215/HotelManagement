import express from "express";
import { reportIncident, getAllIncidents, getIncidentById, resolveIncident } from "../controllers/incidentController.js";
import { verifyToken } from "../middleware/authMiddleware.js";
import { isManager, isEmployee } from "../middleware/authMiddleware.js";
const router = express.Router();

router.post("/", verifyToken, reportIncident);
router.get("/all", verifyToken, isManager, getAllIncidents);
router.get("/:incidentId", verifyToken, isManager, getIncidentById);
// router.put("/resolve/:incidentId", verifyToken, resolveIncident);

export default router;