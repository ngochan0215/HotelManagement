import bcrypt from "bcrypt";
import jwt from "jsonwebtoken";
import { EMPLOYEE_EVENTS } from "../../shared/events/employeeEvents.js";
import { CUSTOMER_EVENTS } from "../../shared/events/customerEvents.js";

export class AuthService {
    constructor({ User, customerClient, employeeClient, mailService, defaultAvatars, eventBus }) {
        this.User = User;
        this.customerClient = customerClient;
        this.employeeClient = employeeClient;
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
                // await this.eventBus.publish(CUSTOMER_EVENTS.REGISTERED, {
                //     userId: user._id,
                //     customer: {
                //         date_birth, full_name, phone_number, nationality, CCCD
                //     }
                // })
                await this.customerClient.createCustomer({
                    userId: user._id,
                    payload: {
                        date_birth, full_name, phone_number, nationality, CCCD
                    }
                });
            } else if (system_role === "employee") {
                // await this.eventBus.publish(EMPLOYEE_EVENTS.REGISTERED, {
                //     userId: user._id,
                //     employee: {
                //         date_birth, full_name, phone_number, position, fixed_salary, CCCD
                //     }
                // })
                await this.employeeClient.createEmployee({
                    userId: user._id,
                    payload: {
                        date_birth, full_name, phone_number, position, fixed_salary, CCCD
                    }
                });
            }
        } catch (error) {
            await this.User.deleteOne({ _id: user._id }).catch(rollbackErr => {
                console.error(`Rollback failed for deleting user ${user._id}:`, rollbackErr);
            });

            // Lấy message thực từ response của service kia
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

        let fullName = "Người dùng";
        let position = "";
        
        if (user.system_role === "customer") {
            const customer = await this.customerClient.getCustomerByUserId(user._id);
            //console.log("CUSTOMER IN LOGIN: ", customer);
            if (customer) fullName = customer.full_name;
        } else {
            const employee = await this.employeeClient.findEmployeeByUserId(user._id);
            //console.log("EMPLOYEE IN LOGIN: ", employee);
            if (employee) {
                fullName = employee.full_name;
                position = employee.position;
            }
        }

        const payload = {
            userId: user._id,
            role: user.system_role
        };

        if (position) {
            payload.position = position;
        }

        const token = jwt.sign(
            payload, process.env.JWT_SECRET,
            { expiresIn: "7d" }
        );

        return {
            token,
            theUser: {
                _id: user._id,
                name: fullName,
                position: position,
                email: user.email,
                role: user.system_role,
                avatar: user.avatar
            }
        };
    };

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
        console.log("USERID: ", userId);
        console.log("NEW PASSWORD: ", newPassword);

        const regex = /^(?=.*[A-Z])(?=.*[a-z])(?=.*\d)(?=.*[@$!%*#?&]).{8,}$/;
        if (!regex.test(newPassword)) {
            throw new Error("Mật khẩu mới phải có ít nhất 8 ký tự, gồm chữ hoa, thường, số và ký tự đặc biệt.");
        }

        const user = await this.User.findById(userId);
        user.password = newPassword;

        await user.save();
    }

    async getUserById(userId) {
        return this.User.findById(userId).select("email system_role avatar isBanned");
    }

    async getUserByEmail(email) {
        return this.User.findOne({ email });
    }

    async updateUser(userId, payload) {
        return this.User.findByIdAndUpdate(userId, payload, { new: true });
    }

    async deleteUser(userId) {
        return this.User.findByIdAndDelete(userId);
    }
}