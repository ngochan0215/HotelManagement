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
        const decoded = jwt.verify(token, JWT_SECRET);
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

export const isEmployee = (req, res, next) => {
    if (req.user.role === "customer") {
        return res.status(403).json({ message: "Bạn không phải Nhân sự Khách sạn, không có quyền truy cập." });
    }
    next();
};

export const isManager = (req, res, next) => {
    if (req.user.role === "manager" || req.user.role === "admin") {
        return next();
    }
    return res.status(403).json({ message: "Bạn không phải Admin hoặc Quản lý, không có quyền truy cập." });
};

export const isAdmin = (req, res, next) => {
    if (req.user.role !== "admin") {
        return res.status(403).json({ message: "Bạn không phải Admin, không có quyền truy cập." });
    }
    next();
};