import express from "express";
import { ServiceController } from "../controllers/serviceController.js";
import { isEmployee, isManager, verifyToken, isAdmin } from "../../../shared/middleware/authMiddleware.js";
import { uploadServiceImages, uploadServiceCategoryImages } from "../utils/uploadImage.js";

const router = express.Router();
const controller = new ServiceController();

router.get("/categories", controller.getAllServiceCategories);
router.get("/", controller.getAllServices);
router.get("/public/assets", controller.getAllAssetsServices);
router.get("/public/slots", controller.getAllSlotsServices);
router.get("/import-tickets/out-of-stock", verifyToken, isEmployee, controller.getOutOfStockServices);
router.get("/import-tickets", verifyToken, isEmployee, controller.getAllGoodTickets);
router.get("/usage-tickets/all", verifyToken, isEmployee, controller.getAllServiceUsage);
router.get("/assets", verifyToken, isEmployee, controller.getAllAssetsServices);
router.get("/slots", verifyToken, isEmployee, controller.getAllSlotsServices);

router.get("/categories/:id", controller.getServicesByCategoryId);
router.get("/import-tickets/:id", verifyToken, isEmployee, controller.getGoodTicketById);
router.get("/usage-tickets/:id", verifyToken, isEmployee, controller.getServiceUsageById);
router.get("/assets/:id", verifyToken, isEmployee, controller.getAssetServiceById);
router.get("/slots/:id", verifyToken, isEmployee, controller.getSlotServiceById);
router.get("/:id", controller.getServiceById);

router.post("/", verifyToken, isAdmin, uploadServiceImages.array("image", 5), controller.createService);
router.patch("/:id", verifyToken, isManager, uploadServiceImages.array("image", 5), controller.updateService);
router.delete("/:id", verifyToken, isAdmin, controller.deleteService);
    
router.post("/categories", verifyToken, isAdmin, uploadServiceCategoryImages.array("image", 5), controller.createServiceCategory);
router.patch("/categories/:id", verifyToken, isAdmin, uploadServiceCategoryImages.array("image", 5), controller.updateServiceCategory);
router.delete("/categories/:id", verifyToken, isAdmin, controller.deleteServiceCategory);

router.post("/import-tickets", verifyToken, isManager, controller.createGoodTicket);
router.post("/import-tickets/auto-create", verifyToken, isManager, controller.autoCreateGoodTicket);
router.patch("/import-tickets/:id", verifyToken, isManager, controller.updateGoodTicket);
router.delete("/import-tickets/:id", verifyToken, isManager, controller.deleteGoodTicket);
router.post("/import-tickets/:id/confirm", verifyToken, isManager, controller.confirmGoodTicket);

router.post("/usage-tickets", verifyToken, isEmployee, controller.createServiceUsage);
router.delete("/usage-tickets/:id", verifyToken, isEmployee, controller.deleteServiceUsage);
router.patch("/usage-tickets/:id", verifyToken, isEmployee, controller.updateServiceUsage);

router.post("/usage-details/:id/confirm", verifyToken, isEmployee, controller.confirmUsageDetail);
router.post("/usage-details/:id/cancel", verifyToken, isEmployee, controller.cancelUsageDetail);

router.post("/usage-tickets/:id/confirm", verifyToken, isEmployee, controller.confirmServiceUsage);
router.post("/usage-tickets/:id/cancel", verifyToken, isEmployee, controller.cancelServiceUsage);

router.post("/assets", verifyToken, isAdmin, controller.createAssetService);
router.patch("/assets/:id", verifyToken, isManager, controller.updateAssetService);
router.delete("/assets/:id", verifyToken, isAdmin, controller.deleteAssetService);

router.post("/slots", verifyToken, isAdmin, controller.createSlotService);
router.patch("/slots/:id", verifyToken, isManager, controller.updateSlotService);
router.delete("/slots/:id", verifyToken, isAdmin, controller.deleteSlotService);
router.post("/slots/:id/close", verifyToken, isAdmin, controller.closeSlotService);

export default router;
