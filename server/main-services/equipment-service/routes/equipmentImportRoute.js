import express from "express";
import { EquipmentImportController } from "../controllers/equipmentImportController.js";
import { verifyToken, isManager, isEmployee } from "../../../shared/middleware/authMiddleware.js";

const router = express.Router();
const controller = new EquipmentImportController();

router.get("/import", verifyToken, isEmployee, controller.getAllEquipmentTickets);
router.get("/import/:id", verifyToken, isEmployee, controller.getEquipmentTicketById);

router.post("/import", verifyToken, isManager, controller.createEquipmentTicket);
router.post("/import/auto-create", verifyToken, isManager, controller.autoCreateImportTicket);

router.patch("/import/:id", verifyToken, isManager, controller.updateEquipmentTicket);
router.delete("/import/:id", verifyToken, isManager, controller.deleteEquipmentTicket);
router.post("/import/mark-confirmed/:id", verifyToken, isManager, controller.confirmEquipmentImportTicket)

export default router;