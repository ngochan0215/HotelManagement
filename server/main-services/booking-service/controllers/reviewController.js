import { container } from "../containers/container.js";

export class ReviewController {
    constructor() {
        this.reviewService = container.reviewService;
    }

    addReview = async (req, res) => {
        try {
            const customerId = req.user.customerId;
            const bookingId = req.params.bookingId;

            const review = await this.reviewService.addReview(bookingId, customerId, req.body);

            return res.status(201).json({
                message: "Đánh giá thành công",
                data: review
            });

        } catch (err) {
            return res.status(err.status || 400).json({ message: err.message });
        }
    };

    getMyReviews = async (req, res) => {
        try {
            const customerId = req.user.customerId;
            const { total, data } = await this.reviewService.getMyReviews(customerId);

            return res.status(200).json({ total, data });

        } catch (err) {
            return res.status(err.status || 400).json({ message: err.message });
        }
    };

    getReviewByBooking = async (req, res) => {
        try {
            const customerId = req.user.customerId;
            const bookingId = req.params.bookingId;

            const { can_review, review } = await this.reviewService.getReviewByBooking(bookingId, customerId);

            return res.status(200).json({ can_review: false, data: review });

        } catch (err) {
            return res.status(err.status || 400).json({ message: err.message });
        }
    };

    editReview = async (req, res) => {
        try {
            const customerId = req.user.customerId;
            const reviewId = req.params.id;

            const review = await this.reviewService.editReview(reviewId, customerId, req.body);

            return res.status(200).json({ message: "Edit review successfully!", data: review });
            
        } catch (err) {
            return res.status(err.status || 400).json({ message: err.message });
        }
    };

    updateReviewStatus = async (req, res) => {
        try {
            const reviewId = req.params.id;

            const review = await this.reviewService.updateReviewStatus(reviewId, req.body);

            return res.status(200).json({ message: "Update review status successfully!", data: review });
        
        } catch (err) {
            return res.status(err.status || 400).json({ message: err.message });
        }
    };

    getAllReviews = async (req, res) => {
        try {
            const { reviews, pagination } = await this.reviewService.getAllReviews(req.query);
            
            return res.status(200).json({
                success: true,
                reviews, pagination,
            });

        } catch (err) {
            return res.status(err.status || 400).json({ message: err.message });
        }
    };

    getReviewStatistics = async (req, res) => {
        try {
            const { total, visible, hidden, averageRating, ratingDistribution, 
                recent } = await this.reviewService.getReviewStatistics();

            return res.status(200).json({
                success: true,
                statistics: {
                    total, visible, hidden, averageRating, ratingDistribution, recent
                },
            });

        } catch (err) {
            return res.status(err.status || 400).json({ message: err.message });
        }
    };

    getReviewById = async (req, res) => {
        try {
            const review = await this.reviewService.getReviewById(req.params.id);
            
            return res.status(200).json({ success: true, review });
            
        } catch (err) {
            return res.status(err.status || 400).json({ message: err.message });
        }
    };
}