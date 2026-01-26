import express from "express";
import { createEquipmentCategory, updateEquipmentCategory, deleteEquipmentCategory,
        getAllEquipmentCategories, getEquipmentCategoryById,
        getAllEquipments, getEquipmentById, updateEquipment, deleteEquipment,
        createEquipmentTicket, getAllEquipmentTickets, getEquipmentTicketById, updateEquipmentTicket, deleteEquipmentTicket, 
        createInstallTicket, createUninstallTicket, getAllEquipmentInstalls, getEquipmentInstallById, updateEquipmentInstall, deleteEquipmentInstall,
        confirmEquipmentInstall, startInstallTicket, completeInstallTicket, getAvailableTechnicians, getMyInstallTickets,
        confirmEquipmentImportTicket, getSmartInstallSuggestions, autoCreateImportTicket, getOutOfStockCategories,
        syncEquipmentCategoryQuantities
} from "../controllers/equipmentController.js";
import { isManager, isNotCustomer, verifyToken, isEmployee } from "../middleware/authMiddleware.js";

const router = express.Router();

//----DANH MỤC THIẾT BỊ - EQUIPMENT CATEGORY----//
router.post("/category/add", verifyToken, isManager, createEquipmentCategory);
router.patch("/category/:id", verifyToken, isManager, updateEquipmentCategory);
router.delete("/category/:id", verifyToken, isManager, deleteEquipmentCategory);
router.get("/category/all", verifyToken, getAllEquipmentCategories);
router.get("/category/:id", verifyToken, getEquipmentCategoryById);
router.post("/category/sync-quantities", verifyToken, isManager, syncEquipmentCategoryQuantities);

//----THIẾT BỊ - EQUIPMENT----//
router.patch("/:id", verifyToken, isNotCustomer, updateEquipment);
router.delete("/:id", verifyToken, isManager, deleteEquipment);
router.get("/all", verifyToken, isNotCustomer, getAllEquipments);
router.get("/:id", verifyToken, isNotCustomer, getEquipmentById);

//----PHIẾU NHẬP THIẾT BỊ - EQUIPMENT TICKET----//
router.get("/ticket/out-of-stock", verifyToken, isManager, getOutOfStockCategories);
router.post("/ticket/add", verifyToken, isManager, createEquipmentTicket);
router.post("/ticket/auto-create", verifyToken, isManager, autoCreateImportTicket);
router.get("/ticket/all", verifyToken, isNotCustomer, getAllEquipmentTickets);
router.get("/ticket/:id", verifyToken, isNotCustomer, getEquipmentTicketById);
router.patch("/ticket/:id", verifyToken, isManager, updateEquipmentTicket);
router.delete("/ticket/:id", verifyToken, isManager, deleteEquipmentTicket);
router.post("/ticket/:id/confirm-import", verifyToken, isManager, confirmEquipmentImportTicket)

//----PHIẾU LẮP ĐẶT THIẾT BỊ----//
router.get("/install/available-technicians", verifyToken, isManager, getAvailableTechnicians);
router.get("/install/smart-suggestions", verifyToken, isManager, getSmartInstallSuggestions);
router.get("/install/my-tickets", verifyToken, isEmployee, getMyInstallTickets);

// tạo phiếu lắp đặt
router.post("/install/add", verifyToken, isManager, createInstallTicket);
// tạo phiếu tháo dỡ
router.post("/install/uninstall", verifyToken, isManager, createUninstallTicket);

router.get("/install/all", verifyToken, isNotCustomer, getAllEquipmentInstalls);
router.get("/install/:id", verifyToken, isNotCustomer, getEquipmentInstallById);
router.patch("/install/:id", verifyToken, isManager, updateEquipmentInstall);
router.delete("/install/:id", verifyToken, isManager, deleteEquipmentInstall);

// xác nhận trạng thái phiếu
router.post("/install/:id/start", verifyToken, isEmployee, startInstallTicket);
router.post("/install/:id/complete", verifyToken, isEmployee, completeInstallTicket);
router.post("/install/:id/confirm-install", verifyToken, isManager, confirmEquipmentInstall);

export default router;
