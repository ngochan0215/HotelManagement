import express from "express";
import { verifyToken, isManager, isEmployee, isNotCustomer } from "../../shared/middleware/authMiddleware.js";
import { EquipmentInstallController } from "../controllers/equipmentInstallController.js";

const router = express.Router();
const controller = new EquipmentInstallController();

// //----PHIẾU LẮP ĐẶT THIẾT BỊ----//
// router.get("/install/smart-suggestions", verifyToken, isManager, getSmartInstallSuggestions);
router.get("/my-tickets", verifyToken, isEmployee, controller.getMyInstallTickets);

router.post("/add", verifyToken, isManager, controller.createInstallTicket);
router.post("/uninstall/add", verifyToken, isManager, controller.createUninstallTicket);

router.get("/all", verifyToken, isNotCustomer, controller.getAllEquipmentInstalls);
router.get("/:id", verifyToken, isNotCustomer, controller.getEquipmentInstallById);
router.patch("/:id", verifyToken, isManager, controller.updateEquipmentInstall);
router.delete("/:id", verifyToken, isManager, controller.deleteEquipmentInstall);

router.post("/:id/start", verifyToken, isEmployee, controller.startInstallTicket);
router.post("/:id/complete", verifyToken, isEmployee, controller.completeInstallTicket);
router.post("/:id/confirm-install", verifyToken, isManager, controller.confirmEquipmentInstall);

export default router;