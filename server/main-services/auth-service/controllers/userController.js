import { container } from "../containers/container.js";

export class UserController {
    constructor () {
        this.userService = container.userService;
    }

    getAllUsers = async (req, res) => {
        try {
            const users = await this.userService.getAllUsers(req.query);
            res.status(200).json({ message: "Get all users successfully.",
                counts: users.length, users });
        } catch (err) {
            res.status(err.status || 400).json({ message: err.message });
        }
    };

    getUserById = async (req, res) => {
        try {
            const user = await this.userService.getUserById(req.params.id);
            res.status(200).json({ message: "Get user information successfully.", user });
        } catch (err) {
            res.status(err.status || 400).json({ message: err.message });
        }
    };

    getUserProfile = async (req, res) => {
        try {
            const userProfile = await this.userService.getUserProfile(req.params.id);
            res.status(200).json({ message: "Get user profile's information successfully.", userProfile });
        } catch (err) {
            res.status(err.status || 400).json({ message: err.message });
        }
    };

    changePassword = async (req, res) => {
        try {
            await this.userService.changePasswordService(
                req.user.userId,
                req.body.oldPassword,
                req.body.newPassword
            );

            res.status(200).json({ message: "Đổi mật khẩu thành công." });
        } catch (err) {
            res.status(err.status || 400).json({ message: err.message });
        }
    };


    sendEmail = async (req, res) => {
        try {
            const userId = req.user.userId || req.user._id;
            await this.userService.sendChangeEmailService(userId, req.body.newEmail);

            res.status(200).json({ message: "OTP đã gửi tới email mới." });
        } catch (err) {
            res.status(err.status || 400).json({ message: err.message });
        }
    };


    verifyEmail = async (req, res) => {
        try {
            const userId = req.user.userId || req.user._id;
            const newEmail = await this.userService.verifyChangeEmailService(userId, req.body.otp);

            res.status(200).json({ message: "Đổi email thành công.", newEmail });
        } catch (err) {
            res.status(err.status || 400).json({ message: err.message });
        }
    };

    updateAvatar = async (req, res) => {
        try {
            const avatar = await this.userService.updateAvatarService(
                req.user.userId,
                req.file?.path
            );

            res.status(200).json({
                success: true,
                message: "Cập nhật avatar thành công",
                avatar
            });
        } catch (err) {
            res.status(err.status || 400).json({ message: err.message });
        }
    };

    adminResetRole = async(req, res) => {
        try {
            console.log("IM CALLED");
            console.log("REQ BODY: ", req.body);
            await this.userService.setRole(req.body);
            res.status(200).json({ message: "Admin reset role for user successfully."});
        } catch (error) {
            res.status(error.status || 400).json({ message: error.message });
        }
    }
}