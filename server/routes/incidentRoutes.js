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

// phân công người xử lý
router.patch("/:id/assign", verifyToken, isManager, assignIncident);

// đánh dấu xử lý xong (Nhân viên hoặc Manager đều được)
router.patch("/:id/resolved", verifyToken, isNotCustomer, resolveIncident);

// đóng sự cố (Chỉ Manager)
router.patch("/:id/closed", verifyToken, isManager, closedIncident);

// manage compensation tickets
// hàm tạo phiếu cho sự cố thiết bị
router.post("/:incident_id/compensation-ticket/add", verifyToken, isNotCustomer, createCompensateTicket);
// hàm tạo phiếu cho sự cố không là thiết bị
router.post("/:incident_id/compensation-ticket/add-one", verifyToken, isNotCustomer, createCompensateTickett);

router.get("/compensation-ticket/all", verifyToken, isManager, getAllCompensateTickets);
router.get("/compensation-ticket/:id", verifyToken, isNotCustomer, getCompensateTicketById);
router.patch("/compensation-ticket/:id", verifyToken, isNotCustomer, updateCompensateTicket);

// xác nhận đã bồi thường sự cố xong
router.post("/compensation-ticket/confirmed-done", verifyToken, isNotCustomer, confirmCompensationPaid);

router.get("/:id", verifyToken, isManager, getIncidentById);
router.patch("/update/:id", verifyToken, updateIncident);
router.patch("/delete/:id", verifyToken, deleteIncident);

export default router;