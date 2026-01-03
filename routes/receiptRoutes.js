import express from "express";
import { isNotCustomer, verifyToken } from "../middleware/authMiddleware.js";
import { createReceipt, getAllReceipts, getReceiptById, updateReceipt } from "../controllers/receiptControllers.js";

const router = express.Router();

router.post("/add", verifyToken, isNotCustomer, createReceipt);
router.get("/all", verifyToken, isNotCustomer, getAllReceipts);
router.get("/:id", verifyToken, isNotCustomer, getReceiptById);
router.patch("/update/:id", verifyToken, isNotCustomer, updateReceipt);

export default router;