import express from "express";
import { IncidentController } from "../controllers/incidentController.js";
import { CompensationController } from "../controllers/compensationController.js";
import { verifyToken, isManager, isEmployee, isNotCustomer } from "../../../shared/middleware/authMiddleware.js";

const router = express.Router();
const incidentController = new IncidentController(); 
const compensationController = new CompensationController();

// manage incidents
router.get("/", verifyToken, isEmployee, incidentController.getAllIncidents);
router.get("/:id", verifyToken, isManager, incidentController.getIncidentById);

router.post("/", verifyToken, isNotCustomer, incidentController.createIncident);
router.patch("/:id", verifyToken, incidentController.updateIncident);
router.delete("/:id", verifyToken, incidentController.deleteIncident);

router.patch("/mark-assigned/:id", verifyToken, isManager, incidentController.assignIncident);
router.patch("/mark-resolved/:id", verifyToken, isNotCustomer, incidentController.resolveIncident);
router.patch("/mark-closed/:id", verifyToken, isManager, incidentController.closedIncident);

// manage compensation tickets
router.get("/compensation-tickets", verifyToken, isManager, compensationController.getAllCompensateTickets);
router.get("/compensation-tickets/:id", verifyToken, isNotCustomer, compensationController.getCompensateTicketById);

router.post("/:incident_id/compensation-tickets", verifyToken, isNotCustomer, compensationController.createCompensateTicket);
router.post("/:incident_id/compensation-tickets/others", verifyToken, isNotCustomer, compensationController.createCompensateTicketOther);

router.patch("/compensation-tickets/:id", verifyToken, isNotCustomer, compensationController.updateCompensateTicket);
router.post("/compensation-tickets/confirm-done/:id", verifyToken, isNotCustomer, compensationController.confirmCompensationPaid);

export default router;