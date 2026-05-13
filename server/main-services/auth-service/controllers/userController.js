import { container } from "../containers/container.js";

export class UserController {
    constructor () {
        this.userService = container.userService;
    }

    getAllUsers = async (req, res) => {
        try {
            const users = await this.userService.getAllUsers(req.query);
            return res.status(200).json({ message: "Get all users successfully.",
                counts: users.length, users });
        } catch (err) {
            return res.status(err.status || 400).json({ message: err.message });
        }
    };

    getUserById = async (req, res) => {
        try {
            const user = await this.userService.getUserById(req.params.id);
            return res.status(200).json({ message: "Get user information successfully.", user });
        } catch (err) {
            return res.status(err.status || 400).json({ message: err.message });
        }
    };

    getUserProfile = async (req, res) => {
        try {
            const userProfile = await this.userService.getUserProfile(req.params.id);
            return res.status(200).json({ message: "Get user profile's information successfully.", userProfile });
        } catch (err) {
            return res.status(err.status || 400).json({ message: err.message });
        }
    };

    changePassword = async (req, res) => {
        try {
            await this.userService.changePasswordService(
                req.user.userId,
                req.body.oldPassword,
                req.body.newPassword
            );

            return res.status(200).json({ message: "Đổi mật khẩu thành công." });
        } catch (err) {
            return res.status(err.status || 400).json({ message: err.message });
        }
    };


    sendEmail = async (req, res) => {
        try {
            const userId = req.user.userId || req.user._id;
            await this.userService.sendChangeEmailService(userId, req.body.newEmail);

            return res.status(200).json({ message: "OTP đã gửi tới email mới." });
        } catch (err) {
            return res.status(err.status || 400).json({ message: err.message });
        }
    };


    verifyEmail = async (req, res) => {
        try {
            const userId = req.user.userId || req.user._id;
            const newEmail = await this.userService.verifyChangeEmailService(userId, req.body.otp);

            return res.status(200).json({ message: "Đổi email thành công.", newEmail });
        } catch (err) {
            return res.status(err.status || 400).json({ message: err.message });
        }
    };

    updateAvatar = async (req, res) => {
        try {
            const avatar = await this.userService.updateAvatarService(
                req.user.userId,
                req.file?.path
            );

            return res.status(200).json({
                success: true,
                message: "Cập nhật avatar thành công",
                avatar
            });
        } catch (err) {
            return res.status(err.status || 400).json({ message: err.message });
        }
    };

    adminResetRole = async(req, res) => {
        try {
            // console.log("IM CALLED");
            // console.log("REQ BODY: ", req.body);
            await this.userService.setRole(req.body);
            return res.status(200).json({ message: "Admin reset role for user successfully."});
        } catch (error) {
            return res.status(error.status || 400).json({ message: error.message });
        }
    }
}