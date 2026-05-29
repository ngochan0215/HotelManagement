import { container } from "../containers/container.js";

export class AuthController {
    constructor() {
        this.authService = container.authService;
    }

    register = async (req, res) => {
        try {
            const user = await this.authService.register(req.body);
            
            res.status(201).json({
                message: "Sign up successfully!",
                userID: user._id
            });

        } catch (err) {
            res.status(err.status || 400).json({ message: err.message });

        }
    };

    verifyEmail = async (req, res) => {
        try {
            const { userId, otp } = req.body;
            if (!userId || !otp)
                return res.status(400).json({ message: "Vui lòng cung cấp userId và otp." });

            await this.authService.verifyEmail(userId, otp);

            res.status(200).json({ message: "Verify email successfully!" });

        } catch (err) {
            res.status(err.status || 400).json({ message: err.message });
        }
    };

    login = async (req, res) => {
        try {
            const result = await this.authService.login(req.body.email, req.body.password);
            
            res.status(200).json({ message: "Login successfully!", ...result });
        
        } catch (err) {
            res.status(err.status || 400).json({ message: err.message });

        }
    };

    loginGoogle = async (req, res) => {
        try {
            const { googleToken } = req.body;

            const result = await this.authService.loginGoogle(googleToken);

            res.status(200).json({ message: "Login with google successfully!", ...result });

        } catch (err) {
            res.status(err.status || 400).json({ message: err.message });

        }
    };

    Logout = (req, res) => {
        res.json({ message: "Logout successfully!" });
    };

    forgotPassword = async (req, res) => {
        try {
            await this.authService.forgotPassword(req.body.email);
            
            res.status(200).json({ message: "Reset password email is sent!" });

        } catch (err) {
            res.status(err.status || 400).json({ message: err.message });

        }
    };

    resetPassword = async (req, res) => {
        try {
            const { email, otp, newPassword } = req.body;
            
            await this.authService.resetPassword(email, otp, newPassword);
            
            res.status(200).json({ message: "Reset password successfully!" });

        } catch (err) {
            res.status(err.status || 400).json({ message: err.message });

        }
    };

    createAccount = async (req, res) => {
        try {
            const user = await this.authService.createUserAccount(req.body);
            
            res.status(201).json({ message: "Create user account successfully.", user });

        } catch (err) {
            res.status(err.status || 400).json({ message: err.message });
        }
    };

    adminResetPassword = async(req, res) => {
        try {
            await this.authService.adminResetPassword(req.body);
            
            res.status(200).json({ message: "Admin reset password for employee successfully."});

        } catch (err) {
            res.status(err.status || 400).json({ message: err.message });
        }
    }

    deleteUser = async (req, res) => {
        await this.authService.deleteUser(req.params.id);
        res.json({ message: "Delete user successfully." });
    };
}
