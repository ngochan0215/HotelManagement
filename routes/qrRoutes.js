import express from "express";
import { verifyToken } from "../middleware/authMiddleware.js";
import { uploadQRImage } from "../middleware/uploadQRImage.js";
import { scanQRCode } from "../controllers/qrController.js";

const router = express.Router();

// API quét mã QR từ ảnh
router.post("/scan", verifyToken, uploadQRImage.single("image"), scanQRCode);

export default router;
