import express from "express";
import { isNotCustomer, verifyToken } from "../../../shared/middleware/authMiddleware.js";
import { TransactionController } from "../controllers/transactionController.js";

const router = express.Router();
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

export default router;