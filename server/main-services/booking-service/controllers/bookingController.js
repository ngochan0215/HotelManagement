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

        } catch (err) {
            return res.status(err.status || 400).json({ message: err.message });
        }
    };

    confirmBooking = async (req, res) => {
        try {
            const booking = await this.bookingService.confirmBooking(req.params.id, req.user.userId);
            
            return res.status(200).json({
                message: "Xác nhận đặt phòng thành công.",
                booking,
            });

        } catch (err) {
            return res.status(err.status || 400).json({ message: err.message });
        }
    };

    getBookingDetail = async (req, res) => {
        try {
            const { booking, rooms } = await this.bookingService.getBookingDetail(req.params.id);
            
            return res.status(200).json({ booking, rooms });

        } catch (err) {
            return res.status(err.status || 400).json({ message: err.message });
        }
    };

    getAllBookings = async (req, res) => {
        try {
            const { total, bookings } = await this.bookingService.getAllBookings(req.query);
    
            return res.status(200).json({ total, bookings });

        } catch (err) {
            return res.status(err.status || 400).json({ message: err.message });
        }
    };

    addRoomsToBooking = async (req, res) => {
        try {
            await this.bookingService.addRoomsToBooking(req.params.id, req.body);

            return res.status(200).json({ message: "Thêm phòng thành công." });

        } catch (err) {
            return res.status(err.status || 400).json({ message: err.message });
        }
    };

    updateBookingStatus = async (req, res) => {
        try {
            await this.bookingService.updateBookingStatus(req.user.userId, req.params.id, req.query);
            
            return res.json({
                message: `Cập nhật trạng thái booking thành công.`,
            });
        
        } catch (err) {
            return res.status(err.status || 400).json({ message: err.message });
        }
    };

    checkinBookingDetail = async (req, res) => {
        try {
            const { bookingId, detailId } = req.params;

            await this.bookingService.checkinBookingDetail(req.user.userId, bookingId, detailId);

            return res.status(200).json({ message: "Check-in phòng thành công." });

        } catch (err) {
            return res.status(err.status || 400).json({ message: err.message });
        }
    };

    checkoutBookingDetail = async (req, res) => {
        try {
            const { bookingId, detailId } = req.params;

            const result = await this.bookingService.checkoutBookingDetail(req.user.userId, bookingId, detailId);

            return res.status(200).json({
                success: true,
                message: "Checkout thành công. Vui lòng gán nhân viên dọn dẹp.",
                data: result
            });

        } catch (err) {
            return res.status(err.status || 400).json({ message: err.message });
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

        } catch (err) {
            return res.status(err.status || 400).json({ message: err.message });
        }
    };

    createCustomerBooking = async (req, res) => {
        try {
            const { booking, deposit } = await this.bookingService.createCustomerBooking(req.user.userId, req.body);
            return res.status(201).json({
                message: "Đặt phòng thành công.",
                booking_id: booking._id,
                deposit,
            });
        } catch (err) {
            return res.status(err.status || 400).json({ message: err.message });
        }
    };

    cancelCustomerBooking = async (req, res) => {
        try {
            const { reason } = req.body;
            await this.bookingService.cancelCustomerBooking(req.user.userId, req.params.id, reason);
            return res.status(200).json({ message: "Đã hủy đặt phòng thành công." });
        } catch (err) {
            return res.status(err.status || 400).json({ message: err.message });
        }
    };

    cancelCustomerBookingDetail = async (req, res) => {
        try {
            const { bookingId, detailId } = req.params;
            const { reason } = req.body;
            await this.bookingService.cancelCustomerBookingDetail(req.user.userId, bookingId, detailId, reason);
            return res.status(200).json({ message: "Đã hủy phòng thành công." });
        } catch (err) {
            return res.status(err.status || 400).json({ message: err.message });
        }
    };

    getMyBookings = async (req, res) => {
        try {
            const result = await this.bookingService.getMyBookings(req.user.userId, req.query);
            return res.status(200).json(result);
        } catch (err) {
            return res.status(err.status || 400).json({ message: err.message });
        }
    };

    getMyBookingDetail = async (req, res) => {
        try {
            const { booking, rooms } = await this.bookingService.getMyBookingDetail(req.user.userId, req.params.id);
            return res.status(200).json({ booking, rooms });
        } catch (err) {
            return res.status(err.status || 400).json({ message: err.message });
        }
    };

    lookupPublicBooking = async (req, res) => {
        try {
            const result = await this.bookingService.lookupPublicBooking(req.body);
            return res.status(200).json(result);
        } catch (err) {
            return res.status(err.status || 400).json({ message: err.message });
        }
    };

    cancelBooking = async (req, res) => {
        try {
            const { id } = req.params;
            const { reason } = req.body;
            const userId = req.user.userId;
            const userRole = req.user.system_role;

            await this.bookingService.cancelBooking(userId, id, reason, userRole);
            
            return res.status(200).json({ message: "Đã hủy toàn bộ booking." });

        } catch (err) {
            return res.status(err.status || 400).json({ message: err.message });
        }
    };
}
