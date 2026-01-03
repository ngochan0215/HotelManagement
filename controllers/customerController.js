import bcrypt from "bcrypt";
import { User, Customer, PointsLog } from "../models/index.js";
import { sendVerificationEmail } from "../utils/sendEmails.js";
import mongoose from "mongoose";

const CCCD_REGEX = /^[0-9]{12}$/;
const PHONE_REGEX = /^(0|\+84)(3|5|7|8|9)[0-9]{8}$/;

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
            .select("-updated_at -created_at -__v")
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

export const updateCustomer = async (req, res) => {
    try {
        const { id } = req.params;
        const {
            email,
            full_name,
            date_birth,
            phone_number,
            nationality,
            CCCD,
        } = req.body;

        if (!mongoose.Types.ObjectId.isValid(id)) {
            return res.status(400).json({
                success: false,
                message: "ID khách hàng không hợp lệ.",
            });
        }

        const customer = await Customer.findById(id);
        if (!customer) {
            return res.status(404).json({
                success: false,
                message: "Không tìm thấy khách hàng.",
            });
        }

        if (email !== undefined) {
            const user = await User.findById(customer.user_id);
                if (!user) {
                    return res.status(404).json({
                    success: false,
                    message: "Không tìm thấy tài khoản tương ứng.",
                });
            }

            if (email !== user.email) {
                const existEmail = await User.findOne({ email });
                if (existEmail) {
                    return res.status(409).json({
                        success: false,
                        message: "Email đã tồn tại.",
                    });
                }
                user.email = email;
                await user.save();
            }
        }

        if (CCCD !== undefined) {
            if (!CCCD_REGEX.test(CCCD)) {
                return res.status(400).json({ success: false, message: "CCCD không hợp lệ (phải gồm 12 chữ số)." });
            }

            if (CCCD !== customer.CCCD) {
                const existCCCD = await Customer.findOne({ CCCD });
                if (existCCCD) {
                    return res.status(409).json({
                        success: false,
                        message: "CCCD đã tồn tại.",
                    });
                }
            }
        }

        if (phone_number !== undefined) {
            if (!PHONE_REGEX.test(phone_number)) {
                return res.status(400).json({
                    success: false,
                    message: "Số điện thoại không hợp lệ.",
                });
            }

            if (phone_number !== customer.phone_number) {
                const existPhone = await Customer.findOne({ phone_number });
                if (existPhone) {
                    return res.status(409).json({
                        success: false,
                        message: "Số điện thoại đã tồn tại.",
                    });
                }
            }
        }

        // cập nhật các field cho phép
        if (full_name !== undefined) customer.full_name = full_name;
        if (date_birth !== undefined) customer.date_birth = date_birth;
        if (phone_number !== undefined) customer.phone_number = phone_number;
        if (nationality !== undefined) customer.nationality = nationality;
        if (CCCD !== undefined) customer.CCCD = CCCD;

        await customer.save();

        return res.status(200).json({
            success: true,
            message: "Cập nhật thông tin khách hàng thành công.",
            data: customer,
        });
    } catch (error) {
        return res.status(500).json({
            success: false,
            message: error.message,
        });
    }
};

export const banCustomer = async (req, res) => {
    const session = await mongoose.startSession();
    session.startTransaction();

    try {
        const { id } = req.params; // customer _id

        if (!mongoose.Types.ObjectId.isValid(id)) {
            return res.status(400).json({
                success: false,
                message: "ID khách hàng không hợp lệ.",
            });
        }

        const customer = await Customer.findById(id).session(session);
        if (!customer) {
            return res.status(404).json({
                success: false,
                message: "Không tìm thấy khách hàng.",
            });
        }

        if (customer.status === "inactive") {
            return res.status(400).json({
                success: false,
                message: "Tài khoản đã bị vô hiệu hóa trước đó.",
            });
        }

        // cập nhật customer
        customer.status = "inactive";
        await customer.save({ session });

        // cập nhật user liên kết
        const user = await User.findByIdAndUpdate(
            customer.user_id,
            { emailVerified: false },
            { new: true, session }
        );

        if (!user) {
            throw new Error("Không tìm thấy user liên kết với customer.");
        }

        await session.commitTransaction();
        session.endSession();

        return res.status(200).json({
            success: true,
            message: "Đã vô hiệu hóa tài khoản khách hàng.",
        });
    } catch (error) {
        await session.abortTransaction();
        session.endSession();

        return res.status(500).json({
            success: false,
            message: error.message,
        });
    }
};

export const updateCustomerPoints = async ({ customer_id, points, reason }) => {
  if (!mongoose.Types.ObjectId.isValid(customer_id)) {
    throw new Error("customer_id không hợp lệ");
  }

  if (!Number.isInteger(points) || points === 0) {
    throw new Error("points phải là số nguyên khác 0");
  }

  if (!reason || typeof reason !== "string") {
    throw new Error("reason là bắt buộc");
  }

  const customer = await Customer.findById(customer_id).session(session);
  if (!customer) {
    throw new Error("Không tìm thấy customer");
  }

  const before = customer.points || 0;
  const after = Math.max(before + points, 0); // không cho âm

  customer.points = after;
  await customer.save({ session });

  await PointsLog.create(
    {
        customer_id,
        points_change: points,
        points_before: before,
        points_after: after,
        reason,
      },
  );

  return { before, after, change: points };
};

export const calculateMembershipTier = ({ booking_count, points }) => {
  if (booking_count >= 20 && points >= 5000) return "platinum";
  if (booking_count >= 10 && points >= 2000) return "gold";
  if (booking_count >= 5 && points >= 500) return "silver";
  return "bronze";
};

export const updateCustomerTier = async (customer_id, session = null) => {
  const customer = await Customer.findById(customer_id).session(session);
  if (!customer) 
    throw new Error("Không tìm thấy khách hàng.");

  const newTier = calculateMembershipTier({
    booking_count: customer.booking_count || 0,
    points: customer.points || 10,
  });

  if (customer.loyalty !== newTier) {
    customer.loyalty = newTier;
    await customer.save({ session });
  }

  return newTier;
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