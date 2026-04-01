import express from "express";
import { DiscountController } from "../controllers/discountController.js";
import { verifyToken, isManager } from "../../../shared/middleware/authMiddleware.js";

const router = express.Router();
const controller = new DiscountController();

router.post("/add", verifyToken, isManager, controller.createDiscount);
router.get("/all", controller.getAllDiscounts);
router.get("/available", controller.getAvailableDiscounts);
router.get("/:id", controller.getDiscountById);
router.patch("/update/:id", verifyToken, isManager, controller.updateDiscount);
router.delete("/delete/:id", verifyToken, isManager, controller.deleteDiscount);

export default router;