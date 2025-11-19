import bcrypt from "bcrypt";
import mongoose from "mongoose";
import { Employee, User, Customer } from "../models/index.js";
import { defaultAvatars } from "../config/avatars.js";

export const setRole = async (req, res) => {
    try {
        const { userId, newRole } = req.body;

        if (!userId || !newRole) {
            return res.status(400).json({ message: "Thiếu userId hoặc newRole." });
        }

        if (!["employee", "customer"].includes(newRole)) {
            return res.status(400).json({ message: "Role không hợp lệ." });
        }

        const user = await User.findById(userId);
        if (!user) {
            return res.status(404).json({ message: "Không tìm thấy user." });
        }

        if (user.system_role === newRole) {
            return res.status(400).json({ message: `User đã là ${newRole}.` });
        }

        user.system_role = newRole;
        await user.save();

        // const notification = await Notification.create({
        //     user_id: user._id,
        //     title: "Thay đổi quyền",
        //     content: `Quyền hệ thống của bạn đã được đổi thành ${newRole}.`
        // });

        // emitToUser(req.app.get("io"), user._id.toString(), "user:role_updated", {
        //     notification,
        // });

        return res.status(200).json({
            message: `Đã nâng quyền user thành ${newRole}.`,
        });
    } catch (err) {
        console.error(err);
        return res.status(500).json({ message: "Lỗi server." });
    }
};

// KHÁCH HÀNG - CUSTOMER: liệt kê các khách hàng
export const getAllCustomers = async (req, res) => {
    try {
        const customers = await Customer.find()
            .select("-_id, -updated_at -created_at -__v")
            .populate("user_id", "email role");
        res.status(200).json(customers);
    } catch (error) {
        res.status(500).json({ message: error.message });
    }
};

//---- QUY ĐỊNHH ----//
export const createRule = async (req, res) => {
    
}

