import mongoose from "mongoose";
import { ROOM_EVENTS } from "../../../shared/events/roomEvents.js";
import { CUSTOMER_EVENTS } from "../../../shared/events/customerEvents.js";
import { cache, makeCacheKey } from "../../../shared/utils/cache.js";

const EDIT_LIMIT_HOURS = 48;

export class ReviewService {
    constructor({ Review, Booking, BookingDetail, eventBus }) {
        this.Review = Review;
        this.Booking = Booking;
        this.BookingDetail = BookingDetail;
        this.eventBus = eventBus;
    }

    // helper
    async updateRoomCategoryRating(category_id) {
        const result = await this.Review.aggregate([
            { $match: { is_visible: true } },
            { $unwind: "$category_reviews" },
            { $match: { "category_reviews.category_id": new mongoose.Types.ObjectId(category_id) } },
            { $group: {
                _id: null,
                avg: { $avg: "$category_reviews.overall_rating" },
                count: { $sum: 1 },
            }},
        ]);

        const { avg = 0, count = 0 } = result[0] || {};
        const reply = await this.eventBus.safeRequest(
            ROOM_EVENTS.UPDATE_CATEGORY_RATING,
            { 
                categoryId: category_id, 
                updateData: { 
                    average_rating: Math.round(avg * 10) / 10, 
                    review_count: count 
                } 
            }
        );

        if (!reply.success) throw new Error(reply.message);
    }

    async getBookedCategoryIds(booking_id) {
        const details = await this.BookingDetail.find({ booking_id });
        
        if (!details || details.length === 0) {
            throw new Error("Booking không có phòng nào.");
        }

        const roomIds = details.map((d) => d.room_id.toString());

        const replyRooms = await this.eventBus.safeRequest(
            ROOM_EVENTS.GET_CATEGORY_IDS,
            { roomIds }
        );
        if (!replyRooms.success) throw new Error(replyRooms.message);

        return replyRooms.categoryIds;
    }

    // main business logic
    async addReview(bookingId, customerId, data) {
        try {
            let { category_reviews, general_rating, general_comment } = data;

            if (!bookingId || general_rating === undefined) {
                throw new Error("Thiếu thông tin bắt buộc như mã đặt phòng hoặc thông tin review chi tiết hoặc rating tổng.");
            }

            if (!mongoose.isValidObjectId(bookingId)) {
                throw new Error("ID booking không hợp lệ.");
            }

            if (!Number.isInteger(general_rating) || general_rating < 1 || general_rating > 5) {
                throw new Error("Rating chung phải là số nguyên từ 1 đến 5.");
            }

            if (general_comment && general_comment.trim().length > 1000) {
                throw new Error("Bình luận chung không được vượt quá 1000 ký tự.");
            }

            // booking related validation
            const booking = await this.Booking.findById(bookingId);
            if (!booking) throw new Error("Không tìm thấy booking.");

            if (booking.status !== "completed") {
                throw new Error("Không thể đánh giá khi booking chưa hoàn thành.");
            }

            if (booking.customer_id.toString() !== customerId.toString()) {
                throw new Error("Bạn không có quyền đánh giá booking này.");
            }

            const bookedCategoryIds = await this.getBookedCategoryIds(bookingId);

            // autofill if category_reviews is empty
            if (!Array.isArray(category_reviews) || category_reviews.length === 0) {
                category_reviews = bookedCategoryIds.map((category_id) => ({
                    category_id,
                    ratings: {
                        room_quality: general_rating,
                        cleanliness:  general_rating,
                        service:      general_rating,
                        value:        general_rating,
                    },
                    overall_rating: general_rating,
                    comment: general_comment?.trim() || "",
                }));
            } else {
                const RATING_FIELDS = ["room_quality", "cleanliness", "service", "value"];
                const seenCategoryIds = new Set();

                for (let i = 0; i < category_reviews.length; i++) {
                    const entry = category_reviews[i];
                    const prefix = `Loại phòng thứ [${i}] `;

                    if (!entry.category_id || !mongoose.isValidObjectId(entry.category_id)) {
                        throw new Error(`${prefix} có ID Danh mục phòng không hợp lệ.`);
                    } 

                    if (seenCategoryIds.has(entry.category_id.toString())) {
                        throw new Error(`${prefix} có ID Danh mục phòng bị trùng lặp trong cùng một đánh giá.`);
                    }
                    seenCategoryIds.add(entry.category_id.toString());

                    if (!entry.ratings || typeof entry.ratings !== "object") {
                        throw new Error(`Bắt buộc đánh giá cho ${prefix}.`);
                    }

                    for (const field of RATING_FIELDS) {
                        const val = entry.ratings[field];
                        if (val !== undefined && (!Number.isInteger(val) || val < 1 || val > 5)) {
                            throw new Error(`Đánh giá phải là số nguyên từ 1 đến 5.`);
                        }
                    }

                    if (
                        entry.overall_rating === undefined ||
                        !Number.isInteger(entry.overall_rating) ||
                        entry.overall_rating < 1 ||
                        entry.overall_rating > 5
                    ) {
                        throw new Error(`Đánh giá phải là số nguyên từ 1 đến 5.`);
                    }

                    if (entry.comment && entry.comment.trim().length > 1000) {
                        throw new Error(`Bình luận không được vượt quá 1000 ký tự.`);
                    }
                }
            }

            const reviewedCategoryIds = category_reviews.map((r) => r.category_id.toString());
            const missingCategories = bookedCategoryIds.filter(
                (id) => !reviewedCategoryIds.includes(id)
            );
            if (missingCategories.length > 0) {
                throw new Error(
                    `Thiếu đánh giá cho ${missingCategories.length} loại phòng trong booking.`
                );
            }

            const extraCategories = reviewedCategoryIds.filter(
                (id) => !bookedCategoryIds.includes(id)
            );
            if (extraCategories.length > 0) {
                throw new Error("Thông tin review chứa loại phòng không thuộc booking này.");
            }

            const existed = await this.Review.findOne({ booking_id: bookingId, customer_id: customerId });
            if (existed) {
                throw new Error("Bạn đã đánh giá booking này rồi.");
            }

            const review = await this.Review.create({
                booking_id: bookingId,
                customer_id: customerId,
                category_reviews,
                general_rating,
                general_comment: general_comment?.trim(),
            });

            await Promise.all(
                reviewedCategoryIds.map((category_id) => this.updateRoomCategoryRating(category_id))
            );

            await Promise.all([
                cache.del(`review:customer:${customerId}`),
                cache.del("review:stats"),
                cache.delByPattern("review:list:*"),
            ]);
            return review;

        } catch (error) {
            console.log("Error in adding new review: ", error);
            throw error;
        }
    }

    async getMyReviews (customerId) {
        try {
            if (!mongoose.isValidObjectId(customerId)) {
                throw new Error("ID Khách hàng không hợp lệ");
            }

            const cacheKey = `review:customer:${customerId}`;
            const cached = await cache.get(cacheKey);
            if (cached) return cached;

            const reviews = await this.Review.find({
                customer_id: customerId,
                is_visible: true
            }).sort({ created_at: -1 }).lean();

            const result = { total: reviews.length, data: reviews };
            await cache.set(cacheKey, result, 300);
            return result;

        } catch (error) {
            console.log("Error in getting customer own reviews: ", error);
            throw error;
        }
    };

    async populateCustomerInfo(reviews = []) {
        if (!Array.isArray(reviews) || reviews.length === 0) {
            return reviews;
        }

        const customerIds = [...new Set(reviews
            .map((review) => review.customer_id?.toString())
            .filter(Boolean)
        )];

        if (customerIds.length === 0) {
            return reviews;
        }

        const reply = await this.eventBus.safeRequest(
            CUSTOMER_EVENTS.GET_INFOS_IDS,
            { customerIds }
        );

        const customerMap = {};
        if (reply?.success && Array.isArray(reply.customers)) {
            for (const customer of reply.customers) {
                const key = customer._id?.toString();
                if (!key) continue;
                customerMap[key] = {
                    full_name: customer.full_name,
                    CCCD: customer.CCCD,
                    phone_number: customer.phone_number,
                    email: customer.email,
                    address: customer.address,
                    avatar_url: customer.avatar_url,
                    ...customer,
                };
            }
        }

        return reviews.map((review) => ({
            ...review,
            customer_info: customerMap[review.customer_id?.toString()] || null,
        }));
    }

    async populateCustomerInfoForReview(review) {
        if (!review) return review;

        const [result] = await this.populateCustomerInfo([review]);
        return result || review;
    }

    async getVisibleReviews (query = {}) {
        try {
            const { page = 1, limit = 3, search } = query;
            const filter = { is_visible: true };

            if (search) {
                const regex = { $regex: search, $options: "i" };
                filter.$or = [
                    { general_comment: regex },
                    { "category_reviews.comment": regex },
                ];
            }

            const skip = (Number(page) - 1) * Number(limit);
            const reviews = await this.Review.find(filter)
                .sort({ created_at: -1 })
                .skip(skip)
                .limit(Number(limit))
                .lean();

            const total = await this.Review.countDocuments(filter);
            const reviewsWithCustomerInfo = await this.populateCustomerInfo(reviews);

            return {
                reviews: reviewsWithCustomerInfo,
                pagination: {
                    page: Number(page),
                    limit: Number(limit),
                    total,
                    totalPages: Math.ceil(total / Number(limit)),
                },
            };
        } catch (error) {
            console.log("Error in getting visible reviews: ", error);
            throw error;
        }
    };

    async getReviewByBooking (bookingId, customerId) {
        try {
            const review = await this.Review.findOne({ 
                booking_id: bookingId, 
                customer_id: customerId,
                is_visible: true
            }).select("-__v -created_at -updated_at").lean();

            if (!review) return { can_review: true, review: null };

            const reviewWithCustomerInfo = await this.populateCustomerInfoForReview(review);
            return { can_review: false, review: reviewWithCustomerInfo };

        } catch (error) {
            console.log("Error in getting reviews by order: ", error);
            throw error;
        }
    };

    async editReview(reviewId, customerId, data) {
        try {
            const review = await this.Review.findOne({
                _id: reviewId,
                customer_id: customerId,
                is_visible: true
            });

            if (!review) throw new Error("Không tìm thấy đánh giá.");

            const booking = await this.Booking.findById(review.booking_id);
            if (!booking) throw new Error("Không tìm thấy booking.");

            if (booking.customer_id.toString() !== customerId.toString()) {
                throw new Error("Bạn không có quyền đánh giá booking này.");
            }

            const hoursPassed =
                (Date.now() - review.created_at.getTime()) / (1000 * 60 * 60);

            if (hoursPassed > EDIT_LIMIT_HOURS) {
                throw new Error(`Không thể chỉnh sửa đánh giá sau ${EDIT_LIMIT_HOURS} giờ.`);
            }

            const { general_rating, general_comment, category_reviews } = data;

            if (general_rating !== undefined) {
                if (!Number.isInteger(general_rating) || general_rating < 1 || general_rating > 5) {
                    throw new Error("Rating chung phải là số nguyên từ 1 đến 5.");
                }
            }

            if (general_comment && general_comment.trim().length > 1000) {
                throw new Error("Bình luận chung không được vượt quá 1000 ký tự.");
            }

            if (category_reviews && Array.isArray(category_reviews) && category_reviews.length > 0) {
                const RATING_FIELDS = ["room_quality", "cleanliness", "service", "value"];
                const seenCategoryIds = new Set();

                for (let i = 0; i < category_reviews.length; i++) {
                    const entry = category_reviews[i];
                    const prefix = `Loại phòng thứ [${i}] `;

                    if (!entry.category_id || !mongoose.isValidObjectId(entry.category_id)) {
                        throw new Error(`${prefix} có ID Danh mục phòng không hợp lệ.`);
                    } 

                    if (seenCategoryIds.has(entry.category_id.toString())) {
                        throw new Error(`${prefix} có ID Danh mục phòng bị trùng lặp trong cùng một đánh giá.`);
                    }
                    seenCategoryIds.add(entry.category_id.toString());

                    if (!entry.ratings || typeof entry.ratings !== "object") {
                        throw new Error(`Bắt buộc đánh giá cho ${prefix}.`);
                    }

                    for (const field of RATING_FIELDS) {
                        const val = entry.ratings[field];
                        if (val !== undefined && (!Number.isInteger(val) || val < 1 || val > 5)) {
                            throw new Error(`Đánh giá phải là số nguyên từ 1 đến 5.`);
                        }
                    }

                    if (
                        entry.overall_rating === undefined ||
                        !Number.isInteger(entry.overall_rating) ||
                        entry.overall_rating < 1 ||
                        entry.overall_rating > 5
                    ) {
                        throw new Error(`Đánh giá phải là số nguyên từ 1 đến 5.`);
                    }

                    if (entry.comment && entry.comment.trim().length > 1000) {
                        throw new Error(`Bình luận không được vượt quá 1000 ký tự.`);
                    }
                }
            }

            review.general_rating = general_rating ?? review.general_rating;
            review.general_comment = general_comment ?? review.general_comment;
            review.category_reviews = category_reviews ?? review.category_reviews;

            await review.save();

            if (category_reviews?.length) {
                const ids = [...new Set(
                    category_reviews.map(r => r.category_id.toString())
                )];

                await Promise.all(
                    ids.map(id => this.updateRoomCategoryRating(id))
                );
            }

            await Promise.all([
                cache.del(`review:one:${reviewId}`),
                cache.del(`review:customer:${customerId}`),
                cache.del("review:stats"),
                cache.delByPattern("review:list:*"),
            ]);
            return review;

        } catch (error) {
            console.log("Error in editing review:", error);
            throw error;
        }
    }

    async updateReviewStatus (reviewId, data) {
        try {
            const { is_visible, note } = data;

            if (!mongoose.isValidObjectId(reviewId)) {
                throw new Error("ID Đánh giá không hợp lệ.");
            }

            const review = await this.Review.findById(reviewId);
            if (!review) throw new Error("Không tìm thấy đánh giá.");

            review.is_visible = is_visible;
            review.note = note || "";

            await review.save();
            await Promise.all([
                cache.del(`review:one:${reviewId}`),
                cache.del("review:stats"),
                cache.delByPattern("review:list:*"),
            ]);
            return review;

        } catch (error) {
            console.log("Error in updating review status: ", error);
            throw error;
        }
    };

    async getAllReviews (query = {}) {
        try {
            const { is_visible, general_rating, customer_id, page = 1, limit = 10, search } = query;

            const cacheKey = makeCacheKey("review:list", {
                is_visible: is_visible || null,
                general_rating: general_rating || null,
                customer_id: customer_id || null,
                page: Number(page),
                limit: Number(limit),
                search: search || null,
            });
            const cached = await cache.get(cacheKey);
            if (cached) return cached;
            const filter = {};

            if (is_visible) filter.is_visible = is_visible;

            if (general_rating) {
                const ratingNum = parseInt(general_rating);
                if (ratingNum >= 1 && ratingNum <= 5) {
                    filter.general_rating = ratingNum;
                }
            }

            if (search) {
                const searchRegex = { $regex: search, $options: "i" };
                filter.$or = [
                    { booking_id: mongoose.isValidObjectId(search) ? search : null },
                ];
                if (!mongoose.isValidObjectId(search)) {
                    filter.$or = [];
                }
            }

            const skip = (parseInt(page) - 1) * parseInt(limit);

            const reviews = await this.Review.find(filter)
                .sort({ created_at: -1 })
                .skip(skip)
                .limit(parseInt(limit));

            const total = await this.Review.countDocuments(filter);

            const listResponse = {
                reviews,
                pagination: {
                    page: parseInt(page),
                    limit: parseInt(limit),
                    total,
                    totalPages: Math.ceil(total / parseInt(limit)),
                }
            };
            await cache.set(cacheKey, listResponse, 300);
            return listResponse;

        } catch (error) {
            console.log("Error in getting all reviews for admin:", error);
            throw error;
        }
    };

    async getReviewStatistics () {
        try {
            const cached = await cache.get("review:stats");
            if (cached) return cached;

            const totalReviews = await this.Review.countDocuments();
            const visibleReviews = await this.Review.countDocuments({ is_visible: true });
            const hiddenReviews = await this.Review.countDocuments({ is_visible: false });

            // Average rating
            const avgRatingResult = await this.Review.aggregate([
                { $match: { is_visible: true } },
                { $group: { _id: null, avgRating: { $avg: "$general_rating" } } },
            ]);
            const averageRating = avgRatingResult[0]?.avgRating || 0;

            // Rating distribution
            const ratingDistribution = await this.Review.aggregate([
                { $match: { is_visible: true } },
                { $group: { _id: "$general_rating", count: { $sum: 1 } } },
                { $sort: { _id: -1 } },
            ]);

            // Recent reviews (last 7 days)
            const sevenDaysAgo = new Date();
            sevenDaysAgo.setDate(sevenDaysAgo.getDate() - 7);
            const recentReviews = await this.Review.countDocuments({
                created_at: { $gte: sevenDaysAgo },
                is_visible: true,
            });

            const stats = {
                total: totalReviews,
                visible: visibleReviews,
                hidden: hiddenReviews,

                averageRating: Math.round(averageRating * 10) / 10,

                ratingDistribution: ratingDistribution.reduce((acc, item) => {
                    acc[item._id] = item.count;
                    return acc;
                }, {}),

                recent: recentReviews
            };
            await cache.set("review:stats", stats, 300);
            return stats;

        } catch (error) {
            console.log("Error getting review statistics:", error);
            throw error;
        }
    };

    async getReviewById (reviewId) {
        try {
            if (!mongoose.isValidObjectId(reviewId)) {
                throw new Error("ID Đánh giá không hợp lệ.");
            }

            const cacheKey = `review:one:${reviewId}`;
            const cached = await cache.get(cacheKey);
            if (cached) return cached;

            const review = await this.Review.findById(reviewId).lean();
            if (!review) throw new Error("Không tìm thấy đánh giá.");

            const reviewWithCustomerInfo = await this.populateCustomerInfoForReview(review);
            await cache.set(cacheKey, reviewWithCustomerInfo, 300);
            return reviewWithCustomerInfo;

        } catch (error) {
            console.log("Error in getting review by ID:", error);
            throw error;
        }
    };
}