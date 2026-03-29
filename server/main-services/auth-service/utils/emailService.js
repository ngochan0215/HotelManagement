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

    // async sendFirstVerificationEmail(email, userId) {
    //     const token = jwt.sign(
    //         { userId },
    //         process.env.JWT_SECRET,
    //         { expiresIn: "1h" }
    //     );

    //     const verifyLink = `${process.env.BACKEND_URL}/auth/verify-email?token=${token}`;

    //     await this.transporter.sendMail({
    //         from: `"ThuHan Hotel Management" <${process.env.EMAIL_USER}>`,
    //         to: email,
    //         subject: "Xác thực email",
    //         html: `
    //             <h2>Chào mừng bạn đến với ThuHan Hotel!</h2>
    //             <p>Bấm vào nút dưới đây để xác thực email:</p>
    //             <a href="${verifyLink}"
    //                style="display:inline-block;padding:10px 20px;background:#4f46e5;color:white;text-decoration:none;border-radius:6px;">
    //                Xác thực email
    //             </a>
    //         `
    //     });
    // }
};

export default new MailService();