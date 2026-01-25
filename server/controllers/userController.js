import { User, Employee, Customer } from "../models/index.js";
import bcrypt from "bcrypt";
import crypto from "crypto";
import { sendVerificationEmail } from "../utils/sendEmails.js";
import { defaultAvatars } from "../config/avatars.js";

export const viewProfile = async (req, res) => {
    try {
        const currentUserId = req.user.userId || req.user._id;
        let profile = await Employee.findOne({ user_id: currentUserId })
            .populate("user_id", "email system_role avatar");
        if (!profile) {
            profile = await User.findById(currentUserId).select("email system_role avatar");
        }

        if (!profile) {
            return res.status(404).json({ message: "Không tìm thấy hồ sơ người dùng." });
        }

        res.json({ message: "Lấy thông tin thành công.", data: profile });

    } catch (err) {
        console.error("Lỗi viewProfile:", err);
        res.status(500).json({ message: "Lỗi server", error: err.message });
    }
};

export const updateProfile = async (req, res) => {
    try {
        const userId = req.user.userId || req.user._id;
        const { name, phone, dob, nationality, cccd, BIN, account_number, bank_shortName } = req.body;

        const user = await User.findById(userId).select("email system_role avatar");
        if (!user) {
            return res.status(404).json({ message: "Không tìm thấy người dùng." });
        }

        let profileModel = null;
        if (user.system_role === "customer") {
            profileModel = Customer;
        } else if (user.system_role === "employee") {
            profileModel = Employee;
        }

        if (!profileModel) {
            return res.status(400).json({ message: "Loại người dùng không hợp lệ." });
        }

        const profile = await profileModel.findOne({ user_id: user._id });
        if (!profile) {
            return res.status(404).json({ message: "Không tìm thấy hồ sơ cá nhân để cập nhật." });
        }

        if (phone) profile.phone_number = phone;
        if (dob) profile.date_birth = new Date(dob);

        await profile.save();

        res.json({
            message: "Cập nhật thông tin thành công.",
            data: profile
        });
    } catch (error) {
        console.error("Lỗi updateProfile:", error);
        res.status(500).json({ message: "Lỗi server", error: error.message });
    }
};

export const changePassword = async (req, res) => {
    try {
        const { oldPassword, newPassword } = req.body;
        const user = await User.findById(req.user.userId).select("+password");
        if(!user){
            return res.status(404).json({ message: "Không tìm thấy người dùng." });
        }

        const isMatch = await bcrypt.compare(oldPassword, user.password);
        if(!isMatch) {
            return res.status(400).json({ message: "Mật khẩu cũ không đúng." });
        }

        const regex = /^(?=.*[A-Z])(?=.*[a-z])(?=.*\d)(?=.*[@$!%*#?&])[A-Za-z\d@$!%*#?&]{8,}$/;
        if(!regex.test(newPassword)) {
            return res.status(400).json({ message: "Mật khẩu mới phải có ít nhất 8 ký tự, bao gồm một chữ hoa, chữ thường, số và ký tự đặc biệt." });
        }

        const hashedPassword = await bcrypt.hash(newPassword, 10);
        user.password = hashedPassword;
        await user.save();

        res.json({ message: "Đổi mật khẩu thành công." });
    } catch (error) {
        res.status(500).json({ message: "LỖI SERVER: ", error: error.message });
    }
};

export const sendEmail = async (req, res) => {
    try {
        const userId = req.user.userId || req.user._id;
        const { newEmail } = req.body;
        const user = await User.findById(req.user.userId).select("+password");
        if(!user){
            return res.status(404).json({ message: "Không tìm thấy người dùng." });
        }

        const emailExists = await User.findOne({ email: newEmail, _id: { $ne: user._id }});
        if(emailExists) {
            return res.status(400).json({ message: "Email đã được sử dụng." });
        }

        const otp = (Math.floor(100000 + Math.random() * 900000)).toString();
        user.emailChangeOtp = otp;
        user.emailChangeNew = newEmail;
        user.emailChangeExpires = Date.now() + 10 * 60 * 1000; // 10 phút

        await user.save();
        await sendVerificationEmail(newEmail, otp);

        res.json({ message: "Mã OTP đã được gửi tới email mới." });
    } catch (error) {
        res.status(500).json({ message: "LỖI SERVER: ", error: error.message });
    }
};

export const verifyEmail = async (req, res) => {
    try {
        const userId = req.user.userId || req.user._id;
        const { otp } = req.body;
    const user = await User.findById(req.user.userId).select("+password");
    if(!user){
        return res.status(404).json({ message: "Không tìm thấy người dùng." });
    }
    if (!user.emailChangeOtp || user.emailChangeOtp !== otp || user.emailChangeExpires < Date.now()) {
      return res.status(400).json({ message: "Mã OTP không hợp lệ hoặc đã hết hạn." });
    }

        user.email = user.emailChangeNew;
        user.emailChangeOtp = undefined;
    user.emailChangeNew = undefined;
    user.emailChangeExpires = undefined;

        await user.save();

    res.json({ message: "Đổi email thành công.", newEmail: user.email });
  } catch (error) {
    res.status(500).json({ message: "Lỗi xác thực OTP", error: error.message });
  }
};

export const updateAvatar = async (req, res) => {
  try {
    const userId = req.user.userId;

    if (!req.file || !req.file.path) {
      return res.status(400).json({ message: "Không có file nào được chọn." });
    }

    const avatarUrl = req.file.path; // URL Cloudinary
    
    const updatedUser = await User.findByIdAndUpdate(
      userId,
      { avatar: avatarUrl },
      { new: true }
    );

    if (!updatedUser) {
        return res.status(404).json({ message: "Không tìm thấy người dùng."});
    }

    res.status(200).json({
      success: true,
      message: "Cập nhật avatar thành công",
      avatar: updatedUser.avatar,
    });

  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};

