import express from "express";
import { EquipmentController } from "../controllers/equipmentController.js";
import { verifyToken, isManager, isNotCustomer } from "../../../shared/middleware/authMiddleware.js";

const router = express.Router();
const controller = new EquipmentController();

//----EQUIPMENT CATEGORY----//
router.get("/categories/out-of-stock", verifyToken, isManager, controller.getOutOfStockCategories);
router.get("/categories", verifyToken, controller.getAllEquipmentCategories);
router.get("/categories/:id", verifyToken, controller.getEquipmentCategoryById);

router.post("/categories", verifyToken, isManager, controller.createEquipmentCategory);
router.patch("/categories/:id", verifyToken, isManager, controller.updateEquipmentCategory);
router.delete("/categories/:id", verifyToken, isManager, controller.deleteEquipmentCategory);
router.post("/categories/sync-quantities", verifyToken, isManager, controller.syncEquipmentCategoryQuantities);

//----EQUIPMENT----//
router.get("/", verifyToken, isNotCustomer, controller.getAllEquipments);
router.patch("/:id", verifyToken, isNotCustomer, controller.updateEquipment);
router.delete("/:id", verifyToken, isManager, controller.deleteEquipment);
router.get("/:id", verifyToken, isNotCustomer, controller.getEquipmentById);

export default router;