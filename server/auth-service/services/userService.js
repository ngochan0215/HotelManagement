import bcrypt from "bcrypt";
import jwt from "jsonwebtoken";
import mongoose from "mongoose";

export class UserService {
    constructor({ User, customerClient, employeeClient, mailService }) {
        this.User = User;
        this.customerClient = customerClient;
        this.employeeClient = employeeClient;
        this.mailService = mailService;
    }

    getAllUsers = async (query = {}) => {
        const filter = {};
        const { _id, email, system_role, isBanned } = query;

        if (system_role != null) filter.system_role = system_role;
        if (isBanned) filter.isBanned = isBanned;
        if (email) filter.email = email;
        if (_id) filter._id = _id;

        let users = this.User.find(filter).select("email system_role avatar isBanned");
        return users;
    }

    async getUserById (userId) {
        const user = await this.User.findById(userId)
            .select("email system_role avatar isBanned")

        if (!user) {
            throw new Error("User not found.");
        }
        
        return user;
    };

    async getUserProfile(userId) {
        try {
            const user = await this.User.findById(userId)
                .select("email system_role avatar isBanned")
                .lean();

            if (!user) {
                throw new Error("User not found.");
            }

            let extraData = {};

            if (user.system_role === "employee") {
                extraData = await this.employeeClient.findEmployeeByUserId(userId);
            } else {
                extraData = await this.customerClient.getCustomerByUserId(userId);
            }

            console.log("EXXTRA DATA: ", extraData);
            return {
                ...user,
                ...extraData
            };
        } catch (error) {
            const message = error.response?.data?.message || error.message;
            const status = error.reponse?.status || error.status;
            const err = new Error(message);
            err.status = status;
            throw err;
        }
        
    }

    changePasswordService = async (userId, oldPassword, newPassword) => {
        const user = await this.User.findById(userId).select("+password");
        if (!user) 
            throw new Error("Không tìm thấy người dùng.");

        const isMatch = await bcrypt.compare(oldPassword, user.password);
        if (!isMatch) 
            throw new Error("Mật khẩu cũ không đúng.");

        const regex = /^(?=.*[A-Z])(?=.*[a-z])(?=.*\d)(?=.*[@$!%*#?&]).{8,}$/;
        if (!regex.test(newPassword)) {
            throw new Error("Mật khẩu mới phải có ít nhất 8 ký tự, gồm chữ hoa, thường, số và ký tự đặc biệt.");
        }

        const hashed = await bcrypt.hash(newPassword, 10);
        user.password = hashed;
        await user.save();
    };

    sendChangeEmailService = async (userId, newEmail) => {
        const user = await this.User.findById(userId);
        if (!user) 
            throw new Error("Không tìm thấy người dùng.");

        const emailExists = await this.User.findOne({
            email: newEmail,
            _id: { $ne: user._id }
        });

        if (emailExists) 
            throw new Error("Email đã được sử dụng.");

        const otp = (Math.floor(100000 + Math.random() * 900000)).toString();

        user.emailChangeOtp = otp;
        user.emailChangeNew = newEmail;
        user.emailChangeExpires = Date.now() + 10 * 60 * 1000;

        await user.save();
        await this.mailService.sendVerificationEmail(newEmail, otp);
    };

    verifyChangeEmailService = async (userId, otp) => {
        const user = await this.User.findById(userId);
        if (!user) 
            throw new Error("Không tìm thấy người dùng.");

        if (
            !user.emailChangeOtp ||
            user.emailChangeOtp !== otp ||
            user.emailChangeExpires < Date.now()
        ) {
            throw new Error("Mã OTP không hợp lệ hoặc đã hết hạn.");
        }

        user.email = user.emailChangeNew;
        user.emailChangeOtp = undefined;
        user.emailChangeNew = undefined;
        user.emailChangeExpires = undefined;

        await user.save();

        return user.email;
    };

    updateAvatarService = async (userId, avatarUrl) => {
        if (!avatarUrl) 
            throw new Error("Không có file.");

        const updatedUser = await this.User.findByIdAndUpdate(
            userId,
            { avatar: avatarUrl },
            { new: true }
        );

        if (!updatedUser) 
            throw new Error("Không tìm thấy người dùng.");

        return updatedUser.avatar;
    };

    async setRole({ userId, newRole }) {
        try {    
            if (!userId || !newRole) {
                throw new Error("Thiếu userId hoặc newRole.");
            }
    
            if (!["employee", "customer"].includes(newRole)) {
                throw new Error("Role không hợp lệ.");
            }
    
            const user = await this.User.findById(userId);
            if (!user) {
                throw new Error("Không tìm thấy user.");
            }
    
            if (user.system_role === newRole) {
                throw new Error(`User đã là ${newRole}.`);
            }
    
            user.system_role = newRole;
            await user.save();

            return { success: true };
    
            // const notification = await Notification.create({
            //     user_id: user._id,
            //     title: "Thay đổi quyền",
            //     content: `Quyền hệ thống của bạn đã được đổi thành ${newRole}.`
            // });
    
            // emitToUser(req.app.get("io"), user._id.toString(), "user:role_updated", {
            //     notification,
            // });
        } catch (err) {
            console.log("Admin setting new role failed for error: " + err.message);
            throw err;
        }
    };
}