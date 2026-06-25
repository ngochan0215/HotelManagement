import express from "express";
import { ReviewController } from "../controllers/reviewController.js";
import { verifyToken, isManager } from "../../../shared/middleware/authMiddleware.js";

const router = express.Router();
const controller = new ReviewController();

router.get("/public", controller.getPublicReviews);
router.get("/my", verifyToken, controller.getMyReviews);
router.get("/statistics", verifyToken, isManager, controller.getReviewStatistics);
router.get("/", verifyToken, isManager, controller.getAllReviews);

router.get("/booking/:bookingId", verifyToken, controller.getReviewByBooking);
router.get("/:id", verifyToken, controller.getReviewById);

router.post("/:bookingId", verifyToken, controller.addReview);
router.patch("/:id", verifyToken, controller.editReview);
router.patch("/update-status/:id", verifyToken, isManager, controller.updateReviewStatus);

export default router;