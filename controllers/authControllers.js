import bcrypt from "bcrypt";
import jwt from "jsonwebtoken";
import { User } from "../models/index.js";
import { sendResetPasswordEmail } from "../utils/sendEmails.js";

export const Login = async (req, res) => {
    try {
        const { email, password } = req.body;
        const user = await User.findOne({ email: email });

        if(!user.emailVerified)
            return res.status(401).json({ message: "Email chưa được xác thực." });

        if (!user) 
            return res.status(400).json({ message: "Tài khoản không tồn tại" });

        const isMatch = await bcrypt.compare(password, user.password);
        if (!isMatch) 
            return res.status(401).json({ message: "Sai mật khẩu" });

        const token = jwt.sign({ userId: user._id, role: user.system_role }, process.env.JWT_SECRET, {
            expiresIn: "1d",
        });

        res.json({ message: "Đăng nhập thành công", token });
    } catch (err) {
        res.status(500).json({ message: "Lỗi server", error: err.message });
    }
};

export const forgotPassword = async (req, res, ) => {
    const { email } = req.body;
    const user = await User.findOne({ email });
    if (!user){
        return res.status(404).json({ message: "Không tìm thấy email."});
    }

    const otp = (Math.floor(100000 + Math.random() * 900000)).toString();
    user.resetPasswordOtp = otp;
    user.resetPasswordExpires = Date.now() + 5 * 60 * 1000;
    await user.save();

    await sendResetPasswordEmail(email, otp);

    res.json({ message: "Đã gửi email đặt lại mật khẩu. Vui lòng check email của bạn!"});
};

// Đặt lại mật khẩu
export const resetPassword = async (req, res) => {
    const { email, otp, newPassword } = req.body;
    const user = await User.findOne({
        email,
        resetPasswordOtp: otp,
        resetPasswordExpires: { $gt: Date.now() }
    });
    if (!user) 
        return res.status(400).json({ message: "Mã OTP không hợp lệ hoặc đã hết hạn." });

    const hashedPassword = await bcrypt.hash(newPassword, 10);
    user.password = hashedPassword;
    user.resetPasswordOtp = undefined;
    user.resetPasswordExpires = undefined;
    await user.save();

    res.json({ message: "Đặt lại mật khẩu thành công." });
};

