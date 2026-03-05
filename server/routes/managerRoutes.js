import express from "express";
import { verifyToken, isManager  } from "../middleware/authMiddleware.js";
import { createShift, updateShift, deleteShift, getShiftById, getAllShifts } from "../controllers/shiftController.js";
import { ManagerController } from "../controllers/managerController.js";

const router = express.Router();
const controller = new ManagerController();

//---- SHIFTS ----//
router.post("/shifts/add", verifyToken, isManager, createShift);
router.get("/shifts/all", verifyToken, getAllShifts);
router.get("/shifts/:id", verifyToken, getShiftById);
router.put("/shifts/:id", verifyToken, isManager, updateShift);
router.delete("/shifts/:id", verifyToken, isManager, deleteShift);

// RULE
router.post("/rule", verifyToken, isManager, controller.setRule);
router.get("/all-users", verifyToken, isManager, controller.getAllUsers);

// DASHBOARD
router.get("/calendar/rooms", verifyToken, isManager, controller.getCalendarRooms);

export default router;
    