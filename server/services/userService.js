import { User, Employee, Customer } from "../models/index.js";
import bcrypt from "bcrypt";
import { sendVerificationEmail } from "../utils/sendEmails.js";

export const viewProfileService = async (userId) => {
    let profile = await Employee.findOne({ user_id: userId })
        .populate("user_id", "email system_role avatar");

    if (!profile) {
        profile = await User.findById(userId).select("email system_role avatar");
    }

    if (!profile) {
        throw new Error("Không tìm thấy hồ sơ người dùng.");
    }

    return profile;
};

export const updateProfileService = async (userId, data) => {
    const { phone, dob } = data;

    const user = await User.findById(userId).select("system_role");
    if (!user) 
        throw new Error("Không tìm thấy người dùng.");

    let profileModel = null;

    if (user.system_role === "customer") 
        profileModel = Customer;
    if (["employee", "manager"].includes(user.system_role)) 
        profileModel = Employee;

    if (!profileModel) 
        throw new Error("Loại người dùng không hợp lệ.");

    const profile = await profileModel.findOne({ user_id: user._id });
    if (!profile) throw new Error("Không tìm thấy hồ sơ cá nhân.");

    if (phone) profile.phone_number = phone;
    if (dob) profile.date_birth = new Date(dob);

    await profile.save();

    return profile;
};

export const changePasswordService = async (userId, oldPassword, newPassword) => {
    const user = await User.findById(userId).select("+password");
    if (!user) 
        throw new Error("Không tìm thấy người dùng.");

    const isMatch = await bcrypt.compare(oldPassword, user.password);
    if (!isMatch) 
        throw new Error("Mật khẩu cũ không đúng.");

    const regex = /^(?=.*[A-Z])(?=.*[a-z])(?=.*\d)(?=.*[@$!%*#?&]).{8,}$/;
    if (!regex.test(newPassword)) {
        throw new Error("Mật khẩu mới phải có ít nhất 8 ký tự, gồm chữ hoa, thường, số và ký tự đặc biệt.");
    }

    const hashed = await bcrypt.hash(newPassword, 10);
    user.password = hashed;
    await user.save();
};

export const sendChangeEmailService = async (userId, newEmail) => {
    const user = await User.findById(userId);
    if (!user) throw new Error("Không tìm thấy người dùng.");

    const emailExists = await User.findOne({
        email: newEmail,
        _id: { $ne: user._id }
    });

    if (emailExists) throw new Error("Email đã được sử dụng.");

    const otp = (Math.floor(100000 + Math.random() * 900000)).toString();

    user.emailChangeOtp = otp;
    user.emailChangeNew = newEmail;
    user.emailChangeExpires = Date.now() + 10 * 60 * 1000;

    await user.save();
    await sendVerificationEmail(newEmail, otp);
};

export const verifyChangeEmailService = async (userId, otp) => {
    const user = await User.findById(userId);
    if (!user) throw new Error("Không tìm thấy người dùng.");

    if (
        !user.emailChangeOtp ||
        user.emailChangeOtp !== otp ||
        user.emailChangeExpires < Date.now()
    ) {
        throw new Error("Mã OTP không hợp lệ hoặc đã hết hạn.");
    }

    user.email = user.emailChangeNew;
    user.emailChangeOtp = undefined;
    user.emailChangeNew = undefined;
    user.emailChangeExpires = undefined;

    await user.save();

    return user.email;
};

export const updateAvatarService = async (userId, avatarUrl) => {
    if (!avatarUrl) 
        throw new Error("Không có file.");

    const updatedUser = await User.findByIdAndUpdate(
        userId,
        { avatar: avatarUrl },
        { new: true }
    );

    if (!updatedUser) throw new Error("Không tìm thấy người dùng.");

    return updatedUser.avatar;
};