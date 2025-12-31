import express from "express";
import {
    createServiceCategory, updateServiceCategory, deleteServiceCategory, getAllServiceCategories,
    createService, updateService, deleteService, getServiceById, getAllServices, getServicesByCategoryId,
    createGoodTicket, getAllGoodTickets, getGoodTicketById, updateGoodTicket, deleteGoodTicket, confirmGoodTicket, 
    createServiceUsage, updateServiceUsage, getAllServiceUsage, getServiceUsageById, deleteServiceUsage,
    confirmUsageDetail,
    cancelUsageDetail,

} from "../controllers/serviceController.js";

import { isEmployee, isManager, isNotCustomer } from "../middleware/authMiddleware.js";
import { verifyToken } from "../middleware/authMiddleware.js";
import { uploadServiceImages, uploadServiceCategoryImages } from "../middleware/uploadImage.js";

const router = express.Router();

// manager manage service 
router.post('/add', verifyToken, isManager, uploadServiceImages.array("image", 5), createService);
router.patch('/update/:id', verifyToken, isManager, uploadServiceImages.array("image", 5), updateService);
router.delete('/delete/:id', verifyToken, isManager, deleteService);

// manager manage service category
router.post('/category/add', verifyToken, isManager, uploadServiceCategoryImages.array("image", 5), createServiceCategory);
router.patch('/category/update/:id', verifyToken, isManager, uploadServiceCategoryImages.array("image", 5), updateServiceCategory);
router.delete('/category/delete/:id', verifyToken, isManager, deleteServiceCategory);

//manager/employee manage goods import
router.post("/import/add", verifyToken, isManager, createGoodTicket);
router.get("/import/all", verifyToken, isNotCustomer, getAllGoodTickets);
router.get("/import/:id", verifyToken, isNotCustomer, getGoodTicketById);
router.patch("/import/:id", verifyToken, isManager, updateGoodTicket);
router.delete("/import/:id", verifyToken, isManager, deleteGoodTicket);
router.post("/import/:id/confirm", verifyToken, isManager, confirmGoodTicket);

// employee manage service usage
router.post("/usage/add", verifyToken, isNotCustomer, createServiceUsage);
router.get("/usage/all", verifyToken, isNotCustomer, getAllServiceUsage);
router.get("/usage/:id", verifyToken, isNotCustomer, getServiceUsageById);
router.delete("/usage/:id/delete", verifyToken, isNotCustomer, deleteServiceUsage);
router.patch("/usage/:id/update", verifyToken, isNotCustomer, updateServiceUsage);
router.post("/usage-details/:id/confirm", verifyToken, isNotCustomer, confirmUsageDetail);
router.post("/usage-details/:id/cancel", verifyToken, isNotCustomer, cancelUsageDetail);

// users can see all tasks and services
router.get('/category/all', getAllServiceCategories);
router.get("/category/:id", getServicesByCategoryId);

router.get('/all', getAllServices);
router.get('/:id', getServiceById);

export default router;