import express from "express";
import { CustomerController } from "../controllers/customerController.js";
import { uploadQRImage } from "../utils/uploadQrImage.js";
import { isManager, verifyToken, isEmployee, isAdmin, isCustomer } from "../../../shared/middleware/authMiddleware.js";

const router = express.Router();
const customerController = new CustomerController();

// customer self-service — must be before /:id
router.get("/me", verifyToken, isCustomer, customerController.getMyProfile);
router.patch("/me", verifyToken, isCustomer, customerController.updateMyProfile);

// manager and employee
router.get("/", verifyToken, isEmployee, customerController.getAllCustomers);
router.get("/:id", verifyToken, isManager, customerController.getCustomerById);

router.get("/statistics/reports/json", verifyToken, isManager, customerController.generateCustomerReport);
router.get("/statistics/reports/excel", verifyToken, isManager, customerController.exportCustomerReportExcel);
router.get("/statistics/reports/pdf", verifyToken, isManager, customerController.exportCustomerReportPDF); 

router.patch("/:id", verifyToken, isManager, customerController.updateCustomer);
router.patch("/:id/ban", verifyToken, isManager, customerController.banCustomer);
router.patch("/:id/unban", verifyToken, isManager, customerController.unbanCustomer);

router.post("/create-customer/scan-qr", verifyToken, isEmployee, uploadQRImage.single("image"), customerController.scanQRCode);

// for communication between services
router.post("/create-customer/:userId", customerController.createCustomer);

export default router;