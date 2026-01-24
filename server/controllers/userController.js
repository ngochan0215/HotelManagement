import { User, Employee, Customer } from "../models/index.js";
import bcrypt from "bcrypt";
import crypto from "crypto";
import { sendVerificationEmail } from "../utils/sendEmails.js";
import { defaultAvatars } from "../config/avatars.js";

export const viewProfile = async (req, res) => {
    try {
        const { userId, role } = req.user;
        console.log("User ID:", userId, "Role:", role);
        let profile;

        if (role === "customer") {
            profile = await Customer.findOne({ user_id: userId })
                .select("-__v -createdAt -updatedAt -updated_at -created_at")
                .populate("user_id", "email system_role avatar");
        } else if (role === "employee") {
            profile = await Employee.findOne({ user_id: userId })
                .select("-__v -createdAt -updatedAt -updated_at -created_at")
                .populate("user_id", "email system_role avatar");
        } else if (role === "manager") {
            profile = await User.findById(userId).select("email system_role avatar");
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
        const userId = req.user.userId;
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

        const profile = await profileModel.findOne({ user_id: user._id }).select("-__v -createdAt -updatedAt -updated_at -created_at");
        if (!profile) {
            return res.status(404).json({ message: "Không tìm thấy hồ sơ cá nhân." });
        }

        if (name) {
            if (typeof name !== "string" || !name.trim()) {
                return res.status(404).json({ message: "Tên không hợp lệ." });
            }
            profile.full_name = name;
        }

        if (phone) {
            if (!/^\d{9,11}$/.test(phone)) {
                return res.status(400).json({ message: "Số điện thoại không hợp lệ." });
            }
            const phoneExists = await profileModel.findOne({ phone_number: phone, _id: { $ne: profile._id }});
            if (phoneExists) {
                return res.status(400).json({ message: "Số điện thoại đã được sử dụng." });
            }
            profile.phone_number = phone;
        }

        if (cccd) {
            const cccdExists = await profileModel.findOne({ CCCD: cccd, _id: { $ne: profile._id }});
            if (cccdExists) {
                return res.status(400).json({ message: "Căn cước công dân đã được sử dụng." });
            }
            profile.CCCD = cccd;
        }

        if (dob) {
            const date = new Date(dob);
            if (isNaN(date.getTime())) {
                return res.status(400).json({ message: "Ngày sinh không hợp lệ." });
            }
            profile.date_birth = date;
        }

        if (nationality) {
            if (typeof nationality !== "string" || !nationality.trim()) {
                return res.status(400).json({ message: "Quốc tịch không hợp lệ." });
            }
            profile.nationality = nationality.trim();
        }

        // Chỉ cho phép employee cập nhật thông tin ngân hàng
        if (user.system_role === "employee") {
            // Validate và cập nhật BIN (6 số đầu của thẻ ngân hàng)
            if (BIN !== undefined) {
                if (BIN === null || BIN === "") {
                    // Cho phép xóa BIN (set null)
                    profile.BIN = null;
                } else {
                    const binStr = String(BIN).trim();
                    if (!/^\d{6}$/.test(binStr)) {
                        return res.status(400).json({ message: "BIN phải là 6 chữ số." });
                    }
                    profile.BIN = binStr;
                }
            }

            // Validate và cập nhật account_number (số tài khoản ngân hàng)
            if (account_number !== undefined) {
                if (account_number === null || account_number === "") {
                    // Cho phép xóa account_number (set null)
                    profile.account_number = null;
                } else {
                    const accountStr = String(account_number).trim();
                    // Số tài khoản thường từ 8-16 ký tự, có thể là số hoặc chữ số
                    if (!/^[0-9]{8,16}$/.test(accountStr)) {
                        return res.status(400).json({ message: "Số tài khoản phải là 8-16 chữ số." });
                    }
                    profile.account_number = accountStr;
                }
            }

            // Validate và cập nhật bank_shortName (mã ngân hàng)
            if (bank_shortName !== undefined) {
                if (bank_shortName === null || bank_shortName === "") {
                    // Cho phép xóa bank_shortName (set null)
                    profile.bank_shortName = null;
                } else {
                    if (typeof bank_shortName !== "string" || !bank_shortName.trim()) {
                        return res.status(400).json({ message: "Mã ngân hàng không hợp lệ." });
                    }
                    profile.bank_shortName = bank_shortName.trim();
                }
            }
        } else {
            // Nếu là customer và cố gắng cập nhật thông tin ngân hàng
            if (BIN !== undefined || account_number !== undefined || bank_shortName !== undefined) {
                return res.status(403).json({ message: "Chỉ nhân viên mới có thể cập nhật thông tin ngân hàng." });
            }
        }

        await profile.save();

        res.json({
            message: "Cập nhật thông tin thành công.",
            user: user,
            profile: profile
        });
    } catch (error) {
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

