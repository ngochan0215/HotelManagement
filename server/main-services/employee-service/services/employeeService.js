import bcrypt from "bcrypt";
import { USER_EVENTS } from "../../../shared/events/userEvents.js";
import { cache, makeCacheKey } from "../../../shared/utils/cache.js";

const CCCD_REGEX = /^[0-9]{12}$/;
const PHONE_REGEX = /^(0|\+84)(3|5|7|8|9)[0-9]{8}$/;

export class EmployeeService {
    constructor({ Employee, Attendance, Shift, Schedule, ScheduleContract, 
        EmployeeEarning, EmployeePayout, eventBus }) {
        this.Employee = Employee;
        this.Attendance = Attendance;
        this.Shift = Shift;
        this.Schedule = Schedule;
        this.ScheduleContract = ScheduleContract;
        this.EmployeeEarning = EmployeeEarning;
        this.EmployeePayout = EmployeePayout;
        this.eventBus = eventBus;
    }

    // create employee record after the user record is created
    async createEmployee(userId, employee) {
        //const { userId, employee } = data;
        try {
            // console.log("USERID IN EMPLOYEESERVICE: ", userId);
            // console.log("EMPLOYEE IN EMPLOYEESERVICE: ", employee);
            const existed = await this.Employee.findOne({ user_id: userId });
            if (existed)
                throw new Error("Đã tồn tại tài khoản nhân viên tương ứng cho người dùng.");

            const { phone_number, CCCD, position } = employee;

            const [existingPhone, existingCCCD] = await Promise.all([
                this.Employee.findOne({ phone_number }),
                this.Employee.findOne({ CCCD }),
            ]);
            if (existingPhone) {
                throw new Error("Số điện thoại đã tồn tại.");
            }
            if (existingCCCD) {
                throw new Error("Số căn cước công dân đã tồn tại.");
            }

            const validPositions = ["manager", "receptionist", "technician", "customer_service", "housekeeper", "accountant", "it"];
            if (!validPositions.includes(position))
                throw new Error("Chức vụ không hợp lệ.");

            const the_employee = await this.Employee.create({
                user_id: userId,
                ...employee
            });

            await Promise.all([
                cache.delByPattern("emp:list:*"),
                cache.del("emp:technicians"),
                cache.del("emp:housekeepers"),
            ]);
            return the_employee;

        } catch (error) {
            console.log("Create employee unsuccessfully with error: " + error.message);
            throw error;
        }
    }

    async getAllEmployees (query = {}){
        // const cacheKey = makeCacheKey("emp:list", query);
        // const cached = await cache.get(cacheKey);
        // if (cached) return cached;

        const { position, status, min_salary, max_salary, min_year, max_year } = query;

        const filter = {};

        if (position != null) filter.position = position;
        if (status != null) filter.status = status;

        if (min_salary || max_salary) {
            filter.fixed_salary = {};
            if (min_salary) filter.fixed_salary.$gte = Number(min_salary);
            if (max_salary) filter.fixed_salary.$lte = Number(max_salary);
        }

        if (min_year || max_year) {
            filter.working_year = {};
            if (min_year) filter.working_year.$gte = Number(min_year);
            if (max_year) filter.working_year.$lte = Number(max_year);
        }

        let employees = await this.Employee.find(filter)
            .select("-__v -created_at -updated_at -createdAt -updatedAt").lean();

        if (!employees.length) {
            //await cache.set(cacheKey, { count: 0, employees: [] }, 300);
            return { count: 0, employees: [] };
        }

        const userIds = employees.map(e => e.user_id).filter(Boolean);

        const reply = await this.eventBus.safeRequest(USER_EVENTS.GET_USERS_INFO, { userIds });
        if (!reply.success) {
            throw new Error(reply.message);
        }

        const userMap = new Map(
            reply.users.map(u => [u._id.toString(), u])
        );

        const result = employees.map(employee => {
            const user = employee.user_id ? userMap.get(employee.user_id.toString()) : null;
            return {
                ...employee,
                user: user
                    ? { email: user.email, system_role: user.system_role, avatar: user.avatar, isBanned: user.isBanned }
                    : null,
            };
        });

        const listResponse = { count: result.length, employees: result };
        //await cache.set(cacheKey, listResponse, 300);
        return listResponse;
    };

    async getEmployeeById (employeeId) {
        // const cacheKey = `emp:one:${employeeId}`;
        // const cached = await cache.get(cacheKey);
        // if (cached) return cached;

        const employee = await this.Employee.findById(employeeId)
            .select("-__v -created_at -updated_at -createdAt -updatedAt");

        if (!employee) {
            throw new Error("Không tìm thấy nhân viên.");
        }

        //await cache.set(cacheKey, employee, 300);
        return employee;
    };

    async getEmployeeByUserId (employeeUserId) {
        // const cacheKey = `emp:user:${employeeUserId}`;
        // const cached = await cache.get(cacheKey);
        // if (cached) return cached;

        const employee = await this.Employee.findOne({ user_id: employeeUserId })
            .select("-__v -created_at -updated_at -createdAt -updatedAt");

        if (!employee) {
            throw new Error("Không tìm thấy nhân viên.");
        }

        //await cache.set(cacheKey, employee, 300);
        return employee;
    };

    async getEmployeesByUserIds (employeeUserIds) {
        try {
                return await this.Employee.find(
                { user_id: { $in: employeeUserIds } }
            ).select("-__v -created_at -updated_at -createdAt -updatedAt").lean();

        } catch (error) {
            console.log("Error in getting employees by user ids: ", error.message);
            throw error; 
        }
    };

    async getEmployeesByIds (employeeIds) {
        try {
            return await this.Employee.find(
                { _id: { $in: employeeIds } }
            ).select("-__v -created_at -updated_at -createdAt -updatedAt").lean();

        } catch (error) {
            console.log("Error in getting employees by ids: ", error.message);
            throw error; 
        }
    };

    async updateEmployee (employeeId, updateData) {
        const { email, full_name, date_birth, status, 
            position, fixed_salary, phone_number, CCCD } = updateData;

        const employee = await this.Employee.findById(employeeId)
            .select("-__v -created_at -updated_at -createdAt -updatedAt");
        if (!employee) {
            throw new Error("Không tìm thấy nhân viên.");
        }

        const valid_status = ["resign", "working"];
        if (status) {
            if (!valid_status.includes(status))
                throw new Error(`Trạng thái không hợp lệ. Giá trị cho phép: ${valid_status.join(", ")}`);

            employee.status = status;
        }

        const valid_positions = ["manager", "receptionist", "housekeeper", "technician", "customer_service"];
        if (position) {
            if (!valid_positions.includes(position))
                throw new Error(`Vị trí không hợp lệ. Giá trị cho phép: ${valid_positions.join(", ")}`);

            employee.position = position;
        }

        if (email !== undefined) {
            let user = null;

            const reply = await this.eventBus.safeRequest(USER_EVENTS.GET_USER_INFO, { userId: employee.user_id });
            if (reply.found) {
                user = reply.user;
            } else {
                throw new Error(reply.message);
            }

            if (email !== user.email) {
                const reply = await this.eventBus.safeRequest(USER_EVENTS.CHECK_EXISTED_EMAIL, { email });
                if (reply.found) {
                    throw new Error("Email đã tồn tại.");
                }
            }

            const replyUpdate = await this.eventBus.safeRequest(
                USER_EVENTS.UPDATE_USER, 
                { 
                    userId: employee.user_id, 
                    payload: { email } 
                }
            );
            if (!replyUpdate.success) {
                throw new Error(reply.message);
            }
        }

        if (CCCD !== undefined) {
            if (!CCCD_REGEX.test(CCCD)) {
                throw new Error("CCCD không hợp lệ (phải gồm 12 chữ số).");
            }

            if (CCCD !== employee.CCCD) {
                const existCCCD = await this.Employee.findOne({ CCCD });
                if (existCCCD) {
                    throw new Error("CCCD đã tồn tại.");
                }
            }
        }

        if (phone_number !== undefined) {
            if (!PHONE_REGEX.test(phone_number)) {
                throw new Error("Số điện thoại không hợp lệ.");
            }

            if (phone_number !== employee.phone_number) {
                const existPhone = await this.Employee.findOne({ phone_number });
                if (existPhone) {
                    throw new Error("Số điện thoại đã tồn tại.");
                }
            }
        }

        if (full_name !== undefined) employee.full_name = full_name;
        if (date_birth !== undefined) employee.date_birth = date_birth;
        if (phone_number !== undefined) employee.phone_number = phone_number;
        if (CCCD !== undefined) employee.CCCD = CCCD;
        if (fixed_salary) employee.fixed_salary = fixed_salary;

        await employee.save();
        // await Promise.all([
        //     cache.del(`emp:one:${employeeId}`),
        //     cache.del(`emp:user:${employee.user_id}`),
        //     cache.del(`emp:profile:${employee.user_id}`),
        //     cache.del("emp:technicians"),
        //     cache.del("emp:housekeepers"),
        //     cache.delByPattern("emp:list:*"),
        // ]);
        return employee;
    };

    async createAccountForExistingEmployee (employeeId, data) {
        const { email, password } = data;

        const employee = await this.Employee.findById(employeeId);
        if (!employee) {
            throw new Error("Không tìm thấy nhân viên.");
        }
        if (employee.user_id) {
            throw new Error("Nhân viên này đã có tài khoản rồi.");
        }

        const system_role = "employee";
        try {
            const reply = await this.eventBus.safeRequest(
                USER_EVENTS.CREATE_ACCOUNT,
                {
                    email, password, system_role
                }
            );
            if (!reply || !reply.success) {
                throw new Error(reply.message);
            }

            employee.user_id = reply.user._id;
            await employee.save();
            await Promise.all([
                cache.del(`emp:one:${employeeId}`),
                cache.del(`emp:user:${employee.user_id}`),
                cache.del(`emp:profile:${employee.user_id}`),
                cache.delByPattern("emp:list:*"),
            ]);
            return reply.user;

        } catch (error) {
            const message = error.response?.data?.message || error.message;
            const status = error.response?.status || 500;
            const err = new Error(message);
            err.status = status;

            throw err;
        }
    };

    async resetPasswordForEmployee (employeeId, newPassword) {
        try {
            const employee = await this.Employee.findById(employeeId);
            if (!employee) 
                throw new Error("Không tìm thấy nhân viên.");

            if (!employee.user_id) {
                throw new Error("Nhân viên chưa có tài khoản.");
            }

            const hashedPassword = await bcrypt.hash(newPassword, 10);

            const reply = await this.eventBus.safeRequest(
                USER_EVENTS.RESET_PASSWORD,
                {
                    userId: employee.user_id,
                    newPassword: hashedPassword
                }
            );
            if (!reply || !reply.success) {
                throw new Error(reply.message);
            }

            return { success: true };

        } catch (error) {
            const message = error.response?.data?.message || error.message;
            const status = error.response?.status || 500;
            const err = new Error(message);
            err.status = status;
            throw err;
        }
    };

    async getAvailableTechnicians () {
        try {
            // const cached = await cache.get("emp:technicians");
            // if (cached) return cached;

            // // Tìm tất cả nhân viên kỹ thuật
            // const technicians = await Employee.find({ 
            //     position: "technician",
            //     status: "working"
            // })
            // .populate("user_id", "email system_role avatar")
            // .select("full_name phone_number user_id");
    
            // // Tìm các phiếu đang xử lý (pending hoặc waiting_confirm)
            // const activeTickets = await EquipmentInstall.find({
            //     handled_by: { $exists: true, $ne: null },
            //     status: { $in: ["pending", "assigned", "waiting_confirm"] }
            // }).select("handled_by");
    
            // // Lấy danh sách employee_id đang bận
            // const busyEmployeeIds = new Set(
            //     activeTickets.map(ticket => ticket.handled_by?.toString()).filter(Boolean)
            // );
    
            // // Lọc ra những nhân viên rảnh
            // const availableTechnicians = technicians
            //     .filter(tech => {
            //         const employeeId = tech._id.toString();
            //         return !busyEmployeeIds.has(employeeId);
            //     })
            //     .map(tech => ({
            //         _id: tech._id,
            //         employee_id: tech._id,
            //         full_name: tech.full_name,
            //         phone_number: tech.phone_number,
            //         user_id: tech.user_id
            //     }));
    
            // res.status(200).json({
            //     success: true,
            //     count: availableTechnicians.length,
            //     technicians: availableTechnicians
            // });
            
            const technicians = await this.Employee.find({ position: "technician", status: "working" })
                //.populate("user_id", "email system_role avatar")
                .select("full_name phone_number user_id");
    
            const result = technicians.map(tech => ({
                _id: tech._id,
                employee_id: tech._id,
                full_name: tech.full_name,
                phone_number: tech.phone_number,
                user_id: tech.user_id
            }));

            const techResponse = { count: result.length, technicians: result };
            //await cache.set("emp:technicians", techResponse, 60);
            return techResponse;

        } catch (error) {
            console.log("Error in getting available techinicians: ", error.message);
            throw error; 
        }
    };

    async getAvailableHousekeepers () {
        try {
            const cached = await cache.get("emp:housekeepers");
            if (cached) return cached;

            const housekeepers = await this.Employee.find({
                position: "housekeeper",
                status: "working"
            }).select("-created_at -updated_at -__v");

            await cache.set("emp:housekeepers", housekeepers, 60);
            return housekeepers;
    
        } catch (error) {
            console.log("Error in getting available housekeepers: ", error.message);
            throw error; 
        }
    };

    async checkIfTechnicianIsAvailable (employeeId) {
        try {
            const technicians =  await this.Employee.findOne({
                _id: employeeId,
                position: "technician",
                status: "working"
            });
            return technicians;
        } catch (error) {
            console.log("Error in checking if technician is available: ", error.message);
            throw error;
        }
    }

    async toggleBanUser (employeeId, isBanned) {
        const employee = await this.Employee.findById(employeeId);
        if (!employee || !employee.user_id) {
            throw new Error("Nhân viên chưa có tài khoản.");
        }

        const reply = await this.eventBus.safeRequest(
            USER_EVENTS.UPDATE_USER,
            {
                userId: employee.user_id,
                payload: {
                    isBanned: isBanned,
                    status: isBanned ? "banned" : "active"
                }
            }
        );

        if (!reply || !reply.success) {
            throw new Error(reply.message);
        }

        await Promise.all([
            cache.del(`emp:one:${employeeId}`),
            cache.del(`emp:user:${employee.user_id}`),
            cache.del(`emp:profile:${employee.user_id}`),
            cache.del("emp:technicians"),
            cache.del("emp:housekeepers"),
            cache.delByPattern("emp:list:*"),
        ]);
        return { success: true };
    };

    async updateMyProfile (userId, updateData) {
        const { phone_number, date_birth, bank_shortName, account_number } = updateData;

        const employee = await this.Employee.findOne({ user_id: userId })
            .select("-__v -created_at -updated_at -createdAt -updatedAt");
        if (!employee) {
            throw new Error("Không tìm thấy hồ sơ nhân viên.");
        }

        if (phone_number !== undefined) {
            if (!PHONE_REGEX.test(phone_number)) {
                throw new Error("Số điện thoại không hợp lệ.");
            }
            if (phone_number !== employee.phone_number) {
                const existPhone = await this.Employee.findOne({ phone_number });
                if (existPhone) {
                    throw new Error("Số điện thoại đã tồn tại.");
                }
            }
            employee.phone_number = phone_number;
        }

        if (date_birth !== undefined) employee.date_birth = date_birth;
        if (bank_shortName !== undefined) employee.bank_shortName = bank_shortName;
        if (account_number !== undefined) employee.account_number = account_number;

        await employee.save();
        await Promise.all([
            cache.del(`emp:one:${employee._id}`),
            cache.del(`emp:user:${userId}`),
            cache.del(`emp:profile:${userId}`),
            cache.delByPattern("emp:list:*"),
        ]);
        return employee;
    };

    async getMyProfile (userId) {
        const cacheKey = `emp:profile:${userId}`;
        const cached = await cache.get(cacheKey);
        if (cached) return cached;

        const [employee, reply] = await Promise.all([
            this.Employee.findOne({ user_id: userId })
                .select("-createdAt -updatedAt -created_at -updated_at -__v")
                .lean(),
            this.eventBus.safeRequest(USER_EVENTS.GET_USER_INFO, { userId }),
        ]);

        if (!employee) {
            throw new Error("Không tìm thấy hồ sơ nhân viên.");
        }
        if (!reply.success) {
            throw new Error(reply.message);
        }

        const user_info = {
            email: reply.user.email,
            system_role: reply.user.system_role,
            avatar: reply.user.avatar,
            isBanned: reply.user.isBanned,
        };

        const profile = { ...employee, user_info };
        await cache.set(cacheKey, profile, 300);
        return profile;
    };

    // helper
    timeToMinutes = (timeStr) => {
        const [hours, minutes] = timeStr.split(":").map(Number);
        return hours * 60 + minutes;
    };

    isNightShift = (beginTime, endTime) => {
        return this.timeToMinutes(endTime) < this.timeToMinutes(beginTime);
    };

    getEffectiveMinutes = (minutes, isNight, beginMinutes) => {
        if (isNight && minutes < beginMinutes) return minutes + 1440;
        return minutes;
    };
    
    calculatePenalty = (minutes, hourlyRate, penaltyRate = 1.5) => {
        return Number(((minutes * (hourlyRate / 60)) * penaltyRate).toFixed(0));
    };

    getPeriodDate = (date) => {
        const d = new Date(date);
        return new Date(Date.UTC(d.getUTCFullYear(), d.getUTCMonth(), 1));
    };


    PENALTY_CONFIG = {
        rate:                   1.5,  // 1.5x lương/phút bị trừ
        late_threshold_minutes: 5,    // dưới 5 phút không bị tính trễ
        auto_link_window:       15,   // ca tiếp theo trong 15 phút → tự động check-in
    };

    TIME_WINDOW = {
        checkin_before:  30,  // check-in sớm nhất 30 phút trước giờ bắt đầu
        checkin_after:   60,  // check-in trễ nhất 60 phút sau giờ bắt đầu
        checkout_before: 30,  // check-out sớm nhất 30 phút trước giờ kết thúc
        checkout_after:  60,  // check-out trễ nhất 60 phút sau giờ kết thúc
    };

    // attendance tracking

    async createEarningFromAttendance (attendance, employee) {
        const hourlyRate = employee.fixed_salary;

        const baseEarning = Number(
            (attendance.work_hours * hourlyRate).toFixed(0)
        );

        // calculate penalty
        const latePenalty = attendance.late_minutes > this.PENALTY_CONFIG.late_threshold_minutes
            ? this.calculatePenalty(attendance.late_minutes, hourlyRate, this.PENALTY_CONFIG.rate)
            : 0;

        const earlyLeavePenalty = attendance.early_leave_minutes > 0
            ? this.calculatePenalty(attendance.early_leave_minutes, hourlyRate, this.PENALTY_CONFIG.rate)
            : 0;

        const totalDeduction = latePenalty + earlyLeavePenalty;
        const earningAmount  = Math.max(0, baseEarning - totalDeduction);

        const earning = await this.EmployeeEarning.create({
            employee_id:   employee._id,
            attendance_id: attendance._id,
            shift_id:      attendance.shift_id,
            work_date:     attendance.work_date,
            work_hours:    attendance.work_hours,
            hourly_rate:   hourlyRate,
            earning_amount: earningAmount,
            deductions: {
                late_penalty:        latePenalty,
                early_leave_penalty: earlyLeavePenalty,
                total:               totalDeduction,
            },
            status:       "available",
            period_date:  this.getPeriodDate(attendance.work_date),
            completed_at: new Date(),
            note: [
                attendance.late_minutes > this.PENALTY_CONFIG.late_threshold_minutes
                    ? `Đi trễ ${attendance.late_minutes} phút` : "",
                attendance.early_leave_minutes > 0
                    ? `Về sớm ${attendance.early_leave_minutes} phút` : "",
            ].filter(Boolean).join(", "),
        });

        return earning;
    };

    async checkInShift (employeeUserId, scheduleId = null) {
        try {
            const now = new Date();
            const today = new Date(now);
            today.setUTCHours(0, 0, 0, 0);

            const employee = await this.Employee.findOne({ user_id: employeeUserId });
            if (!employee) throw new Error("Không tìm thấy nhân viên.");
            const employee_id = employee._id;

            // find all approved schedules for today
            const schedules = await this.Schedule.find({
                employee_id: employee_id,
                work_date: today,
                status: "approved"
            }).populate("shift_id");

            if (!schedules.length)
                throw new Error("Không có lịch làm việc hôm nay");

            // find the most appropriate shift at current time
            const nowMinutes = now.getUTCHours() * 60 + now.getUTCMinutes();
            let schedule;
            if (scheduleId) {
                schedule = schedules.find(s => s._id.toString() === scheduleId.toString());
                
                if (!schedule) 
                    throw new Error("Không tìm thấy ca làm.");

                if (schedule.employee_id.toString() !== employee_id.toString())
                    throw new Error("Bạn không có quyền check-in ca làm này.");

            } else {
                const candidates = schedules.filter(s => {
                    if (s.employee_id.toString() !== employee_id.toString()) return false;

                    const shift        = s.shift_id;
                    const beginMinutes = this.timeToMinutes(shift.begin_time);
                    const endMinutes   = this.timeToMinutes(shift.end_time);
                    const night        = this.isNightShift(shift.begin_time, shift.end_time);
                    const effectiveNow = this.getEffectiveMinutes(nowMinutes, night, beginMinutes);
                    const effectiveEnd = night ? endMinutes + 1440 : endMinutes;

                    const windowStart = beginMinutes - this.TIME_WINDOW.checkin_before;
                    const windowEnd   = beginMinutes + this.TIME_WINDOW.checkin_after;

                    return effectiveNow >= windowStart && effectiveNow <= windowEnd;
                });

                if (!candidates.length) {
                    const upcoming = schedules.map(s => s.shift_id.begin_time).join(", ");
                    throw new Error(
                        `Không trong giờ check-in. Ca làm hôm nay bắt đầu lúc: ${upcoming}. ` +
                        `Chỉ được check-in trong vòng ${this.TIME_WINDOW.checkin_before} phút trước giờ bắt đầu.`
                    );
                }

                schedule = candidates.reduce((closest, s) => {
                    const beginA = this.timeToMinutes(s.shift_id.begin_time);
                    const beginB = this.timeToMinutes(closest.shift_id.begin_time);
                    return Math.abs(nowMinutes - beginA) < Math.abs(nowMinutes - beginB) ? s : closest;
                });
            }

            const shift = schedule.shift_id;

            // Check already checked in
            const existing = await this.Attendance.findOne({
                employee_id,
                schedule_id: schedule._id,
            });
            if (existing?.check_in) 
                throw new Error("Bạn đã check-in ca làm này rồi.");
        
            if (existing && existing.employee_id.toString() !== employee_id.toString())
                throw new Error("Ca làm này đã được check-in bởi nhân viên khác.");

            // Calculate late
            const beginMinutes = this.timeToMinutes(shift.begin_time);
            const night        = this.isNightShift(shift.begin_time, shift.end_time);
            const effectiveNow = this.getEffectiveMinutes(nowMinutes, night, beginMinutes);

            const lateMinutes = Math.max(0, effectiveNow - beginMinutes);
            const status      = lateMinutes > this.PENALTY_CONFIG.late_threshold_minutes
                ? "late"
                : "present";

            const attendance = await this.Attendance.create({
                employee_id,
                schedule_id: schedule._id,
                shift_id:    shift._id,
                work_date:   today,
                check_in:    now,
                status,
                late_minutes: lateMinutes,
            });

            return attendance;

        } catch (err) {
            console.error("Error in check-in shift: ", err.message);
            throw err;
        }
    };

    async checkOutShift (employeeUserId) {
        try {
            const now = new Date();
            const today = new Date(now);
            today.setUTCHours(0, 0, 0, 0);

            const employee = await this.Employee.findOne({ user_id: employeeUserId });
            if (!employee) throw new Error("Không tìm thấy nhân viên.");
            const employee_id = employee._id;

            // find attendance that has check_in but no check_out
            const attendance = await this.Attendance.findOne({
                employee_id,
                work_date: today,
                check_in:  { $ne: null },
                check_out: null,
            }).populate({
                path: "schedule_id",
                populate: { path: "shift_id" }
            });

            if (!attendance)
                throw new Error("Không tìm thấy ca làm đang hoạt động để check-out.");

            if (attendance.schedule_id.employee_id.toString() !== employee_id.toString())
                throw new Error("Bạn không có quyền check-out ca làm này.");

            if (attendance.employee_id.toString() !== employee_id.toString())
                throw new Error("Bạn không có quyền check-out ca làm này.");

            if (now <= attendance.check_in)
                throw new Error("Thời gian check-out không hợp lệ.");

            const shift = attendance.schedule_id.shift_id;
            const nowMinutes = now.getUTCHours() * 60 + now.getUTCMinutes();
            const beginMinutes = this.timeToMinutes(shift.begin_time);
            const endMinutes = this.timeToMinutes(shift.end_time);
            const night = this.isNightShift(shift.begin_time, shift.end_time);

            // handle night shift for early-leave case 
            const effectiveEnd      = night ? endMinutes + 1440 : endMinutes;
            const effectiveCheckOut = this.getEffectiveMinutes(nowMinutes, night, beginMinutes);
            const earlyLeaveMinutes = Math.max(0, effectiveEnd - effectiveCheckOut);
            const workHours         = Number(
                ((now - attendance.check_in) / (1000 * 60 * 60)).toFixed(2)
            );

            const windowStart = effectiveEnd - this.TIME_WINDOW.checkout_before;
            const windowEnd   = effectiveEnd + this.TIME_WINDOW.checkout_after;

            if (effectiveCheckOut < windowStart) {
                const remaining = windowStart - effectiveCheckOut;
                throw new Error(
                    `Chưa đến giờ check-out. Ca kết thúc lúc ${shift.end_time}. ` +
                    `Còn ${remaining} phút nữa mới được check-out.`
                );
            }

            if (effectiveCheckOut > windowEnd) {
                throw new Error(
                    `Đã quá giờ check-out ${this.TIME_WINDOW.checkout_after} phút. ` +
                    `Vui lòng liên hệ quản lý để điều chỉnh thủ công.`
                );
            }

            attendance.check_out = now;
            attendance.status = earlyLeaveMinutes > 0 ? "early_leave" : "on_leave";
            attendance.early_leave_minutes = earlyLeaveMinutes;
            attendance.work_hours = Number(workHours.toFixed(2));

            await attendance.save();

            // create earning after checkout
            let earning = null;
            try {
                earning = await this.createEarningFromAttendance(attendance, employee);
            } catch (earningError) {
                console.error("Error creating earning:", earningError);
            }

             // auto-link: detect next consecutive shift
            let nextShift = null;
            try {
                const remainingSchedules = await this.Schedule.find({
                    employee_id,
                    work_date: today,
                    status: "approved",
                }).populate("shift_id");

                // Find a shift that starts within AUTO_LINK_WINDOW minutes
                const candidate = remainingSchedules.find(s => {
                    if (s.employee_id.toString() !== employee_id.toString()) return false;
                    if (s._id.toString() === attendance.schedule_id._id.toString()) return false;

                    const nextBegin = this.timeToMinutes(s.shift_id.begin_time);
                    const diff      = Math.abs(effectiveCheckOut - nextBegin);

                    // Not the shift we just checked out from
                    if (s._id.toString() === attendance.schedule_id._id.toString()) return false;

                    // Check not already attended
                    return diff <= this.PENALTY_CONFIG.auto_link_window;
                });

                if (candidate) {
                    // Auto check-in the next shift
                    const nextAttendance = await this.checkInShift(
                        employeeUserId,
                        candidate._id  // pass scheduleId directly to skip time detection
                    );
                    nextShift = {
                        schedule_id: candidate._id,
                        shift_type:  candidate.shift_id.shift_type,
                        begin_time:  candidate.shift_id.begin_time,
                        end_time:    candidate.shift_id.end_time,
                        attendance:  nextAttendance.attendance,
                    };
                }
            } catch (autoLinkError) {
                console.error("Error in auto-link:", autoLinkError);
            }

            return {
                attendance,
                earning,
                next_shift: nextShift,
            };

        } catch (err) {
            console.error("Error in check-out shift: ", err.message);
            throw err;
        }
    };

    // employee view their own earnings
    async getMyEarnings(employeeUserId, query = {}) {
        try {
            const { start_date, end_date, period_date, status } = query;

            const employee = await this.Employee.findOne({ user_id: employeeUserId });
            if (!employee) throw new Error("Không tìm thấy nhân viên.");
            const employee_id = employee._id;

            const filter = { employee_id };

            if (status) {
                const validStatuses = ["available", "pending", "paid"];
                if (!validStatuses.includes(status))
                    throw new Error("Status không hợp lệ.");
                filter.status = status;
            }

            if (period_date) {
                filter.period_date = new Date(period_date);
            } else if (start_date || end_date) {
                const startDate = start_date ? new Date(start_date) : null;
                const endDate   = end_date   ? new Date(end_date)   : null;

                if (startDate && isNaN(startDate.getTime()))
                    throw new Error("start_date không hợp lệ.");
                if (endDate && isNaN(endDate.getTime()))
                    throw new Error("end_date không hợp lệ.");
                if (startDate && endDate && startDate > endDate)
                    throw new Error("start_date phải trước end_date.");

                filter.work_date = {
                    ...(startDate && { $gte: startDate }),
                    ...(endDate   && { $lte: endDate }),
                };
            }

            const earnings = await this.EmployeeEarning.find(filter)
                .populate("shift_id", "shift_type begin_time end_time")
                .populate("attendance_id", "check_in check_out late_minutes early_leave_minutes status")
                .select("-__v -payout_id") 
                .sort({ work_date: -1 }); 

            if (!earnings.length) return {
                full_name:    employee.full_name,
                hourly_rate:  employee.fixed_salary,
                total_shifts: 0,
                summary:      { total_earned: 0, total_deductions: 0, total_gross: 0 },
                by_date:      {},
            };

            const by_date = earnings.reduce((acc, e) => {
                const dateKey = e.work_date.toISOString().split("T")[0];
                if (!acc[dateKey]) {
                    acc[dateKey] = {
                        work_date:        e.work_date,
                        total_earned:     0,
                        total_gross:      0,
                        total_deductions: 0,
                        shifts:           [],
                    };
                }

                acc[dateKey].total_gross      += e.work_hours * e.hourly_rate;
                acc[dateKey].total_deductions += e.deductions?.total ?? 0;
                acc[dateKey].total_earned     += e.earning_amount;
                acc[dateKey].shifts.push({
                    _id:            e._id,
                    shift_type:     e.shift_id?.shift_type,
                    begin_time:     e.shift_id?.begin_time,
                    end_time:       e.shift_id?.end_time,
                    work_hours:     e.work_hours,
                    earning_amount: e.earning_amount,
                    status:         e.status,
                    note:           e.note,

                    deductions: {
                        late_penalty:        e.deductions?.late_penalty ?? 0,
                        early_leave_penalty: e.deductions?.early_leave_penalty ?? 0,
                        total:               e.deductions?.total ?? 0,
                    },

                    attendance: e.attendance_id
                        ? {
                            check_in:            e.attendance_id.check_in,
                            check_out:           e.attendance_id.check_out,
                            late_minutes:        e.attendance_id.late_minutes,
                            early_leave_minutes: e.attendance_id.early_leave_minutes,
                            status:              e.attendance_id.status,
                        }
                        : null,
                });

                return acc;
            }, {});

            const summary = earnings.reduce((acc, e) => {
                acc.total_gross      += e.work_hours * e.hourly_rate;
                acc.total_deductions += e.deductions?.total ?? 0;
                acc.total_earned     += e.earning_amount;
                return acc;
            }, { total_gross: 0, total_deductions: 0, total_earned: 0 });

            return {
                full_name:    employee.full_name,
                hourly_rate:  employee.fixed_salary,
                total_shifts: earnings.length,
                summary: {
                    total_gross:      Number(summary.total_gross.toFixed(0)),
                    total_deductions: Number(summary.total_deductions.toFixed(0)),
                    total_earned:     Number(summary.total_earned.toFixed(0)),
                },
                by_date,
            };

        } catch (error) {
            console.error("Error in getMyEarnings:", error.message);
            throw error;
        }
    }

    // manager view earnings
    async getEmployeeEarningById(query = {}) {
        try {
            const { employee_id, start_date, end_date, period_date, status } = query;

            if (!employee_id)
                throw new Error("Vui lòng cung cấp employee_id.");

            if (!mongoose.Types.ObjectId.isValid(employee_id))
                throw new Error("employee_id không hợp lệ.");

            const employee = await this.Employee.findById(employee_id);
            if (!employee) 
                throw new Error("Không tìm thấy nhân viên.");

            // build filter
            const filter = { employee_id };

            if (status) filter.status = status;

            if (period_date) {
                filter.period_date = new Date(period_date);

            } else if (start_date || end_date) {
                const startDate = start_date ? new Date(start_date) : null;
                const endDate   = end_date   ? new Date(end_date)   : null;

                if (startDate && isNaN(startDate.getTime()))
                    throw new Error("start_date không hợp lệ.");
                
                if (endDate && isNaN(endDate.getTime()))
                    throw new Error("end_date không hợp lệ.");
                
                if (startDate && endDate && startDate > endDate)
                    throw new Error("start_date phải trước end_date.");

                filter.work_date = {
                    ...(startDate && { $gte: startDate }),
                    ...(endDate   && { $lte: endDate }),
                };
            }

            const earnings = await this.EmployeeEarning.find(filter)
                .populate("shift_id", "shift_type begin_time end_time")
                .populate("attendance_id", "check_in check_out late_minutes early_leave_minutes")
                .select("-__v")
                .sort({ work_date: 1 });

            if (!earnings.length) return {
                employee_id,
                full_name:    employee.full_name,
                total_shifts: 0,
                summary:      { total_earned: 0, total_deductions: 0, total_gross: 0 },
                by_date:      {},
                earnings:     [],
            };

            // aggregate: group per day for overview
            const by_date = earnings.reduce((acc, e) => {
                const dateKey = e.work_date.toISOString().split("T")[0];
                if (!acc[dateKey]) {
                    acc[dateKey] = {
                        work_date:       e.work_date,
                        total_earned:    0,
                        total_gross:     0,
                        total_deductions: 0,
                        shifts:          [],
                    };
                }

                acc[dateKey].total_gross      += e.work_hours * e.hourly_rate;
                acc[dateKey].total_deductions += e.deductions?.total ?? 0;
                acc[dateKey].total_earned     += e.earning_amount;
                acc[dateKey].shifts.push({
                    _id:            e._id,
                    shift_type:     e.shift_id?.shift_type,
                    begin_time:     e.shift_id?.begin_time,
                    end_time:       e.shift_id?.end_time,
                    work_hours:     e.work_hours,
                    hourly_rate:    e.hourly_rate,
                    gross:          e.work_hours * e.hourly_rate,
                    deductions:     e.deductions,
                    earning_amount: e.earning_amount,
                    status:         e.status,
                });

                return acc;
            }, {});

            // overall summary
            const summary = earnings.reduce((acc, e) => {
                acc.total_gross      += e.work_hours * e.hourly_rate;
                acc.total_deductions += e.deductions?.total ?? 0;
                acc.total_earned     += e.earning_amount;
                return acc;
            }, { total_gross: 0, total_deductions: 0, total_earned: 0 });

            return {
                employee_id,
                full_name:    employee.full_name,
                hourly_rate:  employee.fixed_salary,
                total_shifts: earnings.length,
                summary: {
                    total_gross:      Number(summary.total_gross.toFixed(0)),
                    total_deductions: Number(summary.total_deductions.toFixed(0)),
                    total_earned:     Number(summary.total_earned.toFixed(0)),
                },
                by_date,
                earnings,
            };

        } catch (error) {
            console.error("Error in getEmployeeEarnings:", error.message);
            throw error;
        }
    }

    async getAllEmployeesEarnings(query = {}) {
        try {
            const { start_date, end_date, period_date, status, role } = query;

            const filter = {};

            if (status) {
                const validStatuses = ["available", "pending", "paid"];
                if (!validStatuses.includes(status))
                    throw new Error("Status không hợp lệ.");
                filter.status = status;
            }

            if (period_date) {
                filter.period_date = new Date(period_date);
            } else if (start_date || end_date) {
                const startDate = start_date ? new Date(start_date) : null;
                const endDate   = end_date   ? new Date(end_date)   : null;

                if (startDate && isNaN(startDate.getTime()))
                    throw new Error("start_date không hợp lệ.");
                if (endDate && isNaN(endDate.getTime()))
                    throw new Error("end_date không hợp lệ.");
                if (startDate && endDate && startDate > endDate)
                    throw new Error("start_date phải trước end_date.");

                filter.work_date = {
                    ...(startDate && { $gte: startDate }),
                    ...(endDate   && { $lte: endDate }),
                };
            }

            const earnings = await this.EmployeeEarning.find(filter)
                .populate("employee_id", "full_name phone_number position fixed_salary")
                .populate("shift_id", "shift_type begin_time end_time")
                .select("-__v -attendance_id")
                .sort({ work_date: 1 });

            if (!earnings.length) return {
                total_employees: 0,
                summary: { total_gross: 0, total_deductions: 0, total_earned: 0 },
                by_employee: {},
            };

            const byEmployee = new Map();

            for (const e of earnings) {
                const empId   = e.employee_id._id.toString();
                const dateKey = e.work_date.toISOString().split("T")[0];

                if (role && e.employee_id.position !== role) continue;

                if (!byEmployee.has(empId)) {
                    byEmployee.set(empId, {
                        employee_id:  e.employee_id._id,
                        full_name:    e.employee_id.full_name,
                        phone_number: e.employee_id.phone_number,
                        role:         e.employee_id.position,
                        hourly_rate:  e.employee_id.fixed_salary,
                        total_shifts: 0,
                        summary: {
                            total_gross:      0,
                            total_deductions: 0,
                            total_earned:     0,
                        },
                        by_date: {},
                    });
                }

                const empEntry = byEmployee.get(empId);

                if (!empEntry.by_date[dateKey]) {
                    empEntry.by_date[dateKey] = {
                        work_date:        e.work_date,
                        total_gross:      0,
                        total_deductions: 0,
                        total_earned:     0,
                        shifts:           [],
                    };
                }

                const dateEntry = empEntry.by_date[dateKey];
                const gross     = e.work_hours * e.hourly_rate;

                dateEntry.total_gross      += gross;
                dateEntry.total_deductions += e.deductions?.total ?? 0;
                dateEntry.total_earned     += e.earning_amount;
                dateEntry.shifts.push({
                    _id:            e._id,
                    shift_type:     e.shift_id?.shift_type,
                    begin_time:     e.shift_id?.begin_time,
                    end_time:       e.shift_id?.end_time,
                    work_hours:     e.work_hours,
                    gross:          Number(gross.toFixed(0)),
                    deductions:     e.deductions,
                    earning_amount: e.earning_amount,
                    status:         e.status,
                });

                empEntry.total_shifts++;
                empEntry.summary.total_gross      += gross;
                empEntry.summary.total_deductions += e.deductions?.total ?? 0;
                empEntry.summary.total_earned     += e.earning_amount;
            }

            const by_employee = {};
            for (const [empId, empData] of byEmployee) {
                empData.summary = {
                    total_gross:      Number(empData.summary.total_gross.toFixed(0)),
                    total_deductions: Number(empData.summary.total_deductions.toFixed(0)),
                    total_earned:     Number(empData.summary.total_earned.toFixed(0)),
                };

                for (const dateKey of Object.keys(empData.by_date)) {
                    const d = empData.by_date[dateKey];
                    d.total_gross      = Number(d.total_gross.toFixed(0));
                    d.total_deductions = Number(d.total_deductions.toFixed(0));
                    d.total_earned     = Number(d.total_earned.toFixed(0));
                }

                by_employee[empId] = empData;
            }

            const overallSummary = Object.values(by_employee).reduce((acc, emp) => {
                acc.total_gross      += emp.summary.total_gross;
                acc.total_deductions += emp.summary.total_deductions;
                acc.total_earned     += emp.summary.total_earned;
                return acc;
            }, { total_gross: 0, total_deductions: 0, total_earned: 0 });

            return {
                total_employees: Object.keys(by_employee).length,
                total_shifts:    earnings.length,
                summary:         overallSummary,
                by_employee,
            };

        } catch (error) {
            console.error("Error in getAllEmployeesEarnings:", error.message);
            throw error;
        }
    }
}

