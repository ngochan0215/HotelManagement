import express from "express";
import { IncidentController } from "../controllers/incidentController.js";
import { CompensationController } from "../controllers/compensationController.js";
import { verifyToken, isManager, isEmployee, isAdmin } from "../../../shared/middleware/authMiddleware.js";

const router = express.Router();
const incidentController = new IncidentController(); 
const compensationController = new CompensationController();

// manage incidents
router.get("/", verifyToken, isManager, incidentController.getAllIncidents);
router.get("/:id", verifyToken, isManager, incidentController.getIncidentById);

router.post("/", verifyToken, isEmployee, incidentController.createIncident);
router.patch("/:id", verifyToken, isEmployee, incidentController.updateIncident);
router.delete("/:id", verifyToken, isEmployee, incidentController.deleteIncident);

router.patch("/mark-assigned/:id", verifyToken, isManager, incidentController.assignIncident);
router.patch("/mark-resolved/:id", verifyToken, isEmployee, incidentController.resolveIncident);
router.patch("/mark-closed/:id", verifyToken, isManager, incidentController.closedIncident);

// manage compensation tickets
router.get("/compensation-tickets", verifyToken, isManager, compensationController.getAllCompensateTickets);
router.get("/compensation-tickets/:id", verifyToken, isEmployee, compensationController.getCompensateTicketById);

router.post("/:incident_id/compensation-tickets", verifyToken, isEmployee, compensationController.createCompensateTicket);
router.post("/:incident_id/compensation-tickets/others", verifyToken, isEmployee, compensationController.createCompensateTicketOther);

router.patch("/compensation-tickets/:id", verifyToken, isEmployee, compensationController.updateCompensateTicket);
router.post("/compensation-tickets/confirm-done/:id", verifyToken, isEmployee, compensationController.confirmCompensationPaid);

export default router;