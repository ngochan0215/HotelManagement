import bcrypt from "bcrypt";
import jwt from "jsonwebtoken";
import mongoose from "mongoose";

export class AuthService {
    constructor({ User, Customer, Employee, sendResetPasswordEmail }) {
        this.User = User;
        this.Customer = Customer;
        this.Employee = Employee;
        this.sendResetPasswordEmail = sendResetPasswordEmail;
    }

    async register (data) {
        const { email, password, date_birth, full_name, phone_number, nationality, CCCD } = data;

        if (!email || !password || !date_birth || !full_name || !phone_number || !nationality || !CCCD) {
            throw new Error("Vui lòng nhập đầy đủ thông tin.");
        }

        const existed = await this.User.findOne({ email });
        if (existed) throw new Error("Email đã tồn tại");

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

        if (await this.Customer.findOne({ phone_number })) {
            throw new Error("Số điện thoại đã tồn tại");
        }

        if (await this.Customer.findOne({ CCCD })) {
            throw new Error("CCCD đã tồn tại");
        }

        const regex = /^(?=.*[A-Z])(?=.*[a-z])(?=.*\d)(?=.*[@$!%*#?&]).{8,}$/;
        if (!regex.test(password)) {
            throw new Error("Mật khẩu mới phải có ít nhất 8 ký tự, gồm chữ hoa, thường, số và ký tự đặc biệt.");
        }

        const hashed = await bcrypt.hash(password, 10);
        const otp = Math.floor(100000 + Math.random() * 900000).toString();

        const user = await this.User.create({
            email,
            password: hashed,
            system_role: "customer",
            // TODO: khi làm role khách hàng thì đổi thành false
            emailVerified: true,
            verifyEmailOtp: otp,
            verifyEmailOtpExpires: Date.now() + 5 * 60 * 1000,
        });

        const customer = await this.Customer.create({
            user_id: user._id,
            date_birth,
            full_name,
            phone_number,
            nationality,
            CCCD,
        });

        return { user, customer };
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
            const customer = await this.Customer.findOne({ user_id: user._id });
            if (customer) fullName = customer.full_name;
        } else {
            const employee = await this.Employee.findOne({ user_id: user._id });
            if (employee) {
                fullName = employee.full_name;
                position = employee.position;
            }
        }

        const token = jwt.sign(
            { userId: user._id, role: user.system_role },
            process.env.JWT_SECRET,
            { expiresIn: "1d" }
        );

        return {
            token,
            theUser: {
                _id: user._id,
                name: fullName,
                position,
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
        await this.sendResetPasswordEmail(email, otp);

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
}