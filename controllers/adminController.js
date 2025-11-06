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

// NHÂN VIÊN - EMPLOYEE: thêm mới, liệt kê mọi nhân viên, xem thông tin chi tiết, cập nhật vài trường cụ thể
export const registerEmployee = async (req, res) => {
    const session = await mongoose.startSession();
    session.startTransaction();

    try {
        const { email, password, full_name, phone_number, date_birth, CCCD } = req.body;
        const existingUser = await User.findOne({ email });
        if (existingUser) {
            return res.status(400).json({ message: "Email đã tồn tại." });
        }
        if (!email || !password || !full_name || !phone_number || !date_birth || !CCCD) {
            return res.status(400).json({ message: "Vui lòng nhập đầy đủ thông tin bắt buộc!" });
        }

        const hashedPassword = await bcrypt.hash(password, 10);
        const randomAvatar = defaultAvatars[Math.floor(Math.random() * defaultAvatars.length)];
        
        const newUser = await User.create({
            email, password: hashedPassword, system_role: "employee", avatar: randomAvatar
        });

        const newEmployee =  await Employee.create({
            user_id: newUser._id, full_name, phone_number, date_birth, CCCD
        });

        await session.commitTransaction();
        session.endSession();

        res.status(201).json({ 
            message: "Tạo tài khoản và thêm thông tin nhân viên thành công.", 
            data: { newUser, newEmployee }
        });
    } catch (err) {
        await session.abortTransaction();
        session.endSession();

        res.status(500).json({ message: "Lỗi server", err: err.message });
    }
};

export const getAllEmployess = async (req, res) => {
    try {
        const employees = await Employee.find()
            .select("-__v")
            .populate("user_id", "email system_role -_id");
        res.status(200).json(employees);
    } catch (error) {
        res.status(500).json({ message: error.message });
    }
};

export const getEmployeeById = async (req, res) => {
    try {
        const { employee_id } = req.params;
        const employee = await Employee.findById(employee_id);

        if (!employee) {
            return res.status(404).json({ success: false, message: "Không tìm thấy nhân viên." });
        }
        return res.status(200).json({ success: true, employee });

    } catch (err) {
        console.error(err);
        return res.status(500).json({ success: false, message: "SERVER ERROR:", err: err.message });
    }
}

export const updateEmployee = async (req, res) => {
    try {
        const { status, position, fixed_salary, employeeId } = req.body;

        const requester = await User.findById(req.user._id);

        if (!requester || requester.system_role !== "admin") {
            return res.status(403).json({ message: "Bạn không có quyền thực hiện thao tác này." });
        }

        const employee = await Employee.findById(employeeId);
        if (!employee) {
            return res.status(404).json({ message: "Không tìm thấy nhân viên." });
        }

        if (status) employee.status = status;
        if (position) employee.position = position;
        if (fixed_salary) employee.fixed_salary = fixed_salary;

        await employee.save();

        res.status(200).json({
            message: "Cập nhật thông tin nhân viên thành công.",
            employee
        });
    } catch (err) {
        console.error(err);
        res.status(500).json({ message: "Lỗi server." });
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



