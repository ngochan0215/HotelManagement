import bcrypt from "bcrypt";
import { User, Customer } from "../models/index.js";

export const createAccount = async (req, res) => {
    try {
        const { email, password, date_birth } = req.body;

        if(!email || !password || !date_birth)
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

        const hashed = await bcrypt.hash(password, 10);
        const otp = Math.floor(100000 + Math.random() * 900000).toString();

        const user = await User.create({
            email,
            password: hashed,
            system_role: "customer",
            verifyEmailOtp: otp,
            verifyEmailOtpExpires: Date.now() + 5 * 60 * 1000,
        });

        await user.save();

        const customer = await Customer.create({ user_id: user._id, date_birth });
        customer.save();

        await sendVerificationEmail(email, otp);
        res.status(200).json({ message: "Vui lòng kiểm tra email để xác thực.", userId: user._id });

    } catch (error) {
        return res.status(500).json({ message: error.message });
    }
};

export const verifyEmail = async (req, res) => {
  try {
    const { otp } = req.body;
    const user = await User.findById(req.user._id).select("+password");
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

export const addCustomerInfo = async (req, res) => {
    try {
        const userId = req.userId;
        const { full_name, phone_number, nationality, CCCD } = req.body;

        const existedCustomer = await Customer.findOne({ user_id: userId });
        if (!existedCustomer) {
        return res.status(404).json({ message: "Chưa tồn tại tài khoản tương ứng." });
        }

        if (!full_name || !phone_number || !nationality || !CCCD)
            return res.staus(404).json({ message: "Vui lòng điền đầy đủ thông tin!"});

        const existedPhone = await Customer.findOne({ phone_number });
        if (existedPhone) {
            return res.status(400).json({ message: "Số điện thoại đã tồn tại" });
        }

        const existedCCCD = await Customer.findOne({ CCCD });
        if (existedCCCD) {
            return res.status(400).json({ message: "CCCD đã tồn tại" });
        }

        if (full_name) existedCustomer.full_name = full_name;
        if (phone_number) existedCustomer.phone_number = phone_number;
        if (nationality) existedCustomer.nationality = nationality;
        await existedCustomer.save();

        return res.status(200).json({
            message: "Thêm thông tin khách hàng thành công",
            customer: existedCustomer,
        });

    } catch (error) {
        return res.status(500).json({ message: error.message });
    }
}