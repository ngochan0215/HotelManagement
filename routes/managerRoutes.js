import express from "express";
import { verifyToken, isManager  } from "../middleware/authMiddleware.js";
import { createShift, updateShift, deleteShift, getShiftById, getAllShifts } from "../controllers/shiftController.js";
import { getAllCustomers } from "../controllers/managerController.js";

const router = express.Router();

//---- SHIFTS ----//
router.post("/add", verifyToken, isManager, createShift);
router.get("/all", verifyToken, getAllShifts);
router.get("/:id", verifyToken, getShiftById);
router.put("/:id", verifyToken, isManager, updateShift);
router.delete("/:id", verifyToken, isManager, deleteShift);

// CUSTOMER
router.get("/customers", verifyToken, isManager, getAllCustomers);

export default router;
    