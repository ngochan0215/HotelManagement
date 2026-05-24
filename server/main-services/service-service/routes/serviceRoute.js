import express from "express";
<<<<<<< HEAD
import { ServiceController } from "../controllers/serviceController.js";
import { isEmployee, isManager, verifyToken } from "../../../shared/middleware/authMiddleware.js";
import { uploadServiceImages, uploadServiceCategoryImages } from "../utils/uploadImage.js";

const isNotCustomer = isEmployee;
const router = express.Router();
const controller = new ServiceController();

router.post("/add", verifyToken, isManager, uploadServiceImages.array("image", 5), controller.createService);
router.patch("/update/:id", verifyToken, isManager, uploadServiceImages.array("image", 5), controller.updateService);
router.delete("/delete/:id", verifyToken, isManager, controller.deleteService);

router.post("/category/add", verifyToken, isManager, uploadServiceCategoryImages.array("image", 5), controller.createServiceCategory);
router.patch("/category/update/:id", verifyToken, isManager, uploadServiceCategoryImages.array("image", 5), controller.updateServiceCategory);
router.delete("/category/delete/:id", verifyToken, isManager, controller.deleteServiceCategory);

router.get("/import/out-of-stock", verifyToken, isManager, controller.getOutOfStockServices);
router.post("/import/add", verifyToken, isManager, controller.createGoodTicket);
router.post("/import/auto-create", verifyToken, isManager, controller.autoCreateGoodTicket);
router.get("/import/all", verifyToken, isNotCustomer, controller.getAllGoodTickets);
router.get("/import/:id", verifyToken, isNotCustomer, controller.getGoodTicketById);
router.patch("/import/:id", verifyToken, isManager, controller.updateGoodTicket);
router.delete("/import/:id", verifyToken, isManager, controller.deleteGoodTicket);
router.post("/import/:id/confirm", verifyToken, isManager, controller.confirmGoodTicket);

router.post("/usage/add", verifyToken, isNotCustomer, controller.createServiceUsage);
router.get("/usage/all", verifyToken, isNotCustomer, controller.getAllServiceUsage);
router.get("/usage/:id", verifyToken, isNotCustomer, controller.getServiceUsageById);
router.delete("/usage/:id/delete", verifyToken, isNotCustomer, controller.deleteServiceUsage);
router.patch("/usage/:id/update", verifyToken, isNotCustomer, controller.updateServiceUsage);
router.post("/usage-details/:id/confirm", verifyToken, isNotCustomer, controller.confirmUsageDetail);
router.post("/usage-details/:id/cancel", verifyToken, isNotCustomer, controller.cancelUsageDetail);
router.post("/usage/:id/confirm", verifyToken, isNotCustomer, controller.confirmServiceUsage);
router.post("/usage/:id/cancel", verifyToken, isNotCustomer, controller.cancelServiceUsage);

router.get("/category/all", controller.getAllServiceCategories);
router.get("/category/:id", controller.getServicesByCategoryId);

router.get("/all", controller.getAllServices);
router.get("/:id", controller.getServiceById);
=======
import {
    createServiceCategory, updateServiceCategory, deleteServiceCategory, getAllServiceCategories,
    createService, updateService, deleteService, getServiceById, getAllServices, getServicesByCategoryId,
    createGoodTicket, getAllGoodTickets, getGoodTicketById, updateGoodTicket, deleteGoodTicket, confirmGoodTicket,
    createServiceUsage, updateServiceUsage, getAllServiceUsage, getServiceUsageById, deleteServiceUsage,
    confirmUsageDetail,
    cancelUsageDetail,
    confirmServiceUsage,
    cancelServiceUsage,
    getOutOfStockServices, autoCreateGoodTicket
} from "../controllers/serviceController.js";
import { isEmployee, isManager, verifyToken } from "../../../shared/middleware/authMiddleware.js";

const isNotCustomer = isEmployee;
import { uploadServiceImages, uploadServiceCategoryImages } from "../utils/uploadImage.js";

const router = express.Router();

router.post("/add", verifyToken, isManager, uploadServiceImages.array("image", 5), createService);
router.patch("/update/:id", verifyToken, isManager, uploadServiceImages.array("image", 5), updateService);
router.delete("/delete/:id", verifyToken, isManager, deleteService);

router.post("/category/add", verifyToken, isManager, uploadServiceCategoryImages.array("image", 5), createServiceCategory);
router.patch("/category/update/:id", verifyToken, isManager, uploadServiceCategoryImages.array("image", 5), updateServiceCategory);
router.delete("/category/delete/:id", verifyToken, isManager, deleteServiceCategory);

router.get("/import/out-of-stock", verifyToken, isManager, getOutOfStockServices);
router.post("/import/add", verifyToken, isManager, createGoodTicket);
router.post("/import/auto-create", verifyToken, isManager, autoCreateGoodTicket);
router.get("/import/all", verifyToken, isNotCustomer, getAllGoodTickets);
router.get("/import/:id", verifyToken, isNotCustomer, getGoodTicketById);
router.patch("/import/:id", verifyToken, isManager, updateGoodTicket);
router.delete("/import/:id", verifyToken, isManager, deleteGoodTicket);
router.post("/import/:id/confirm", verifyToken, isManager, confirmGoodTicket);

router.post("/usage/add", verifyToken, isNotCustomer, createServiceUsage);
router.get("/usage/all", verifyToken, isNotCustomer, getAllServiceUsage);
router.get("/usage/:id", verifyToken, isNotCustomer, getServiceUsageById);
router.delete("/usage/:id/delete", verifyToken, isNotCustomer, deleteServiceUsage);
router.patch("/usage/:id/update", verifyToken, isNotCustomer, updateServiceUsage);
router.post("/usage-details/:id/confirm", verifyToken, isNotCustomer, confirmUsageDetail);
router.post("/usage-details/:id/cancel", verifyToken, isNotCustomer, cancelUsageDetail);
router.post("/usage/:id/confirm", verifyToken, isNotCustomer, confirmServiceUsage);
router.post("/usage/:id/cancel", verifyToken, isNotCustomer, cancelServiceUsage);

router.get("/category/all", getAllServiceCategories);
router.get("/category/:id", getServicesByCategoryId);

router.get("/all", getAllServices);
router.get("/:id", getServiceById);
>>>>>>> main

export default router;
