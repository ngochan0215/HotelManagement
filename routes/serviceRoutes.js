import express from "express";
import {
    createServiceCategory, updateServiceCategory, deleteServiceCategory, getAllServiceCategories,
    createService, updateService, deleteService, getServiceById, listAllServices, getServicesByCategoryId
} from "../controllers/serviceController.js";

import { isManager } from "../middleware/authMiddleware.js";
import { verifyToken } from "../middleware/authMiddleware.js";

const router = express.Router();

// manager manage service 
router.post('/service/new', verifyToken, isManager, createService);
router.patch('/service/update/:id', verifyToken, isManager, updateService);
router.delete('/service/delete/:id', verifyToken, isManager, deleteService);

// manager manage service category
router.post('/category/new', verifyToken, isManager, createServiceCategory);
router.patch('/category/update/:id', verifyToken, isManager, updateServiceCategory);
router.delete('/category/delete/:id', verifyToken, isManager, deleteServiceCategory);

// users can see all tasks and services
router.get('/category', getAllServiceCategories);
router.get("/category/:category_id/services", getServicesByCategoryId);

router.get('/service', listAllServices);
router.get('/service/:id', getServiceById);

export default router;