import express from "express";
import { VoucherController } from "../controllers/voucherController.js";
import { verifyToken, isManager, isCustomer, isAdmin } from "../../../shared/middleware/authMiddleware.js";

const router = express.Router();
const controller = new VoucherController();

router.post("/add", verifyToken, isAdmin, controller.createVoucher);
router.get("/all", verifyToken, controller.getAllVouchers);
router.get("/available", verifyToken, isCustomer, controller.getAvailableVouchers);
router.get("/:id", verifyToken, controller.getVoucherById);
router.patch("/update/:id", verifyToken, isAdmin, controller.updateVoucher);
router.delete("/delete/:id", verifyToken, isAdmin, controller.deleteVoucher);

export default router;