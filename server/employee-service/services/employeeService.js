import bcrypt from "bcrypt";

export class EmployeeService {
    constructor({ userClient, Employee, eventBus }) {
        this.userClient = userClient;
        this.Employee = Employee;
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

            const existingPhone = await this.Employee.findOne({ phone_number });
            if (existingPhone) {
                throw new Error("Số điện thoại đã tồn tại.");
            }

            const existingCCCD = await this.Employee.findOne({ CCCD });
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

            console.log("Create employee successfully.");
            return the_employee;
        } catch (error) {
            await this.userClient.deleteUser(userId);
            console.log("Create employee unsuccessfully with error: " + error.message);
            throw error;
        }
    }

    async getAllEmployees (query = {}){
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
            .select("-__v -created_at -updated_at -createdAt -updatedAt")
            // .populate({
            //     path: "user_id",
            //     select: "email system_role avatar _id"
            // });

        return { count: employees.length, employees };
    };

    async getEmployeeById (employeeId) {
        const employee = await this.Employee.findById(employeeId)
            .select("-__v -created_at -updated_at -createdAt -updatedAt")
            //.populate("user_id", "email system_role avatar -_id");

        if (!employee) {
            throw new Error("Không tìm thấy nhân viên.");
        }
        
        return employee;
    };

    async updateEmployee (employeeId, updateData) {
        const { status, position, fixed_salary } = updateData;

        const employee = await this.Employee.findById(employeeId).select("-__v -created_at -updated_at -createdAt -updatedAt");
        if (!employee) {
            throw new Error("Không tìm thấy nhân viên.");
        }

        const valid_status = ["resign", "working"];
        if (status) {
            if (!valid_status.includes(status))
                throw new Error(`Trạng thái không hợp lệ. Giá trị cho phép: ${valid_status.join(", ")}`);

            employee.status = status;
        }

        const valid_positions = ["manager", "receptionist", "housekeeping", "technician", "customer_service"];
        if (position) {
            if (!valid_positions.includes(position))
                throw new Error(`Vị trí không hợp lệ. Giá trị cho phép: ${valid_positions.join(", ")}`);

            employee.position = position;
        }

        if (fixed_salary) employee.fixed_salary = fixed_salary;

        await employee.save();
        
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
            const user = await this.userClient.createUserAccount({
                email,
                password,
                system_role
            });

            employee.user_id = user._id;
            await employee.save();
            return user;

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

            await this.userClient.adminResetPassword({ userId: employee.user_id, newPassword: hashedPassword });

            return { success: true };
        } catch (error) {
            const message = error.response?.data?.message || error.message;
            const status = error.response?.status || 500;
            const err = new Error(message);
            err.status = status;
            throw err;
        }
    };

    async toggleBanUser (employeeId, isBanned) {
        const employee = await this.Employee.findById(employeeId);
        if (!employee || !employee.user_id) {
            throw new Error("Nhân viên chưa có tài khoản.");
        }

        await this.userClient.updateUser(employee.user_id, {
            isBanned: isBanned,
            status: isBanned ? "banned" : "active"
        });

        return { success: true };
    };

    async getMyProfile (userId) {
        const employee = await this.Employee.findOne({ user_id: userId })
            .select("-createdAt -updatedAt -created_at -updated_at");
            //.populate("user_id", "email system_role avatar");

        if (!employee) {
            throw new Error("Không tìm thấy hồ sơ nhân viên.");
        }

        return employee;
    };

    async findEmployeeByUserId (user_id) {
        return this.Employee.findOne({ user_id })
            .select("-created_at -updated_at -__v -createdAt -updatedAt");
    }
}

    // async checkInShift (employeeId) {
    //     try {
    //     const now = new Date();

    //     const today = new Date(now);
    //     today.setHours(0, 0, 0, 0);

    //     const schedule = await this.Schedule.findOne({
    //         employee_id: employeeId,
    //         work_date: today,
    //     }).populate("shift_id");

    //     if (!schedule)
    //         throw new Error("Không có lịch làm việc hôm nay");

    //     // kiểm tra đã check-in chưa
    //     let attendance = await this.Attendance.findOne({
    //         schedule_id: schedule._id,
    //     });

    //     if (attendance?.check_in)
    //         throw new Error("Đã check-in rồi");

    //     const shift = schedule.shift_id;
    //     const checkInMinutes = now.getHours() * 60 + now.getMinutes();
    //     const beginMinutes = this.timeToMinutes(shift.begin_time);

    //     let status = "present";
    //     let lateMinutes = 0;

    //     if (checkInMinutes > beginMinutes) {
    //         status = "late";
    //         lateMinutes = checkInMinutes - beginMinutes;
    //     }

    //     attendance = await this.Attendance.create({
    //         employee_id: employeeId,
    //         schedule_id: schedule._id,
    //         check_in: now,
    //         status,
    //         late_minutes: lateMinutes,
    //     });

    //     return { attendance };

    //     } catch (err) {
    //     console.error(err);
    //     throw new Error("SERVER ERROR: " + err.message);
    //     }
    // };

    // async checkOutShift (employeeId) {
    //     try {
    //     const now = new Date();

    //     const today = new Date(now);
    //     today.setHours(0, 0, 0, 0);

    //     const schedule = await this.Schedule.findOne({
    //         employee_id: employeeId,
    //         work_date: today,
    //     }).populate("shift_id");

    //     if (!schedule)
    //         throw new Error("Không có lịch làm việc hôm nay");

    //     const attendance = await this.Attendance.findOne({
    //         schedule_id: schedule._id,
    //     });

    //     if (!attendance || !attendance.check_in)
    //         throw new Error("Chưa check-in");

    //     if (attendance.check_out)
    //         throw new Error("Đã check-out rồi");

    //     const shift = schedule.shift_id;
    //     const checkOutMinutes = now.getHours() * 60 + now.getMinutes();
    //     const endMinutes = this.timeToMinutes(shift.end_time);

    //     let earlyLeaveMinutes = 0;
    //     if (checkOutMinutes < endMinutes) {
    //         earlyLeaveMinutes = endMinutes - checkOutMinutes;
    //     }

    //     const workHours = (now - attendance.check_in) / (1000 * 60 * 60);

    //     attendance.check_out = now;
    //     attendance.early_leave_minutes = earlyLeaveMinutes;
    //     attendance.work_hours = Number(workHours.toFixed(2));

    //     await attendance.save();

    //     // Tự động tính lương sau khi check-out
    //     // try {
    //     //     await createEarningFromAttendance(attendance._id);
    //     // } catch (earningError) {
    //     //     console.error("Lỗi khi tính lương tự động:", earningError);
    //     // }

    //     return { attendance };

    //     } catch (err) {
    //     console.error(err);
    //     throw new Error("SERVER ERROR: " + err.message);
    //     }
    // };

// manager calculate salary for employee
// export const calculateEmployeeSalary = async (req, res) => {
//   try {
//     const { employee_id, start_date, end_date } = req.body;
    
//     // Nếu có employee_id, start_date, end_date -> tính cho khoảng thời gian cụ thể
//     if (employee_id && start_date && end_date) {
//       const startDate = new Date(start_date);
//       const endDate = new Date(end_date);
      
//       if (isNaN(startDate.getTime()) || isNaN(endDate.getTime())) {
//         return res.status(400).json({ 
//           success: false, 
//           message: "Ngày không hợp lệ" 
//         });
//       }
      
//       if (startDate > endDate) {
//         return res.status(400).json({ 
//           success: false, 
//           message: "Ngày bắt đầu phải trước ngày kết thúc" 
//         });
//       }
      
//       const earnings = await calculateEarningsForPeriod(employee_id, startDate, endDate);
      
//       return res.status(200).json({
//         success: true,
//         message: `Đã tính lương cho ${earnings.length} ca làm việc`,
//         data: {
//           count: earnings.length,
//           total_amount: earnings.reduce((sum, e) => sum + e.earning_amount, 0),
//           earnings
//         }
//       });
//     }
    
//     // Nếu chỉ có employee_id -> tính tất cả pending earnings cho nhân viên đó
//     if (employee_id) {
//       const earnings = await calculateAllPendingEarnings(employee_id);
      
//       return res.status(200).json({
//         success: true,
//         message: `Đã tính lương cho ${earnings.length} ca làm việc`,
//         data: {
//           count: earnings.length,
//           total_amount: earnings.reduce((sum, e) => sum + e.earning_amount, 0),
//           earnings
//         }
//       });
//     }
    
//     // Nếu không có tham số -> tính tất cả pending earnings cho tất cả nhân viên
//     const earnings = await calculateAllPendingEarnings();
    
//     return res.status(200).json({
//       success: true,
//       message: `Đã tính lương cho ${earnings.length} ca làm việc`,
//       data: {
//         count: earnings.length,
//         total_amount: earnings.reduce((sum, e) => sum + e.earning_amount, 0),
//         earnings
//       }
//     });
//   } catch (error) {
//     console.error("Lỗi khi tính lương:", error);
//     res.status(500).json({ 
//       success: false, 
//       message: "Lỗi server", 
//       error: error.message 
//     });
//   }
// };

