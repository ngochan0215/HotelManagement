import express from "express";
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

export default router;
