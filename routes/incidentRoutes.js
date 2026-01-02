import express from "express";
import { reportIncident, getAllIncidents, getIncidentById, updateIncident } from "../controllers/incidentController.js";
import { verifyToken } from "../middleware/authMiddleware.js";
import { isManager, isEmployee, isNotCustomer } from "../middleware/authMiddleware.js";
const router = express.Router();

router.post("/add", verifyToken, isNotCustomer, reportIncident);
router.get("/all", verifyToken, isManager, getAllIncidents);
router.get("/:id", verifyToken, isManager, getIncidentById);
router.patch("/update/:id", verifyToken, updateIncident);

export default router;