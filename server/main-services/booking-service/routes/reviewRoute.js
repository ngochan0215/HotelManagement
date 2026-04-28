import express from "express";
import { ReviewController } from "../controllers/reviewController.js";
import { verifyToken, isManager } from "../../../shared/middleware/authMiddleware.js";

const router = express.Router();
const controller = new ReviewController();

router.get("/my", verifyToken, controller.getMyReviews);
router.get("/statistics", verifyToken, isManager, controller.getReviewStatistics);
router.get("/all", verifyToken, isManager, controller.getAllReviews);

router.get("/:bookingId", verifyToken, controller.getReviewByBooking);
router.get("/:id", verifyToken, controller.getReviewById);

router.post("/:bookingId/add", verifyToken, controller.addReview);
router.patch("/:id", verifyToken, controller.editReview);
router.patch("/:id/update", verifyToken, isManager, controller.updateReviewStatus);

export default router;