import express from "express";
import { verifyToken, isManager, isEmployee, isAdmin } from "../../../shared/middleware/authMiddleware.js";
import { EquipmentInstallController } from "../controllers/equipmentInstallController.js";

const router = express.Router();
const controller = new EquipmentInstallController();

// //----PHIẾU LẮP ĐẶT THIẾT BỊ----//
router.get("/install/smart-suggestions/:roomId", verifyToken, isManager, controller.getSmartInstallSuggestions);
router.get("/install/my", verifyToken, isEmployee, controller.getMyInstallTickets);

router.post("/install", verifyToken, isManager, controller.createInstallTicket);
router.post("/uninstall", verifyToken, isManager, controller.createUninstallTicket);

router.get("/install", verifyToken, isManager, controller.getAllEquipmentInstalls);
router.get("/install/:id", verifyToken, isEmployee, controller.getEquipmentInstallById);
router.patch("/install/:id", verifyToken, isManager, controller.updateEquipmentInstall);
router.delete("/install/:id", verifyToken, isManager, controller.deleteEquipmentInstall);

router.post("/install/mark-started/:id", verifyToken, isEmployee, controller.startInstallTicket);
router.post("/install/mark-completed/:id", verifyToken, isEmployee, controller.completeInstallTicket);
router.post("/install/mark-confirmed/:id", verifyToken, isManager, controller.confirmEquipmentInstall);

export default router;