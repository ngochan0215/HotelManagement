import express from "express";
import { verifyToken, isManager, isEmployee, isNotCustomer } from "../../shared/middleware/authMiddleware.js";
import { EquipmentInstallController } from "../controllers/equipmentInstallController.js";

const router = express.Router();
const controller = new EquipmentInstallController();

// //----PHIẾU LẮP ĐẶT THIẾT BỊ----//
// router.get("/install/smart-suggestions", verifyToken, isManager, getSmartInstallSuggestions);
router.get("/my-tickets", verifyToken, isEmployee, controller.getMyInstallTickets);

// // tạo phiếu lắp đặt
// router.post("/install/add", verifyToken, isManager, createInstallTicket);
// // tạo phiếu tháo dỡ
// router.post("/install/uninstall", verifyToken, isManager, createUninstallTicket);

router.get("/all", verifyToken, isNotCustomer, controller.getAllEquipmentInstalls);
router.get("/:id", verifyToken, isNotCustomer, controller.getEquipmentInstallById);
// router.patch("/install/:id", verifyToken, isManager, updateEquipmentInstall);
// router.delete("/install/:id", verifyToken, isManager, deleteEquipmentInstall);

// // xác nhận trạng thái phiếu
// router.post("/install/:id/start", verifyToken, isEmployee, startInstallTicket);
// router.post("/install/:id/complete", verifyToken, isEmployee, completeInstallTicket);
// router.post("/install/:id/confirm-install", verifyToken, isManager, confirmEquipmentInstall);

export default router;