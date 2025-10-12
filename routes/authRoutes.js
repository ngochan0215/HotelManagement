import express from "express";
import { forgotPassword, resetPassword, Login} from "../controllers/authControllers.js";

const router = express.Router();

router.post("/login", Login);
router.post("/forgot-password", forgotPassword);
router.post("/reset-password", resetPassword);

export default router;
    