import express from "express";
import { isEmployee, isManager, isAdmin, verifyToken } from "../../../shared/middleware/authMiddleware.js";
import { ReceiptController } from "../controllers/receiptController.js";

const router = express.Router();
const receiptController = new ReceiptController();

router.post("/", verifyToken, isEmployee, receiptController.createReceipt);
router.get("/", verifyToken, isEmployee, receiptController.getAllReceipts);
router.get("/:id", verifyToken, isEmployee, receiptController.getReceiptById);

router.patch("/:id", verifyToken, isEmployee, receiptController.updateReceipt);
router.patch("/refreshing/:id", verifyToken, isEmployee, receiptController.refreshReceiptAfterCheckout); // Cập nhật hóa đơn sau checkout
router.patch("/mark-paid/:id", verifyToken, isEmployee, receiptController.markReceiptAsPaid);

export default router;