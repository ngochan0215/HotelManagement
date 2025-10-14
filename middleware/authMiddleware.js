import jwt from "jsonwebtoken";
import dotenv from "dotenv";
import { User } from "../models/index.js";

dotenv.config();

const JWT_SECRET = process.env.JWT_SECRET || "secret_key";

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

export const isAdmin = (req, res, next) => {
    if (req.user.role !== "admin") {
        return res.status(403).json({ message: "Bạn không có quyền truy cập." });
    }
    next();
};

export const isEmployee = (req, res, next) => {
    if (req.user.role === "employee") {
        return next();
    }
    return res.status(403).json({ message: "Bạn không có quyền truy cập." });
};

export const verifyTokenForProfile = async (req, res, next) => {
    const authHeader = req.headers.authorization;
    if (!authHeader || !authHeader.startsWith("Bearer ")) {
        return res.status(401).json({ message: "Chưa đăng nhập hoặc token không hợp lệ." });
    }

    const token = authHeader.split(" ")[1];
    try {
        const decoded = jwt.verify(token, process.env.JWT_SECRET);
        const user = await User.findById(decoded.id).select("-password -resetPasswordToken -resetPasswordExpires -create_at -update_at -__v");
        if (!user) {
            return res.status(404).json({ message: "Không tìm thấy người dùng." });
        }

        req.user = user;
        next();
    } catch (err) {
        return res.status(401).json({ message: "Token không hợp lệ hoặc đã hết hạn." });
    }
};