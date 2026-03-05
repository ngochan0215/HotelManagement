import {
    registerService,
    verifyEmailService,
    loginService,
    forgotPasswordService,
    resetPasswordService
} from "../services/authService.js";


export const register = async (req, res) => {
    try {
        const result = await registerService(req.body);
        res.status(201).json({
            message: "Đăng ký thành công.",
            userID: result.user._id,
            customerId: result.customer._id
        });
    } catch (err) {
        res.status(err.status || 400).json({ message: err.message });
    }
};


export const verifyEmail = async (req, res) => {
    try {
        await verifyEmailService(req.user.userId, req.body.otp);
        res.json({ message: "Xác thực email thành công." });
    } catch (err) {
        res.status(400).json({ message: err.message });
    }
};


export const login = async (req, res) => {
    try {
        const result = await loginService(req.body.email, req.body.password);
        res.json({ message: "Đăng nhập thành công", ...result });
    } catch (err) {
        res.status(400).json({ message: err.message });
    }
};


export const Logout = (req, res) => {
    res.json({ message: "Đăng xuất thành công" });
};


export const forgotPassword = async (req, res) => {
    try {
        await forgotPasswordService(req.body.email);
        res.json({ message: "Đã gửi email đặt lại mật khẩu." });
    } catch (err) {
        res.status(400).json({ message: err.message });
    }
};


export const resetPassword = async (req, res) => {
    try {
        const { email, otp, newPassword } = req.body;
        await resetPasswordService(email, otp, newPassword);
        res.json({ message: "Đặt lại mật khẩu thành công." });
    } catch (err) {
        res.status(400).json({ message: err.message });
    }
};