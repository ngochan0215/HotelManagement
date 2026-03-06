import { container } from "../containers/container.js";

export class AuthController {
    constructor() {
        this.authService = container.authService;
    }

    register = async (req, res) => {
        try {
            const result = await this.authService.register(req.body);
            res.status(201).json({
                message: "Đăng ký thành công.",
                userID: result.user._id,
                customerId: result.customer._id
            });
        } catch (err) {
            res.status(err.status || 400).json({ message: err.message });
        }
    };


    verifyEmail = async (req, res) => {
        try {
            await this.authService.verifyEmail(req.user.userId, req.body.otp);
            res.json({ message: "Xác thực email thành công." });
        } catch (err) {
            res.status(400).json({ message: err.message });
        }
    };


    login = async (req, res) => {
        try {
            const result = await this.authService.login(req.body.email, req.body.password);
            res.json({ message: "Đăng nhập thành công", ...result });
        } catch (err) {
            res.status(400).json({ message: err.message });
        }
    };


    Logout = (req, res) => {
        res.json({ message: "Đăng xuất thành công" });
    };


    forgotPassword = async (req, res) => {
        try {
            await this.authService.forgotPassword(req.body.email);
            res.json({ message: "Đã gửi email đặt lại mật khẩu." });
        } catch (err) {
            res.status(400).json({ message: err.message });
        }
    };

    resetPassword = async (req, res) => {
        try {
            const { email, otp, newPassword } = req.body;
            await this.authService.resetPassword(email, otp, newPassword);
            res.json({ message: "Đặt lại mật khẩu thành công." });
        } catch (err) {
            res.status(400).json({ message: err.message });
        }
    };
}
