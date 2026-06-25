import nodemailer from "nodemailer";
import dotenv from "dotenv";

dotenv.config();

class MailService {
    constructor() {
        this.transporter = nodemailer.createTransport({
            service: "gmail",
            auth: {
                user: process.env.EMAIL_USER,
                pass: process.env.EMAIL_PASS,
            },
        });
    }

    async sendResetPasswordEmail(email, otp) {
        try {
            await this.transporter.sendMail({
                from: `"ThuHan Hotel Management" <${process.env.EMAIL_USER}>`,
                to: email,
                subject: "Đặt lại mật khẩu",
                text: `Mã OTP của bạn là: ${otp}. Mã sẽ hết hạn sau 5 phút.`,
            });
        } catch (error) {
            console.error("Error sending reset password email:", error);
            throw new Error("Failed to send reset password email.");
        }
    }

    async sendVerificationEmail(email, otp) {
        try {
            await this.transporter.sendMail({
                from: `"ThuHan Hotel Management" <${process.env.EMAIL_USER}>`,
                to: email,
                subject: "Xác thực email",
                text: `Mã OTP của bạn là: ${otp}. Mã sẽ hết hạn sau 5 phút.`,
            });
        } catch (error) {
            console.error("Error sending verification email:", error);
            throw new Error("Failed to send verification email.");
        }
    }
};

export default new MailService();