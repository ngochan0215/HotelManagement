import express from "express";
import { EquipmentImportController } from "../controllers/equipmentImportController.js";
import { verifyToken, isManager, isNotCustomer } from "../../../shared/middleware/authMiddleware.js";

const router = express.Router();
const controller = new EquipmentImportController();

router.get("/out-of-stock", verifyToken, isManager, controller.getOutOfStockCategories);
router.post("/add", verifyToken, isManager, controller.createEquipmentTicket);
router.post("/auto-create", verifyToken, isManager, controller.autoCreateImportTicket);
router.get("/all", verifyToken, isNotCustomer, controller.getAllEquipmentTickets);
router.get("/:id", verifyToken, isNotCustomer, controller.getEquipmentTicketById);
router.patch("/:id", verifyToken, isManager, controller.updateEquipmentTicket);
router.delete("/:id", verifyToken, isManager, controller.deleteEquipmentTicket);
router.post("/:id/confirm", verifyToken, isManager, controller.confirmEquipmentImportTicket)

export default router;