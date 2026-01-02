import express from "express";
import { createCompensateTicket, getAllCompensateTickets, getCompensateTicketById,
    createIncident, deleteIncident, getAllIncidents, getIncidentById, updateIncident, 
    confirmCompensationPaid,
    updateCompensateTicket} from "../controllers/incidentController.js";
import { verifyToken } from "../middleware/authMiddleware.js";
import { isManager, isEmployee, isNotCustomer } from "../middleware/authMiddleware.js";
const router = express.Router();

// manage incidents
router.post("/add", verifyToken, isNotCustomer, createIncident);
router.get("/all", verifyToken, isManager, getAllIncidents);
router.get("/:id", verifyToken, isManager, getIncidentById);
router.patch("/update/:id", verifyToken, updateIncident);
router.patch("/delete/:id", verifyToken, deleteIncident);

// manage compensation tickets
router.post("/:incident_id/compensation-ticket/add", verifyToken, isNotCustomer, createCompensateTicket);
router.get("/compensation-ticket/all", verifyToken, isManager, getAllCompensateTickets);
router.get("/compensation-ticket/:id", verifyToken, isNotCustomer, getCompensateTicketById);
router.patch("/compensation-ticket/:id", verifyToken, isNotCustomer, updateCompensateTicket);

// xác nhận đã bồi thường sự cố xong, có thể gọi API song song sau khi khách hàng thanh toán hóa đơn booking
router.post("/compensation-ticket/confirmed-done", verifyToken, isNotCustomer, confirmCompensationPaid);


export default router;