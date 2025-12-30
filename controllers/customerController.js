import bcrypt from "bcrypt";
import { User, Customer } from "../models/index.js";
import { sendVerificationEmail } from "../utils/sendEmails.js";

export const createAccount = async (req, res) => {
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

export const getAllCustomers = async (req, res) => {
    try {
        const { loyalty, min_points, max_points, min_booking_count, max_booking_count, status } = req.query;
        let filter = {};

        if (loyalty) filter.loyalty = loyalty;
        if (status) filter.status = status;

        if (min_points || max_points) {
            filter.points = {};
            if (min_points) filter.points.$gte = Number(min_points);
            if (max_points) filter.points.$lte = Number(max_points);
        }

        if (min_booking_count || max_booking_count) {
            filter.booking_count = {};
            if (min_booking_count) filter.booking_count.$gte = Number(min_booking_count);
            if (max_booking_count) filter.booking_count.$lte = Number(max_booking_count);
        }

        const customers = await Customer.find(filter)
            .select("-_id, -updated_at -created_at -__v")
            .populate("user_id", "email system_role avatar");

        res.status(200).json({
            success: true,
            total: customers.length,
            customers
        });
    } catch (error) {
        res.status(500).json({ message: error.message });
    }
};

// export const addCustomerInfo = async (req, res) => {
//     try {
//         const userId = req.userId;
//         const { full_name, phone_number, nationality, CCCD } = req.body;

//         const existedCustomer = await Customer.findOne({ user_id: userId });
//         if (!existedCustomer) {
//         return res.status(404).json({ message: "Chưa tồn tại tài khoản tương ứng." });
//         }

//         if (!full_name || !phone_number || !nationality || !CCCD)
//             return res.staus(404).json({ message: "Vui lòng điền đầy đủ thông tin!"});

//         const existedPhone = await Customer.findOne({ phone_number });
//         if (existedPhone) {
//             return res.status(400).json({ message: "Số điện thoại đã tồn tại" });
//         }

//         const existedCCCD = await Customer.findOne({ CCCD });
//         if (existedCCCD) {
//             return res.status(400).json({ message: "CCCD đã tồn tại" });
//         }

//         if (full_name) existedCustomer.full_name = full_name;
//         if (phone_number) existedCustomer.phone_number = phone_number;
//         if (nationality) existedCustomer.nationality = nationality;
//         await existedCustomer.save();

//         return res.status(200).json({
//             message: "Thêm thông tin khách hàng thành công",
//             customer: existedCustomer,
//         });

//     } catch (error) {
//         return res.status(500).json({ message: error.message });
//     }
// }