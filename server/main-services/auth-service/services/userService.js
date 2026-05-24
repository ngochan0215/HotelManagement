import bcrypt from "bcrypt";
import { CUSTOMER_EVENTS } from "../../../shared/events/customerEvents.js";
import { EMPLOYEE_EVENTS } from "../../../shared/events/employeeEvents.js";

export class UserService {
    constructor({ User, mailService, eventBus, sendNotification }) {
        this.User = User;
        this.mailService = mailService;
        this.eventBus = eventBus;
        this.sendNotification = sendNotification;
        
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

    async getUserProfile(userId) {
        try {
            const user = await this.User.findById(userId)
                .select("email system_role avatar isBanned")
                .lean();

            if (!user) {
                throw new Error("User not found.");
            }

            let extraData = {};

            if (user.system_role === "customer") {
                const reply = await this.eventBus.safeRequest(
                    CUSTOMER_EVENTS.CHECK_EXISTS_USERID,
                    { customer_user_id: user._id }
                );
    
                if (reply.found)
                    extraData = reply.customer;

            } else {
                const reply = await this.eventBus.safeRequest(
                    EMPLOYEE_EVENTS.CHECK_EXISTS_USERID,
                    { employee_user_id: user._id }
                );
    
                if (reply.found)
                    extraData = reply.employee;
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
        try {
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
        } catch (error) {
            console.log("Change password failed for error: " + error.message);
            throw error;
        }
    };

    sendChangeEmailService = async (userId, newEmail) => {
        try {
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

        } catch (error) {
            console.log("Send change email OTP failed for error: " + error.message);
            throw error;
        }
    };

    verifyChangeEmailService = async (userId, otp) => {
        try {
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
        } catch (error) {
            console.log("Verify change email OTP failed for error: " + error.message);
            throw error;
        }
    };

    updateAvatarService = async (userId, avatarUrl) => {
        try {
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
        } catch (error) {
            console.log("Update avatar failed for error: " + error.message);
            throw error;
        }
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

            await this.sendNotification({
                userId,
                title: "Quyền hệ thống đã thay đổi",
                content: `Admin đã thay đổi quyền hệ thống của bạn thanhf ${newRole}. Vui lòng đăng nhập lại.`,
                type: "system",
                kind: "User",
                refId: userId
            });

            return { success: true };
    
        } catch (err) {
            console.log("Admin setting new role failed for error: " + err.message);
            throw err;
        }
    };

    // for communication with other services
    async findUserByEmail(email) {
        return this.User.findOne({ email });
    }
    
    async updateUser(userId, payload) {
        return this.User.findByIdAndUpdate(userId, payload, { new: true });
    }

    async getUserById (userId) {
        const user = await this.User.findById(userId)
            .select("email system_role avatar isBanned")

        if (!user) {
            throw new Error("User not found.");
        }
        
        return user;
    };

    async getUsersByIds (userIds) {
        const users = await this.User.find({ _id: { $in: userIds } })
            .select("email system_role avatar isBanned");  

        return users;
    }
}