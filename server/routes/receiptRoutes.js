import express from "express";
import { isNotCustomer, verifyToken } from "../middleware/authMiddleware.js";
import { createReceipt, getAllReceipts, getReceiptById, updateReceipt 
    , markReceiptAsPaid
} from "../controllers/receiptControllers.js";
import { createPaymentLink, initiatePayout, getLinkDetail, getPaymentTransactionDetail, 
    updateSuccessfulTransaction, updateFailedTransaction, payoutStatusDetail, 
    payoutStatusDetailList
} from "../controllers/paymentController.js";

const router = express.Router();

// hóa đơn
router.post("/add", verifyToken, isNotCustomer, createReceipt);
router.get("/all", verifyToken, isNotCustomer, getAllReceipts);
router.get("/:id", verifyToken, isNotCustomer, getReceiptById);
router.patch("/update/:id", verifyToken, isNotCustomer, updateReceipt);
router.patch("/:id/paid", verifyToken, isNotCustomer, markReceiptAsPaid);

// payment - payos
router.post("/paymentLink/:userId", createPaymentLink); //API tạo link thanh toán
router.post("/payout/:userId", initiatePayout); //API tạo payout chuyển tiền cho tasker
router.get("/paymentLink/:paymentId", getLinkDetail); //API lấy chi tiết link thanh toán

// payout - payos
router.get("/payout", payoutStatusDetailList); //danh sách chi tiết payout chuyển tiền cho tasker
router.get("/payout/:referenceId", payoutStatusDetail); //chi tiết payout chuyển tiền cho tasker

router.get("/:bookingId", getPaymentTransactionDetail);   
router.patch("/:bookingId/success", updateSuccessfulTransaction); 
router.patch("/:bookingId/failed", updateFailedTransaction);

export default router;