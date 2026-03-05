import express from "express";
import { IncidentController } from "../controllers/incidentController.js";
import { CompensateController } from "../controllers/compensateController.js";
import { verifyToken, isManager, isEmployee, isNotCustomer } from "../middleware/authMiddleware.js";

const router = express.Router();
const incidentController = new IncidentController();
const compensateController = new CompensateController();

// manage incidents
router.post("/add", verifyToken, isNotCustomer, incidentController.createIncident);
router.get("/all", verifyToken, isEmployee, incidentController.getAllIncidents);
router.patch("/:id/assign", verifyToken, isManager, incidentController.assignIncident);
router.patch("/:id/resolved", verifyToken, isNotCustomer, incidentController.resolveIncident);
router.patch("/:id/closed", verifyToken, isManager, incidentController.closedIncident);

// manage compensation tickets
router.post("/:incident_id/compensation-ticket/add", verifyToken, isNotCustomer, compensateController.createCompensateTicket);
router.post("/:incident_id/compensation-ticket/add-one", verifyToken, isNotCustomer, compensateController.createCompensateTicketOther);

router.get("/compensation-ticket/all", verifyToken, isManager, compensateController.getAllCompensateTickets);
router.get("/compensation-ticket/:id", verifyToken, isNotCustomer, compensateController.getCompensateTicketById);
router.patch("/compensation-ticket/:id", verifyToken, isNotCustomer, compensateController.updateCompensateTicket);
router.post("/compensation-ticket/:id/confirmed-done", verifyToken, isNotCustomer, compensateController.confirmCompensationPaid);

router.get("/:id", verifyToken, isManager, incidentController.getIncidentById);
router.patch("/update/:id", verifyToken, incidentController.updateIncident);
router.patch("/delete/:id", verifyToken, incidentController.deleteIncident);

export default router;