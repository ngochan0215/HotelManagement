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

export const isEmployee = (req, res, next) => {
    if (req.user.role === "employee" || req.user.role === "manager") {
        return next();
    }
    return res.status(403).json({ message: "Bạn không phải Nhân viên hoặc Quản lý, không có quyền truy cập." });
};

// export const verifyTokenForProfile = async (req, res, next) => {
//     const authHeader = req.headers.authorization;
//     if (!authHeader || !authHeader.startsWith("Bearer ")) {
//         return res.status(401).json({ message: "Chưa đăng nhập hoặc token không hợp lệ." });
//     }

//     const token = authHeader.split(" ")[1];
//     try {
//         const decoded = jwt.verify(token, JWT_SECRET);
//         const idToFind = decoded.userId || decoded.id;

//         if (!idToFind) {
//             console.error("[AuthMiddleware] Lỗi: Token không chứa userId.");
//             return res.status(401).json({ message: "Token lỗi: Không tìm thấy ID." });
//         }

//         const user = await userClient.getUserById(idToFind);

//         if (!user) {
//             return res.status(404).json({ message: "Không tìm thấy người dùng." });
//         }

//         req.user = user;
//         next();
//     } catch (err) {
//         console.error("[AuthMiddleware] Exception:", err.message);
//         return res.status(401).json({ message: "Token không hợp lệ hoặc đã hết hạn." });
//     }
// };