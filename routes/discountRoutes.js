import express from "express";
import { addNewDiscount, updateDiscount, deleteDiscount, getAllDiscounts, getDiscountById } from "../controllers/discountController.js";
import { verifyToken } from "../middleware/authMiddleware.js";
import { isManager } from "../middleware/authMiddleware.js";

const router = express.Router();

router.post("/add", verifyToken, isManager, addNewDiscount);
router.get("/all", getAllDiscounts);
router.get("/:id", getDiscountById);
router.patch("/update/:id", verifyToken, isManager, updateDiscount);
router.delete("/delete/:id", verifyToken, isManager, deleteDiscount);

export default router;