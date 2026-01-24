import express from "express";
import { createDiscount, updateDiscount, deleteDiscount, getAllDiscounts, getDiscountById, 
    getAvailableDiscounts,
} from "../controllers/discountController.js";
import { verifyToken } from "../middleware/authMiddleware.js";
import { isManager } from "../middleware/authMiddleware.js";

const router = express.Router();

router.post("/add", verifyToken, isManager, createDiscount);
router.get("/all", getAllDiscounts);
router.get("/available", getAvailableDiscounts);
router.get("/:id", getDiscountById);
router.patch("/update/:id", verifyToken, isManager, updateDiscount);
router.delete("/delete/:id", verifyToken, isManager, deleteDiscount);

export default router;