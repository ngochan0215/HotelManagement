import express from "express";
import { EquipmentController } from "../controllers/equipmentController.js";
import { verifyToken, isManager, isNotCustomer } from "../../../shared/middleware/authMiddleware.js";

const router = express.Router();
const controller = new EquipmentController();

//----EQUIPMENT CATEGORY----//
router.post("/category/add", verifyToken, isManager, controller.createEquipmentCategory);
router.get("/category/all", verifyToken, controller.getAllEquipmentCategories);
router.patch("/category/:id", verifyToken, isManager, controller.updateEquipmentCategory);
router.delete("/category/:id", verifyToken, isManager, controller.deleteEquipmentCategory);
router.get("/category/:id", verifyToken, controller.getEquipmentCategoryById);
router.post("/category/sync-quantities", verifyToken, isManager, controller.syncEquipmentCategoryQuantities);

//----EQUIPMENT----//
router.get("/all", verifyToken, isNotCustomer, controller.getAllEquipments);
router.patch("/:id", verifyToken, isNotCustomer, controller.updateEquipment);
router.delete("/:id", verifyToken, isManager, controller.deleteEquipment);
router.get("/:id", verifyToken, isNotCustomer, controller.getEquipmentById);

export default router;