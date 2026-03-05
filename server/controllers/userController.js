import {
    viewProfileService,
    updateProfileService,
    changePasswordService,
    sendChangeEmailService,
    verifyChangeEmailService,
    updateAvatarService
} from "../services/userService.js";

export const viewProfile = async (req, res) => {
    try {
        const userId = req.user.userId || req.user._id;
        const profile = await viewProfileService(userId);

        res.json({ message: "Lấy thông tin thành công.", data: profile });
    } catch (err) {
        res.status(400).json({ message: err.message });
    }
};


export const updateProfile = async (req, res) => {
    try {
        const userId = req.user.userId || req.user._id;
        const profile = await updateProfileService(userId, req.body);

        res.json({ message: "Cập nhật thành công.", data: profile });
    } catch (err) {
        res.status(400).json({ message: err.message });
    }
};


export const changePassword = async (req, res) => {
    try {
        await changePasswordService(
            req.user.userId,
            req.body.oldPassword,
            req.body.newPassword
        );

        res.json({ message: "Đổi mật khẩu thành công." });
    } catch (err) {
        res.status(400).json({ message: err.message });
    }
};


export const sendEmail = async (req, res) => {
    try {
        const userId = req.user.userId || req.user._id;
        await sendChangeEmailService(userId, req.body.newEmail);

        res.json({ message: "OTP đã gửi tới email mới." });
    } catch (err) {
        res.status(400).json({ message: err.message });
    }
};


export const verifyEmail = async (req, res) => {
    try {
        const userId = req.user.userId || req.user._id;
        const newEmail = await verifyChangeEmailService(userId, req.body.otp);

        res.json({ message: "Đổi email thành công.", newEmail });
    } catch (err) {
        res.status(400).json({ message: err.message });
    }
};


export const updateAvatar = async (req, res) => {
    try {
        const avatar = await updateAvatarService(
            req.user.userId,
            req.file?.path
        );

        res.json({
            success: true,
            message: "Cập nhật avatar thành công",
            avatar
        });
    } catch (err) {
        res.status(400).json({ message: err.message });
    }
};