import express from "express";
import { VoucherController } from "../controllers/voucherController.js";
import { verifyToken, isManager, isCustomer } from "../../../shared/middleware/authMiddleware.js";

const router = express.Router();
const controller = new VoucherController();

router.post("/add", verifyToken, isManager, controller.createVoucher);
router.get("/all", controller.getAllVouchers);
router.get("/available", verifyToken, isCustomer, controller.getAvailableVouchers);
router.get("/:id", controller.getVoucherById);
router.patch("/update/:id", verifyToken, isManager, controller.updateVoucher);
router.delete("/delete/:id", verifyToken, isManager, controller.deleteVoucher);

export default router;