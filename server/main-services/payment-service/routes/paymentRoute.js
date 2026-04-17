import express from "express";
import { isNotCustomer, verifyToken } from "../../../shared/middleware/authMiddleware.js";

import { ReceiptController } from "../controllers/receiptController.js";
import { TransactionController } from "../controllers/transactionController.js";

const router = express.Router();
const receiptController = new ReceiptController();
const transactionController = new TransactionController();

// transaction
router.post("/paymentLink/:userId", transactionController.createPaymentLink); //API tạo link thanh toán
router.post("/payout/:userId", transactionController.initiatePayout); //API tạo payout trả lương cho nhân viên
router.get("/paymentLink/:paymentId", transactionController.getLinkDetail); //API lấy chi tiết link thanh toán

// router.get("/payout", transactionController.payoutStatusDetailList); //danh sách chi tiết payout chuyển tiền cho tasker
// router.get("/payout/:referenceId", transactionController.payoutStatusDetail); //chi tiết payout chuyển tiền cho tasker

router.get("/transaction/:bookingId", transactionController.getPaymentTransactionDetail);   
router.patch("/transaction/:bookingId/success", transactionController.updateSuccessfulTransaction); 
router.patch("/transaction/:bookingId/failed", transactionController.updateFailedTransaction);

// receipt
router.post("/receipt/add", verifyToken, isNotCustomer, receiptController.createReceipt);
router.get("/receipt/all", verifyToken, isNotCustomer, receiptController.getAllReceipts);
router.patch("/receipt/update/:id", verifyToken, isNotCustomer, receiptController.updateReceipt);
router.patch("/receipt/:id/refresh", verifyToken, isNotCustomer, receiptController.refreshReceiptAfterCheckout); // Cập nhật hóa đơn sau checkout
router.patch("/receipt/:id/paid", verifyToken, isNotCustomer, receiptController.markReceiptAsPaid);
router.get("/receipt/:id", verifyToken, isNotCustomer, receiptController.getReceiptById);

export default router;