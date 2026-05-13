import express from "express";
import { EquipmentController } from "../controllers/equipmentController.js";
import { verifyToken, isManager, isEmployee, isAdmin
 } from "../../../shared/middleware/authMiddleware.js";

const router = express.Router();
const controller = new EquipmentController();

//----EQUIPMENT CATEGORY----//
router.get("/categories/out-of-stock", verifyToken, isManager, controller.getOutOfStockCategories);
router.get("/categories", verifyToken, controller.getAllEquipmentCategories);
router.get("/categories/:id", verifyToken, controller.getEquipmentCategoryById);

router.post("/categories", verifyToken, isAdmin, controller.createEquipmentCategory);
router.patch("/categories/:id", verifyToken, isAdmin, controller.updateEquipmentCategory);
router.delete("/categories/:id", verifyToken, isAdmin, controller.deleteEquipmentCategory);
router.post("/categories/sync-quantities", verifyToken, isManager, controller.syncEquipmentCategoryQuantities);

//----EQUIPMENT----//
router.get("/", verifyToken, isEmployee, controller.getAllEquipments);
router.patch("/:id", verifyToken, isEmployee, controller.updateEquipment);
router.delete("/:id", verifyToken, isEmployee, controller.deleteEquipment);
router.get("/:id", verifyToken, isEmployee, controller.getEquipmentById);

// report
router.get("/statistics/reports/json", controller.generateEquipmentReport);
router.get("/statistics/reports/excel", controller.exportEquipmentReportExcel);
router.get("/statistics/reports/pdf", controller.exportEquipmentReportPDF); 

export default router;