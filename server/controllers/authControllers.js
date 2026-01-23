import bcrypt from "bcrypt";
import jwt from "jsonwebtoken";
import { User, Customer } from "../models/index.js";
import { sendResetPasswordEmail } from "../utils/sendEmails.js";

// khách hàng đăng ký
export const register = async (req, res) => {
    try {
        const { email, password, date_birth, full_name, phone_number, nationality, CCCD } = req.body;

        if(!email || !password || !date_birth || !full_name || !phone_number || !nationality || !CCCD)
            return res.status(400).json({ message: "Vui lòng nhập đầy đủ thông tin."});

        const existed = await User.findOne({ email });
        if (existed) 
            return res.status(400).json({ message: "Email đã tồn tại" });

        const dob = new Date(date_birth);
        if (isNaN(dob.getTime())) {
            return res.status(400).json({ message: "Ngày sinh không hợp lệ" });
        }
        // Tính tuổi
        const today = new Date();
        let age = today.getFullYear() - dob.getFullYear();
        const m = today.getMonth() - dob.getMonth();
        if (m < 0 || (m === 0 && today.getDate() < dob.getDate())) age--;

        if (age < 18) {
            return res.status(403).json({ message: "Bạn phải đủ 18 tuổi để đăng ký tài khoản." });
        }

        if (await Customer.findOne({ phone_number })) {
            return res.status(400).json({ message: "Số điện thoại đã tồn tại" });
        }

        if (await Customer.findOne({ CCCD })) {
            return res.status(400).json({ message: "CCCD đã tồn tại" });
        }

        const regex = /^(?=.*[A-Z])(?=.*[a-z])(?=.*\d)(?=.*[@$!%*#?&])[A-Za-z\d@$!%*#?&]{8,}$/;
        if(!regex.test(password)) {
            return res.status(400).json({ message: "Mật khẩu mới phải có ít nhất 8 ký tự, bao gồm một chữ hoa, chữ thường, số và ký tự đặc biệt." });
        }

        const hashed = await bcrypt.hash(password, 10);
        const otp = Math.floor(100000 + Math.random() * 900000).toString();

        const user = await User.create({
            email,
            password: hashed,
            system_role: "customer",
            // TODO: khi có UI khách hàng thì đổi thành false
            emailVerified: true, 
            verifyEmailOtp: otp,
            verifyEmailOtpExpires: Date.now() + 5 * 60 * 1000,
        });

        const customer = await Customer.create({
            user_id: user._id,
            date_birth,
            full_name,
            phone_number,
            nationality,
            CCCD,
        });

        // TODO: nhớ uncomment
        //await sendVerificationEmail(email, otp);

        res.status(201).json({ message: "Đăng ký thành công.", userID: user._id, customerId: customer._id });

    } catch (error) {
        return res.status(500).json({ message: error.message });
    }
};

export const verifyEmail = async (req, res) => {
  try {
    const { otp } = req.body;

    const user = await User.findById(req.user.userId).select("+password");
    if(!user){
        return res.status(404).json({ message: "Không tìm thấy người dùng." });
    }

    if (!user.verifyEmailOtp || user.verifyEmailOtp !== otp || user.verifyEmailOtpExpires < Date.now()) {
      return res.status(400).json({ message: "Mã OTP không hợp lệ hoặc đã hết hạn." });
    }

    user.emailVerified = true;
    user.verifyEmailOtp = null;
    user.verifyEmailOtpExpires = null;
    await user.save();

    res.status(200).json({ message: "Xác thực email thành công. Vui lòng đăng nhập!" });
  } catch (error) {
    res.status(500).json({ message: "SERVER ERROR: ", error: error.message });
  }
};

// đăng nhập
export const login = async (req, res) => {
    try {
        const { email, password } = req.body;
        const user = await User.findOne({ email: email });
        
        if (!user) 
            return res.status(400).json({ message: "Tài khoản không tồn tại" });

        if(!user.emailVerified)
            return res.status(401).json({ message: "Email chưa được xác thực." });

        if(user.status === "active")
            return res.status(401).json({ message: "Tài khoản này đã ngừng hoạt động." });

        if(user.status === "banned")
            return res.status(401).json({ message: "Tài khoản này đã bị ban." });

        const isMatch = await bcrypt.compare(password, user.password);
        if (!isMatch) 
            return res.status(401).json({ message: "Sai mật khẩu" });

        const token = jwt.sign({ userId: user._id, role: user.system_role }, process.env.JWT_SECRET, {
            expiresIn: "1d",
        });

        const theUser = {
            _id: user._id,
            name: user.name,
            email: user.email,
            role: user.system_role
        };

        res.json({ message: "Đăng nhập thành công", token, theUser });
    } catch (err) {
        res.status(500).json({ message: "Lỗi server", error: err.message });
    }
};

// đăng xuất
export const Logout = (req, res) => {
    // bên FE set token = null hoặc clear gì đấy
    return res.json({ message: "Đăng xuất thành công" });
};

// quên mật khẩu
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

// đặt lại mật khẩu
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

