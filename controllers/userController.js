import { User, Employee, Customer } from "../models/index.js";
import bcrypt from "bcrypt";
import crypto from "crypto";
import { sendVerificationEmail } from "../utils/sendEmails.js";
import { defaultAvatars } from "../config/avatars.js";

export const viewProfile = async (req, res) => {
    try {
        const { id, role } = req.user;

        let profile;

        if (role === "customer") {
            profile = await Customer.findOne({ user_id: id }).populate("user_id", "-password -__v -booking_count");
        } else if (role === "employee") {
            profile = await Employee.findOne({ user_id: id }).populate("user_id", "-password -__v");
        } else if (role === "admin") {
            profile = await User.findById(id).select("email system_role");
        }

        if (!profile) {
            return res.status(404).json({ message: "Không tìm thấy hồ sơ người dùng." });
        }

        res.json({ message: "Lấy thông tin hồ sơ thành công.", data: profile });
    } catch (err) {
        res.status(500).json({ message: "Lỗi server", error: err.message });
    }
};

export const updateProfile = async (req, res) => {
    try {
        const { name, phone, dob, nationality, avatar } = req.body;

        const user = await User.findById(req.user._id);
        if (!user) {
            return res.status(404).json({ message: "Không tìm thấy người dùng." });
        }

        if (avatar && !defaultAvatars.includes(avatar)) {
            return res.status(400).json({ message: "Avatar không hợp lệ." });
        }

        if (avatar) user.avatar = avatar;
        await user.save();

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
            return res.status(404).json({ message: "Không tìm thấy hồ sơ cá nhân." });
        }

        if (name) profile.full_name = name;
        if (phone) profile.phone_number = phone;
        if (dob) profile.date_birth = dob;
        if (nationality) profile.nationality = nationality;
        await profile.save();

        const updatedUser = await User.findById(user._id).select("-password -__v");
        const updatedProfile = await profileModel.findOne({ user_id: user._id });

        res.json({
            message: "Cập nhật thông tin thành công.",
            user: updatedUser,
            profile: updatedProfile
        });
    } catch (error) {
    res.status(500).json({ message: "Lỗi server", error: error.message });
    }
};

export const changePassword = async (req, res) => {
    try {
        const { oldPassword, newPassword } = req.body;
        const user = await User.findById(req.user._id).select("+password");
        if(!user){
            return res.status(404).json({ message: "Không tìm thấy người dùng." });
        }

        const isMatch = await bcrypt.compare(oldPassword, user.password);
        if(!isMatch) {
            return res.status(400).json({ message: "Mật khẩu cũ không đúng." });
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
        const { newEmail } = req.body;
        const user = await User.findById(req.user._id).select("+password");
        if(!user){
            return res.status(404).json({ message: "Không tìm thấy người dùng." });
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
    const { otp } = req.body;
    const user = await User.findById(req.user._id).select("+password");
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
    const userId = req.user._id;

    if (!req.file || !req.file.path) {
      return res.status(400).json({ message: "Không có file nào được chọn." });
    }

    const avatarUrl = req.file.path; // URL Cloudinary

    const updatedUser = await User.findByIdAndUpdate(
      userId,
      { avatar: avatarUrl },
      { new: true }
    );

    res.status(200).json({
      success: true,
      message: "Cập nhật avatar thành công",
      avatar: updatedUser.avatar,
    });

  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};

