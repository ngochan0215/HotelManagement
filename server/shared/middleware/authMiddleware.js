import jwt from "jsonwebtoken";
import dotenv from "dotenv";

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
        return res.status(401).json({ message: "Token không hợp lệ hoặc đã hết hạn hoặc " + err.message });
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

export const isAdmin = (req, res, next) => {
    if (req.user.role !== "admin") {
        return res.status(403).json({ message: "Bạn không phải Admin, không có quyền truy cập." });
    }
    next();
};

export const isEmployee = (req, res, next) => {
    if (req.user.role === "employee" || req.user.role === "manager") {
        return next();
    }
    return res.status(403).json({ message: "Bạn không phải Nhân viên hoặc Quản lý, không có quyền truy cập." });
};
