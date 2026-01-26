import express from "express";
import {
    createCompensateTicket, getAllCompensateTickets, getCompensateTicketById,
    createIncident, deleteIncident, getAllIncidents, getIncidentById, updateIncident,
    confirmCompensationPaid, updateCompensateTicket, assignIncident,
    resolveIncident, createCompensateTickett, closedIncident
} from "../controllers/incidentController.js";
import { verifyToken, isManager, isEmployee, isNotCustomer } from "../middleware/authMiddleware.js";

const router = express.Router();

// manage incidents
router.post("/add", verifyToken, isNotCustomer, createIncident);
router.get("/all", verifyToken, isEmployee, getAllIncidents);
router.patch("/:id/assign", verifyToken, isManager, assignIncident);
router.patch("/:id/resolved", verifyToken, isNotCustomer, resolveIncident);
router.patch("/:id/closed", verifyToken, isManager, closedIncident);

// manage compensation tickets
router.post("/:incident_id/compensation-ticket/add", verifyToken, isNotCustomer, createCompensateTicket);
router.post("/:incident_id/compensation-ticket/add-one", verifyToken, isNotCustomer, createCompensateTickett);

router.get("/compensation-ticket/all", verifyToken, isManager, getAllCompensateTickets);
router.get("/compensation-ticket/:id", verifyToken, isNotCustomer, getCompensateTicketById);
router.patch("/compensation-ticket/:id", verifyToken, isNotCustomer, updateCompensateTicket);

// --- SỬA DÒNG NÀY: Thêm /:id vào URL ---
router.post("/compensation-ticket/:id/confirmed-done", verifyToken, isNotCustomer, confirmCompensationPaid);

router.get("/:id", verifyToken, isManager, getIncidentById);
router.patch("/update/:id", verifyToken, updateIncident);
router.patch("/delete/:id", verifyToken, deleteIncident);

export default router;