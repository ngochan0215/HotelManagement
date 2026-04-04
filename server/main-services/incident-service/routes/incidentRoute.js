import express from "express";
import { IncidentController } from "../controllers/incidentController.js";
import { CompensationController } from "../controllers/compensationController.js";
import { verifyToken, isManager, isEmployee, isNotCustomer } from "../../../shared/middleware/authMiddleware.js";

const router = express.Router();
const incidentController = new IncidentController(); 
const compensationController = new CompensationController();

// manage incidents
router.post("/add", verifyToken, isNotCustomer, incidentController.createIncident);
router.get("/all", verifyToken, isEmployee, incidentController.getAllIncidents);
router.patch("/:id/assign", verifyToken, isManager, incidentController.assignIncident);
router.patch("/:id/resolved", verifyToken, isNotCustomer, incidentController.resolveIncident);
router.patch("/:id/closed", verifyToken, isManager, incidentController.closedIncident);

// manage compensation tickets
router.post("/:incident_id/compensation-ticket/add", verifyToken, isNotCustomer, compensationController.createCompensateTicket);
router.post("/:incident_id/compensation-ticket/add-one", verifyToken, isNotCustomer, compensationController.createCompensateTicketOther);

router.get("/compensation-ticket/all", verifyToken, isManager, compensationController.getAllCompensateTickets);
router.get("/compensation-ticket/:id", verifyToken, isNotCustomer, compensationController.getCompensateTicketById);
router.patch("/compensation-ticket/:id", verifyToken, isNotCustomer, compensationController.updateCompensateTicket);
router.post("/compensation-ticket/:id/confirmed-done", verifyToken, isNotCustomer, compensationController.confirmCompensationPaid);

router.get("/:id", verifyToken, isManager, incidentController.getIncidentById);
router.patch("/update/:id", verifyToken, incidentController.updateIncident);
router.patch("/delete/:id", verifyToken, incidentController.deleteIncident);

export default router;