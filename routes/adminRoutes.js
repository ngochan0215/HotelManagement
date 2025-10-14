import express from "express";
import { registerEmployee, getAllEmployess, getAllCustomers } from "../controllers/adminController.js";
import { verifyToken, isAdmin } from "../middleware/authMiddleware.js";

const router = express.Router();

router.post("/registerEmployee", verifyToken, isAdmin, registerEmployee);
router.get("/employees", verifyToken, isAdmin, getAllEmployess);
router.get("/customers", verifyToken, isAdmin, getAllCustomers);

export default router;
    