import dotenv from "dotenv";
dotenv.config();

export const isCustomer = (req, res, next) => {
    if (req.user.role !== "customer") {
        return res.status(403).json({ message: "Bạn không phải Khách hàng, không có quyền truy cập." });
    }
    next();
};
export const isNotCustomer = (req, res, next) => {
    if (req.user.role === "customer") {
        return res.status(403).json({ message: "Bạn không phải Nhân viên hoặc Quản lý, không có quyền truy cập." });
    }
    next();
};

// export const canAccessBooking = async (req, res, next) => {
//     const bookingId = req.body.booking_id || req.params.bookingId;

//     const booking = await Booking.findById(bookingId);
//     if (!booking) {
//         return res.status(404).json({ message: "Booking không tồn tại." });
//     }

//     const customer = await Customer.findById(booking.customer_id);
//     if (!customer) {
//         return res.status(404).json({ message: "Customer không tồn tại." });
//     }

//     // customer chỉ được thao tác booking của mình
//     if ( req.user.role === "customer" && customer.user_id.toString() !== req.user._id.toString()) {
//         return res.status(403).json({ message: "Bạn không phải là người đứng ra đặt phòng." });
//     }

//     if (req.user.role === "employee" || req.user.role === "admin") {
//         return res.status(403).json({ message: "Bạn là Manager hoặc Nhân viên, không được xóa."});
//     }

//     req.booking = booking;
//     next();
// };