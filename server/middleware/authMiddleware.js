import jwt from "jsonwebtoken";
import dotenv from "dotenv";
import { User, Booking, Customer } from "../models/index.js";

dotenv.config();
const JWT_SECRET = process.env.JWT_SECRET;

export const verifyToken = (req, res, next) => {
    const authHeader = req.headers.authorization;
    if (!authHeader || !authHeader.startsWith("Bearer ")) {
        return res.status(401).json({ message: "Chưa đăng nhập hoặc token không hợp lệ." });
    }
    const token = authHeader.split(" ")[1];
    try {
        // kiểm tra token có hợp lệ ko, còn hạn ko và giải mã nội dung token
        const decoded = jwt.verify(token, JWT_SECRET);
        // hợp lệ thì lưu vào req.user
        req.user = decoded;
        next();
    } catch (err) {
        return res.status(401).json({ message: "Token không hợp lệ hoặc đã hết hạn." });
    }
};

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
export const isManager = (req, res, next) => {
    if (req.user.role !== "manager") {
        return res.status(403).json({ message: "Bạn không phải Quản lý, không có quyền truy cập." });
    }
    next();
};
export const isEmployee = (req, res, next) => {
    if (req.user.role === "employee" || req.user.role === "manager") {
        return next();
    }
    return res.status(403).json({ message: "Bạn không phải Nhân viên hoặc Quản lý, không có quyền truy cập." });
};

export const canAccessBooking = async (req, res, next) => {
    const bookingId = req.body.booking_id || req.params.bookingId;

    const booking = await Booking.findById(bookingId);
    if (!booking) {
        return res.status(404).json({ message: "Booking không tồn tại." });
    }

    const customer = await Customer.findById(booking.customer_id);
    if (!customer) {
        return res.status(404).json({ message: "Customer không tồn tại." });
    }

    // customer chỉ được thao tác booking của mình
    if ( req.user.role === "customer" && customer.user_id.toString() !== req.user._id.toString()) {
        return res.status(403).json({ message: "Bạn không phải là người đứng ra đặt phòng." });
    }

    if (req.user.role === "employee" || req.user.role === "admin") {
        return res.status(403).json({ message: "Bạn là Manager hoặc Nhân viên, không được xóa."});
    }

    req.booking = booking;
    next();
};

export const verifyTokenForProfile = async (req, res, next) => {
    const authHeader = req.headers.authorization;
    if (!authHeader || !authHeader.startsWith("Bearer ")) {
        return res.status(401).json({ message: "Chưa đăng nhập hoặc token không hợp lệ." });
    }

    const token = authHeader.split(" ")[1];
    try {
        const decoded = jwt.verify(token, JWT_SECRET);
        const idToFind = decoded.userId || decoded.id;

        if (!idToFind) {
            console.error("[AuthMiddleware] Lỗi: Token không chứa userId.");
            return res.status(401).json({ message: "Token lỗi: Không tìm thấy ID." });
        }

        const user = await User.findById(idToFind).select("-password -resetPasswordToken -resetPasswordExpires -create_at -update_at -__v");

        if (!user) {
            return res.status(404).json({ message: "Không tìm thấy người dùng." });
        }

        req.user = user;
        next();
    } catch (err) {
        console.error("[AuthMiddleware] Exception:", err.message);
        return res.status(401).json({ message: "Token không hợp lệ hoặc đã hết hạn." });
    }
};