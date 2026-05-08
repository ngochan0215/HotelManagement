import express from "express";
import { isNotCustomer, verifyToken } from "../../../shared/middleware/authMiddleware.js";
import { ReceiptController } from "../controllers/receiptController.js";

const router = express.Router();
const receiptController = new ReceiptController();

router.post("/", verifyToken, isNotCustomer, receiptController.createReceipt);
router.get("/", verifyToken, isNotCustomer, receiptController.getAllReceipts);
router.get("/:id", verifyToken, isNotCustomer, receiptController.getReceiptById);

router.patch("/:id", verifyToken, isNotCustomer, receiptController.updateReceipt);
router.patch("/refreshing/:id", verifyToken, isNotCustomer, receiptController.refreshReceiptAfterCheckout); // Cập nhật hóa đơn sau checkout
router.patch("/mark-paid/:id", verifyToken, isNotCustomer, receiptController.markReceiptAsPaid);

export default router;