import dotenv from "dotenv";
dotenv.config();

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