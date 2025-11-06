import express from "express";
import { createEquipmentCategory, updateEquipmentCategory, deleteEquipmentCategory,
        getAllEquipmentCategories, getEquipmentCategoryById,
        addEquipment, getAllEquipments, getEquipmentById, updateEquipment, deleteEquipment,
        createEquipmentTicket, getAllEquipmentTickets, getEquipmentTicketById, updateEquipmentTicket, deleteEquipmentTicket,
        createEquipmentImport, getAllEquipmentImports, getEquipmentImportById, updateEquipmentImport, deleteEquipmentImport,
        confirmEquipmentTicket
} from "../controllers/equipmentController.js";
import { isManager, verifyToken } from "../middleware/authMiddleware.js";

const router = express.Router();

//----DANH MỤC THIẾT BỊ - EQUIPMENT CATEGORY----//
router.post("/category/add", verifyToken, isManager, createEquipmentCategory);
router.put("/category/update/:id", verifyToken, isManager, updateEquipmentCategory);
router.delete("/category/delete/:id", verifyToken, isManager, deleteEquipmentCategory);
router.get("/category/all", verifyToken, getAllEquipmentCategories);
router.get("/category/:id", verifyToken, getEquipmentCategoryById);

//----THIẾT BỊ - EQUIPMENT----//
router.post("/add", verifyToken, isManager, addEquipment);
router.put("/update/:id", verifyToken, isManager, updateEquipment);
router.delete("/delete/:id", verifyToken, isManager, deleteEquipment);
router.get("/all", verifyToken, getAllEquipments);
router.get("/:id", verifyToken, getEquipmentById);

//----PHIẾU NHẬP THIẾT BỊ - EQUIPMENT TICKET----//
router.post("/ticket/add", verifyToken, isManager, createEquipmentTicket);
router.get("/ticket/all", verifyToken, getAllEquipmentTickets);
router.get("/ticket/:id", verifyToken, getEquipmentTicketById);
router.put("/ticket/:id", verifyToken, isManager, updateEquipmentTicket);
router.delete("/ticket/:id", verifyToken, isManager, deleteEquipmentTicket);

//----CHI TIẾT NHẬP THIẾT BỊ - EQUIPMENT IMPORT (each record = 1 type of equipment)----//
router.post("/import/add", verifyToken, isManager, createEquipmentImport);
router.get("/import/all", verifyToken, getAllEquipmentImports);
router.get("/import/:id", verifyToken, getEquipmentImportById);
router.put("/import/:id", verifyToken, isManager, updateEquipmentImport);
router.delete("/import/:id", verifyToken, isManager, deleteEquipmentImport);

router.post("/ticket/confirm/:id", verifyToken, isManager, confirmEquipmentTicket);

export default router;