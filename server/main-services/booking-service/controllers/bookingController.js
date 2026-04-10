import { container } from "../containers/container.js";

export class BookingController {
    constructor() {
        this.bookingService = container.bookingService;
    }

    createBooking = async (req, res) => {
        try {
            const booking = await this.bookingService.createBooking(req.user.userId, req.body);
            
            return res.status(201).json({
                message: "Đặt phòng thành công.",
                booking_id: booking._id,
            });

        } catch (error) {
            return res.status(500).json({
                message: error.message || "Không thể đặt phòng.",
            });
        }
    };

    confirmBooking = async (req, res) => {
        try {
            const booking = await this.bookingService.confirmBooking(req.params.id, req.user.userId);
            
            return res.status(200).json({
                message: "Xác nhận đặt phòng thành công.",
                booking,
            });

        } catch (error) {
            return res.status(500).json({
                message: error.message || "Không thể xác nhận đặt phòng.",
            });
        }
    };

    getBookingDetail = async (req, res) => {
        try {
            const { booking, rooms } = await this.bookingService.getBookingDetail(req.params.id);
            
            return res.status(200).json({ booking, rooms });

        } catch (error) {
            return res.status(500).json({
                message: error.message || "Không thể lấy thông tin booking.",
            });
        }
    };

    getAllBookings = async (req, res) => {
        try {
            const { total, bookings } = await this.bookingService.getAllBookings(req.query);
    
            return res.status(200).json({ total, bookings });

        } catch (error) {
            return res.status(500).json({
                message: error.message || "Không thể lấy danh sách booking."
            });
        }
    };

    addRoomsToBooking = async (req, res) => {
        try {
            await this.bookingService.addRoomsToBooking(req.params.id, req.body);

            res.status(200).json({ message: "Thêm phòng thành công." });

        } catch (err) {
            res.status(500).json({ message: err.message });
        }
    };

    updateBookingStatus = async (req, res) => {
        try {
            await this.bookingService.updateBookingStatus(req.user.userId, req.params.id, req.query);
            
            return res.json({
                message: `Cập nhật trạng thái booking thành công.`,
            });
        
        } catch (error) {
            return res.status(500).json({
                message: error.message || "Không thể cập nhật trạng thái booking.",
            });
        }
    };

    checkinBookingDetail = async (req, res) => {
        try {
            const { bookingId, detailId } = req.params;

            await this.bookingService.checkinBookingDetail(req.user.userId, bookingId, detailId);

            return res.status(200).json({ message: "Check-in phòng thành công." });

        } catch (error) {
            return res.status(400).json({
                message: error.message || "Không thể check-in phòng.",
            });
        }
    };

    checkoutBookingDetail = async (req, res) => {
        try {
            const { bookingId, detailId } = req.params;

            const result = await this.bookingService.checkoutBookingDetail(req.user.userId, bookingId, detailId);

            return res.json({
                success: true,
                message: "Checkout thành công. Vui lòng gán nhân viên dọn dẹp.",
                data: result
            });

        } catch (error) {
            return res.status(400).json({
                message: error.message || "Không thể checkout phòng.",
            });
        }
    };

    cancelBookingDetail = async (req, res) => {
        try {
            const { bookingId, detailId } = req.params;
            const { reason } = req.body;
            const userId = req.user.userId;
            const userRole = req.user.system_role;

            await this.bookingService.cancelBookingDetail(userId, bookingId, detailId, reason, userRole);

            return res.status(200).json({ message: "Đã hủy phòng khỏi booking thành công." });

        } catch (error) {
            return res.status(400).json({
                message: error.message || "Không thể hủy phòng.",
            });
        }
    };

    cancelBooking = async (req, res) => {
        try {
            const { id } = req.params;
            const { reason } = req.body;
            const userId = req.user.userId;
            const userRole = req.user.system_role;

            await this.bookingService.cancelBooking(userId, id, reason, userRole);
            
            res.status(200).json({ message: "Đã hủy toàn bộ booking." });

        } catch (err) {
            res.status(500).json({ messsage: "SERVER ERROR: " + err.message });
        }
    };

    getCancellationReasonStats = async (req, res) => {
        try {
            const { fromDate, toDate, cancelledBy } = req.query;
            const match = {};

            if (fromDate && isNaN(new Date(fromDate))) {
            return res.status(400).json({ message: "fromDate không hợp lệ" });
            }
            if (toDate && isNaN(new Date(toDate))) {
            return res.status(400).json({ message: "toDate không hợp lệ" });
            }

            if (fromDate || toDate) {
            match.cancelled_at = {};
            if (fromDate) match.cancelled_at.$gte = new Date(fromDate);
            if (toDate) match.cancelled_at.$lte = new Date(toDate);
            }

            const ALLOWED_CANCELLED_BY = ["user", "system", "admin"];
            if (cancelledBy && !ALLOWED_CANCELLED_BY.includes(cancelledBy)) {
            return res.status(400).json({ message: "cancelledBy không hợp lệ" });
            }

            if (cancelledBy) {
            match.cancelled_by = cancelledBy;
            }

            const stats = await RoomCancellation.aggregate([
            { $match: match },
            {
                $group: {
                _id: "$reason",
                total: { $sum: 1 },
                },
            },
            ]);

            const result = Object.keys(CANCELLATION_REASON_LABELS).map(code => {
            const found = stats.find(s => s._id === code);
            return {
                reason_code: code,
                reason_label: CANCELLATION_REASON_LABELS[code],
                total: found ? found.total : 0,
            };
            });

            res.status(200).json({ success: true, data: result });

        } catch (error) {
            res.status(500).json({ success: false, message: error.message });
        }
    };
}

