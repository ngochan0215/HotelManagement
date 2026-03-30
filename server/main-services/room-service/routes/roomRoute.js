import express from "express";
import { RoomController } from "../controllers/roomController.js";

const router = express.Router();
const controller = new RoomController();

router.get("/:id", controller.getRoomById);

export default router;