import jwt from "jsonwebtoken";
import dotenv from "dotenv";
import { User } from "../models/User.js";

dotenv.config();
const JWT_SECRET = process.env.JWT_SECRET;

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