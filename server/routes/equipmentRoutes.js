import express from "express";
import { createEquipmentCategory, updateEquipmentCategory, deleteEquipmentCategory,
        getAllEquipmentCategories, getEquipmentCategoryById,
        getAllEquipments, getEquipmentById, updateEquipment, deleteEquipment,
        createEquipmentTicket, getAllEquipmentTickets, getEquipmentTicketById, updateEquipmentTicket, deleteEquipmentTicket, 
        createInstallTicket, getAllEquipmentInstalls, getEquipmentInstallById, updateEquipmentInstall, deleteEquipmentInstall,
        confirmEquipmentInstall,
        confirmEquipmentImportTicket
} from "../controllers/equipmentController.js";
import { isManager, isNotCustomer, verifyToken } from "../middleware/authMiddleware.js";

const router = express.Router();

//----DANH MỤC THIẾT BỊ - EQUIPMENT CATEGORY----//
router.post("/category/add", verifyToken, isManager, createEquipmentCategory);
router.patch("/category/:id", verifyToken, isManager, updateEquipmentCategory);
router.delete("/category/:id", verifyToken, isManager, deleteEquipmentCategory);
router.get("/category/all", verifyToken, getAllEquipmentCategories);
router.get("/category/:id", verifyToken, getEquipmentCategoryById);

//----THIẾT BỊ - EQUIPMENT----//
router.patch("/:id", verifyToken, isNotCustomer, updateEquipment);
router.delete("/:id", verifyToken, isManager, deleteEquipment);
router.get("/all", verifyToken, isNotCustomer, getAllEquipments);
router.get("/:id", verifyToken, isNotCustomer, getEquipmentById);

//----PHIẾU NHẬP THIẾT BỊ - EQUIPMENT TICKET----//
router.post("/ticket/add", verifyToken, isManager, createEquipmentTicket);
router.get("/ticket/all", verifyToken, isNotCustomer, getAllEquipmentTickets);
router.get("/ticket/:id", verifyToken, isNotCustomer, getEquipmentTicketById);
router.patch("/ticket/:id", verifyToken, isManager, updateEquipmentTicket);
router.delete("/ticket/:id", verifyToken, isManager, deleteEquipmentTicket);
router.post("/ticket/:id/confirm-import", verifyToken, isManager, confirmEquipmentImportTicket)

//----PHIẾU LẮP ĐẶT THIẾT BỊ----//
router.post("/install/add", verifyToken, isManager, createInstallTicket);
router.get("/install/all", verifyToken, isNotCustomer, getAllEquipmentInstalls);
router.get("/install/:id", verifyToken, isNotCustomer, getEquipmentInstallById);
router.patch("/install/:id", verifyToken, isManager, updateEquipmentInstall);
router.delete("/install/:id", verifyToken, isManager, deleteEquipmentInstall);
router.post("/install/:id/confirm-install", verifyToken, isManager, confirmEquipmentInstall);

export default router;

//----CHI TIẾT NHẬP THIẾT BỊ - EQUIPMENT IMPORT (each record = 1 type of equipment)----//
// router.post("/import/add", verifyToken, isManager, createEquipmentImport);
// router.get("/import/all", verifyToken, getAllEquipmentImports);
// router.get("/import/:id", verifyToken, getEquipmentImportById);
// router.put("/import/:id", verifyToken, isManager, updateEquipmentImport);
// router.delete("/import/:id", verifyToken, isManager, deleteEquipmentImport);
// router.post("/ticket/confirm/:id", verifyToken, isManager, confirmEquipmentTicket);