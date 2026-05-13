import express from "express";
import { DiscountController } from "../controllers/discountController.js";
import { verifyToken, isManager, isAdmin } from "../../../shared/middleware/authMiddleware.js";

const router = express.Router();
const controller = new DiscountController();

router.post("/", verifyToken, isAdmin, controller.createDiscount);
router.get("/", controller.getAllDiscounts);
router.get("/available", controller.getAvailableDiscounts);
router.get("/:id", controller.getDiscountById);
router.patch("/:id", verifyToken, isAdmin, controller.updateDiscount);
router.delete("/:id", verifyToken, isAdmin, controller.deleteDiscount);

export default router;