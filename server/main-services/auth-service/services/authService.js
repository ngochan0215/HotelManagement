import bcrypt from "bcrypt";
import jwt from "jsonwebtoken";
import { OAuth2Client } from "google-auth-library";
import { EMPLOYEE_EVENTS } from "../../../shared/events/employeeEvents.js";
import { CUSTOMER_EVENTS } from "../../../shared/events/customerEvents.js";

export class AuthService {
    constructor({ User, mailService, defaultAvatars, eventBus }) {
        this.User = User;
        this.mailService = mailService;
        this.defaultAvatars = defaultAvatars;
        this.eventBus = eventBus;
    }

    // create only user record
    async createUserAccount({ email, password, system_role }) {
        try {
            const existed = await this.User.findOne({ email });
            if (existed) 
                throw new Error("Email đã tồn tại");

            const regex = /^(?=.*[A-Z])(?=.*[a-z])(?=.*\d)(?=.*[@$!%*#?&]).{8,}$/;
            if (!regex.test(password)) {
                throw new Error("Mật khẩu mới phải có ít nhất 8 ký tự, gồm chữ hoa, thường, số và ký tự đặc biệt.");
            }

            const hashed = await bcrypt.hash(password, 10);
            const otp = Math.floor(100000 + Math.random() * 900000).toString();
            const randomAvatar = this.defaultAvatars[Math.floor(Math.random() * this.defaultAvatars.length)];
            const isCustomer = system_role === "customer"? true : false;

            const user = await this.User.create({
                email,
                password: hashed,
                system_role: system_role,
                avatar: randomAvatar,
                emailVerified: isCustomer ? false : true,
                verifyEmailOtp: isCustomer ? otp : null,
                verifyEmailOtpExpires: isCustomer ? Date.now() + 5 * 60 * 1000 : null,
            });

            return user;
        } catch (error) {
            console.log("Registration failed for error: " + error.message);
            throw error;
        }
    }

    // for employee and customer signing up
    async register (data) {
        const { email, password, date_birth, full_name, phone_number, nationality, 
            position, fixed_salary, CCCD, system_role } = data;

        if (!email || !password || !date_birth || !full_name || !phone_number || !CCCD || !system_role) {
            throw new Error("Vui lòng nhập đầy đủ thông tin.");
        }

        if (system_role === "employee") {
            if (!position)
                throw new Error("Vui lòng nhập chức vụ của nhân viên.");
        }

        const dob = new Date(date_birth);
        if (isNaN(dob.getTime())) 
            throw new Error("Ngày sinh không hợp lệ");

        let age = new Date().getFullYear() - dob.getFullYear();
        const m = new Date().getMonth() - dob.getMonth();
        if (m < 0 || (m === 0 && new Date().getDate() < dob.getDate())) age--;

        if (age < 18) {
            const err = new Error("Bạn phải đủ 18 tuổi để đăng ký tài khoản.");
            err.status = 403;
            throw err;
        }

        const user = await this.createUserAccount({ email, password, system_role });

        try {
            if (system_role === "customer") {
                const reply = await this.eventBus.safeRequest(
                    CUSTOMER_EVENTS.REGISTERED, 
                    {
                        userId: user._id,
                        customer: {
                            date_birth, full_name, phone_number, nationality, CCCD
                        }
                    }
                );

                if (!reply.success) {
                    await this.User.deleteOne({ _id: user._id }).catch(err => {
                        console.error("Rollback failed:", err);
                    });

                    const err = new Error(reply.message || "Tạo khách hàng thất bại.");
                    err.status = 400;
                    throw err;
                }

            } else if (system_role === "employee") {
                const reply = await this.eventBus.safeRequest(
                    EMPLOYEE_EVENTS.REGISTERED, 
                    {
                        userId: user._id,
                        employee: {
                            date_birth, full_name, phone_number, position, fixed_salary, CCCD
                        }
                    }
                );

                if (!reply.success) {
                    await this.User.deleteOne({ _id: user._id }).catch(err => {
                        console.error("Rollback failed:", err);
                    });

                    const err = new Error(reply.message || "Tạo nhân viên thất bại.");
                    err.status = 400;
                    throw err;
                }
            }
        } catch (error) {
            await this.User.deleteOne({ _id: user._id }).catch(rollbackErr => {
                console.error(`Rollback failed for deleting user ${user._id}:`, rollbackErr);
            });

            const message = error.response?.data?.message || error.message;
            const status = error.response?.status || 500;
            
            const err = new Error(message);
            err.status = status;
            throw err;
        }

        return user;
    };

    async verifyEmail (userId, otp) {
        const user = await this.User.findById(userId).select("+password");
        if (!user) 
            throw new Error("Không tìm thấy người dùng.");

        if (!user.verifyEmailOtp || user.verifyEmailOtp !== otp || user.verifyEmailOtpExpires < Date.now()) {
            throw new Error("Mã OTP không hợp lệ hoặc đã hết hạn.");
        }

        user.emailVerified = true;
        user.verifyEmailOtp = null;
        user.verifyEmailOtpExpires = null;

        await user.save();
        return { success: true };
    };

    async login (email, password) {
        const user = await this.User.findOne({ email });
        if (!user) 
            throw new Error("Tài khoản không tồn tại");

        if (!user.emailVerified) 
            throw new Error("Email chưa được xác thực.");

        if (user.status === "inactive") 
            throw new Error("Tài khoản đã ngừng hoạt động.");
        if (user.status === "banned") 
            throw new Error("Tài khoản đã bị ban.");

        const isMatch = await bcrypt.compare(password, user.password);
        if (!isMatch) 
            throw new Error("Sai mật khẩu");

        const { payload, fullName } = await this.buildTokenPayLoad(user);

        const token = jwt.sign(
            payload, process.env.JWT_SECRET,
            { expiresIn: "7d" }
        );

        return {
            token,
            theUser: {
                _id: user._id,
                name: fullName,
                position: payload.position,
                email: user.email,
                role: user.system_role,
                avatar: user.avatar
            }
        };
    };

    async buildTokenPayLoad(user) {
        let fullName = "Người dùng";
        let position = "";
        let employeeId = null;
        let customerId = null;
        
        if (user.system_role === "customer") {
            const reply = await this.eventBus.safeRequest(
                CUSTOMER_EVENTS.CHECK_EXISTS_USERID,
                { customer_user_id: user._id }
            );

            if (reply.found) {
                fullName = reply.customer.full_name;
                customerId = reply.customer._id;
            }
        } else {
            const reply = await this.eventBus.safeRequest(
                EMPLOYEE_EVENTS.CHECK_EXISTS_USERID,
                { employee_user_id: user._id }
            );

            if (reply.found) {
                fullName = reply.employee.full_name;
                position = reply.employee.position;
                employeeId = reply.employee._id;
            }
        }

        let payload = {
            userId: user._id,
            role: user.system_role
        };

        if (position) payload.position = position;
        if (employeeId) payload.employeeId = employeeId;
        if (customerId) payload.customerId = customerId;

        return { payload, fullName };
    }

    async loginGoogle (tokenGoogle) {
        try {
            const client = new OAuth2Client(process.env.GOOGLE_CLIENT_ID);
            // verify token with google
            const ticket = await client.verifyIdToken({
                idToken: tokenGoogle,
                audience: process.env.GOOGLE_CLIENT_ID
            });

            const googlePayload = ticket.getPayload();
            const { email, name, picture, sub: googleId } = googlePayload;

            const user = await this.User.findOne({ email });
            if (!user) {
                return {
                    isNewUser: true,
                    googleData: {
                        email, name, picture, googleId
                    }
                };
            }

            const { payload, fullName } = await this.buildTokenPayLoad(user);

            const token = jwt.sign(
                payload, process.env.JWT_SECRET,
                { expiresIn: "7d" }
            );

            return {
                token,
                theUser: {
                    _id: user._id,
                    name: fullName,
                    position: payload.position,
                    email: user.email,
                    role: user.system_role,
                    avatar: user.avatar
                }
            };

        } catch (error) {
            const message = error.response?.data?.message || error.message;
            const status = error.response?.status || error.status;
            const err = new Error(message);
            err.status = status;
            throw err;
        }
    };

    // async logout(token) {
    //     try {
    //         if (!token) throw new Error("Không tìm thấy token");

    //         // decode without verifying to get expiry
    //         const decoded = jwt.decode(token);
    //         if (!decoded || !decoded.exp) throw new Error("Token không hợp lệ");

    //         const now = Math.floor(Date.now() / 1000);
    //         const ttl = decoded.exp - now;

    //         // only blacklist if token hasn't already expired
    //         if (ttl > 0) {
    //             await this.redis.set(
    //                 `blacklist:${token}`,
    //                 "1",
    //                 "EX",
    //                 ttl
    //             );
    //         }

    //         return { success: true };

    //     } catch (err) {
    //         console.error("Error logging out:", err);
    //         throw err;
    //     }
    // }

    // async isTokenBlacklisted(token) {
    //     const result = await this.redis.get(`blacklist:${token}`);
    //     return result !== null;
    // }

    async forgotPassword (email) {
        const user = await this.User.findOne({ email });
        if (!user) 
            throw new Error("Không tìm thấy email.");

        const otp = (Math.floor(100000 + Math.random() * 900000)).toString();
        user.resetPasswordOtp = otp;
        user.resetPasswordExpires = Date.now() + 5 * 60 * 1000;

        await user.save();
        await this.mailService.sendResetPasswordEmail(email, otp);

        return { success: true };
    };

    async resetPassword (email, otp, newPassword) {
        const user = await this.User.findOne({
            email,
            resetPasswordOtp: otp,
            resetPasswordExpires: { $gt: Date.now() }
        });

        if (!user) throw new Error("Mã OTP không hợp lệ hoặc đã hết hạn.");

        const hashed = await bcrypt.hash(newPassword, 10);

        user.password = hashed;
        user.resetPasswordOtp = undefined;
        user.resetPasswordExpires = undefined;

        await user.save();
        return { success: true };
    };

    async adminResetPassword ({ userId, newPassword }) {
        // console.log("USERID: ", userId);
        // console.log("NEW PASSWORD: ", newPassword);

        const regex = /^(?=.*[A-Z])(?=.*[a-z])(?=.*\d)(?=.*[@$!%*#?&]).{8,}$/;
        if (!regex.test(newPassword)) {
            throw new Error("Mật khẩu mới phải có ít nhất 8 ký tự, gồm chữ hoa, thường, số và ký tự đặc biệt.");
        }

        const user = await this.User.findById(userId);
        if (!user) throw new Error("Không tìm thấy tài khoản người dùng.");

        user.password = newPassword;

        await user.save();
        return true;
    };

    async deleteUser(userId) {
        return this.User.findByIdAndDelete(userId);
    };
}