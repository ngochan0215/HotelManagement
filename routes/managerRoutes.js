import express from "express";
import { verifyToken, isManager  } from "../middleware/authMiddleware.js";
import { createShift, updateShift, deleteShift, getShiftById, getAllShifts } from "../controllers/shiftController.js";
import { getAllUsers, getCalendarRooms, setRule } from "../controllers/managerController.js";

const router = express.Router();

//---- SHIFTS ----//
router.post("/shifts/add", verifyToken, isManager, createShift);
router.get("/shifts/all", verifyToken, getAllShifts);
router.get("/shifts/:id", verifyToken, getShiftById);
router.put("/shifts/:id", verifyToken, isManager, updateShift);
router.delete("/shifts/:id", verifyToken, isManager, deleteShift);

// RULE
router.post("/rule", verifyToken, isManager, setRule);
router.get("/all-users", verifyToken, isManager, getAllUsers);

// DASHBOARD
router.get("/calendar/rooms", verifyToken, isManager, getCalendarRooms);

export default router;
    