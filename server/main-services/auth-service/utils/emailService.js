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
        await this.transporter.sendMail({
            from: `"ThuHan Hotel Management" <${process.env.EMAIL_USER}>`,
            to: email,
            subject: "Đặt lại mật khẩu",
            text: `Mã OTP của bạn là: ${otp}. Mã sẽ hết hạn sau 5 phút.`,
        });
    }

    async sendVerificationEmail(email, otp) {
        await this.transporter.sendMail({
            from: `"ThuHan Hotel Management" <${process.env.EMAIL_USER}>`,
            to: email,
            subject: "Xác thực email",
            text: `Mã OTP của bạn là: ${otp}. Mã sẽ hết hạn sau 5 phút.`,
        });
    }
};

export default new MailService();