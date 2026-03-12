import mongoose from "mongoose";

const CCCD_REGEX = /^[0-9]{12}$/;
const PHONE_REGEX = /^(0|\+84)(3|5|7|8|9)[0-9]{8}$/;

export class CustomerService {
    constructor({ Customer, PointsLog, userClient }) {
        this.Customer = Customer;
        this.PointsLog = PointsLog;
        this.userClient = userClient;
    }

    getAllCustomers = async (query = {}) => {
        try {
            const { loyalty, min_points, max_points, min_booking_count, max_booking_count, status } = query;
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

            const customers = await this.Customer.find(filter).select("-updated_at -created_at -__v")
            for (const customer of customers) {
                const user = await this.userClient.getUserById(customer.user_id);
                customer.user = {
                    email: user.email,
                    system_role: user.system_role,
                    avatar: user.avatar,
                    isBanned: user.isBanned
                };
            }

            return { total: customers.length, customers };
        } catch (error) {
            console.log("Error fetching customers:", error);
            throw error;
        }
    };

    updateCustomer = async (id, updateData) => {
        try {
            const {
                email,
                full_name,
                date_birth,
                phone_number,
                nationality,
                CCCD,
            } = updateData;

            if (!mongoose.Types.ObjectId.isValid(id)) {
                throw new Error("ID khách hàng không hợp lệ.");
            }

            const customer = await this.Customer.findById(id);
            if (!customer) {
                throw new Error("Không tìm thấy khách hàng.");
            }

            if (email !== undefined) {
                const user = await this.userClient.getUserById(customer.user_id);
                    if (!user) {
                        throw new Error("Không tìm thấy tài khoản tương ứng.");
                    }

                if (email !== user.email) {
                    const existEmail = await this.userClient.getUserByEmail(email);
                    if (existEmail) {
                        throw new Error("Email đã tồn tại.");
                    }
                    user.email = email;
                    await user.save();
                }
            }

            if (CCCD !== undefined) {
                if (!CCCD_REGEX.test(CCCD)) {
                    throw new Error("CCCD không hợp lệ (phải gồm 12 chữ số).");
                }

                if (CCCD !== customer.CCCD) {
                    const existCCCD = await this.Customer.findOne({ CCCD });
                    if (existCCCD) {
                        throw new Error("CCCD đã tồn tại.");
                    }
                }
            }

            if (phone_number !== undefined) {
                if (!PHONE_REGEX.test(phone_number)) {
                    throw new Error("Số điện thoại không hợp lệ.");
                }

                if (phone_number !== customer.phone_number) {
                    const existPhone = await this.Customer.findOne({ phone_number });
                    if (existPhone) {
                        throw new Error("Số điện thoại đã tồn tại.");
                    }
                }
            }

            if (full_name !== undefined) customer.full_name = full_name;
            if (date_birth !== undefined) customer.date_birth = date_birth;
            if (phone_number !== undefined) customer.phone_number = phone_number;
            if (nationality !== undefined) customer.nationality = nationality;
            if (CCCD !== undefined) customer.CCCD = CCCD;

            await customer.save();
            return customer;

        } catch (error) {
            console.log("Error updating customer:", error);
            throw error;
        }
    };

    banCustomer = async (id) => {
        const session = await mongoose.startSession();

        try {
            session.startTransaction();

            if (!mongoose.Types.ObjectId.isValid(id)) {
                throw new Error("ID khách hàng không hợp lệ.");
            }

            if (!mongoose.Types.ObjectId.isValid(id)) {
                throw new Error("ID khách hàng không hợp lệ.");
            }

            const customer = await this.Customer.findById(id).session(session);
            if (!customer) {
                throw new Error("Không tìm thấy khách hàng.");
            }

            if (customer.status === "banned") {
                throw new Error("Tài khoản đã bị vô hiệu hóa trước đó.");
            }

            if (customer.status === "inactive") {
                throw new Error("Tài khoản này đã ngừng hoạt động.");
            }

            if (customer.status === "inactive") {
                throw new Error("Tài khoản này đã ngừng hoạt động.");
            }

            // cập nhật customer
            customer.status = "banned";
            await customer.save({ session });

            // cập nhật user liên kết
            const user = await this.userClient.updateUser(
                customer.user_id,
                { isBanned: true }
            );

            if (!user) {
                throw new Error("Không tìm thấy user liên kết với customer.");
            }

            await session.commitTransaction();
            session.endSession();

            return { success: true };
        } catch (error) {
            await session.abortTransaction();
            session.endSession();
            throw error;
        }
    };

    unbanCustomer = async (id) => {
        const session = await mongoose.startSession();

        try {
            session.startTransaction();

            if (!mongoose.Types.ObjectId.isValid(id)) {
                throw new Error("ID khách hàng không hợp lệ.");
            }

            const customer = await this.Customer.findById(id).session(session);
            if (!customer) {
                throw new Error("Không tìm thấy khách hàng.");
            }

            if (customer.status === "active") {
                throw new Error("Tài khoản đang hoạt động, không cần mở khóa.");
            }

            if (customer.status === "inactive") {
                throw new Error("Tài khoản này đã ngừng hoạt động.");
            }

            // cập nhật customer
            customer.status = "active";
            await customer.save({ session });

            // cập nhật user liên kết
            const user = await this.userClient.updateUser(
                customer.user_id,
                { isBanned: false }
            );

            if (!user) {
                throw new Error("Không tìm thấy user liên kết với customer.");
            }

            await session.commitTransaction();
            session.endSession();

            return { success: true };

        } catch (error) {
            await session.abortTransaction();
            session.endSession();
            throw error;
        }
    };

    updateCustomerPoints = async ({ customer_id, points, reason }) => {
        if (!mongoose.Types.ObjectId.isValid(customer_id)) {
            throw new Error("customer_id không hợp lệ");
        }

        if (!Number.isInteger(points) || points === 0) {
            throw new Error("points phải là số nguyên khác 0");
        }

        if (!reason || typeof reason !== "string") {
            throw new Error("reason là bắt buộc");
        }

        const customer = await this.Customer.findById(customer_id);
        if (!customer) {
            throw new Error("Không tìm thấy customer");
        }

        const before = customer.points;
        //   if (before <= -points && points < 0) {
        //     return { before, after: 0, change: points };
        //   }
        const after = Math.max(before + points, 0); // không cho âm

        customer.points = after;
        await customer.save();

        await this.PointsLog.create(
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

    calculateMembershipTier = ({ booking_count, points }) => {
        if (booking_count >= 20 && points >= 5000) return "platinum";
        if (booking_count >= 10 && points >= 2000) return "gold";
        if (booking_count >= 5 && points >= 500) return "silver";
        return "bronze";
    };

    updateCustomerTier = async (customer_id, session = null) => {
        const customer = await this.Customer.findById(customer_id).session(session);
        if (!customer) 
            throw new Error("Không tìm thấy khách hàng.");

        const newTier = this.calculateMembershipTier({
            booking_count: customer.booking_count || 0,
            points: customer.points || 10,
        });

        if (customer.loyalty !== newTier) {
            customer.loyalty = newTier;
            await customer.save({ session });
        }

        return newTier;
    };

    async findCustomerByPhone (phone_number) {
        return this.Customer.findOne({ phone_number });
    }

    async findCustomerByCCCD (CCCD) {
        return this.Customer.findOne({ CCCD });
    }

    async getCustomerById (user_id) {
        return this.Customer.findOne({ user_id });
    }

    async createCustomer(data) {
        const { userId, customer } = data;

        await this.Customer.create({
            user_id: userId,
            ...customer
        });
    }

}