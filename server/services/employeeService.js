import bcrypt from "bcrypt";
import mongoose from "mongoose";

export class EmployeeService {
  constructor({
    User,
    Employee,
    Schedule,
    Attendance,
    defaultAvatars,
    timeToMinutes
  }) {
    this.User = User;
    this.Employee = Employee;
    this.Schedule = Schedule;
    this.Attendance = Attendance;
    this.defaultAvatars = defaultAvatars;
    this.timeToMinutes = timeToMinutes;
  }

  // admin add new employee 
  async registerEmployee(data) {
    const session = await mongoose.startSession();

    try {
      session.startTransaction();

      const { email, password, full_name, phone_number, date_birth, CCCD, position, fixed_salary } = data;

      if (!email || !password || !full_name || !phone_number || !date_birth || !CCCD || !position || !fixed_salary) {
        throw new Error("Vui lòng nhập đầy đủ thông tin bắt buộc!");
      }

      const existingUser = await this.User.findOne({ email }).session(session);
      if (existingUser) {
        throw new Error("Email đã tồn tại.");
      }

      const existingPhone = await this.Employee.findOne({ phone_number }).session(session);
      if (existingPhone) {
        throw new Error("Số điện thoại đã tồn tại.");
      }

      const existingCCCD = await this.Employee.findOne({ CCCD }).session(session);
      if (existingCCCD) {
        throw new Error("Số căn cước công dân đã tồn tại.");
      }

      const hashedPassword = await bcrypt.hash(password, 10);
      const randomAvatar = this.defaultAvatars[Math.floor(Math.random() * this.defaultAvatars.length)];
      
      const newUser = await this.User.create(
        [{
          email,
          password: hashedPassword,
          system_role: "employee",
          avatar: randomAvatar,
          emailVerified: true
        }],
        { session }
      );

      const newEmployee = await this.Employee.create(
        [{
          user_id: newUser[0]._id,
          full_name,
          phone_number,
          date_birth,
          CCCD,
          position,
          fixed_salary
        }],
        { session }
      );

      await session.commitTransaction();

      return { 
        data: {
          user_id: newUser[0]._id,
          employee_id: newEmployee[0]._id 
        }
      }
    } catch (err) {
      await session.abortTransaction();
      throw new Error("SERVER ERROR: " + err.message);
    } finally {
      session.endSession();
    }
  };

  async getAllEmployees (query = {}){
    try {
      const { position, status, min_salary, max_salary, min_year, max_year } = query;

      const filter = {};

      if (position) filter.position = position;
      if (status) filter.status = status;

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
        .select("-__v -created_at -updated_at")
        .populate({
          path: "user_id",
          select: "email system_role avatar _id"
        });

      return { count: employees.length, employees };

    } catch (error) {
      throw new Error(error.message);
    }
  };

  async getEmployeeById (employeeId) {
    try {
      const employee = await this.Employee.findById(employeeId)
        .select("-__v -created_at -updated_at -createdAt -updatedAt")
        .populate("user_id", "email system_role avatar -_id");

      if (!employee) {
          throw new Error("Không tìm thấy nhân viên.");
      }
      return { employee };

    } catch (err) {
      console.error(err);
      throw new Error("SERVER ERROR: " + err.message);
    }
  }

  async updateEmployee (employeeId, updateData) {
    try {
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
      
      return { employee };

    } catch (err) {
      console.error(err);
      throw new Error("SERVER ERROR: " + err.message);
    }
  };

  async createAccountForExistingEmployee (employeeId, data) {
    const session = await mongoose.startSession();

    try {
      session.startTransaction();
      const { email, password } = data;

      if (!email || !password) {
        throw new Error("Vui lòng nhập Email và Mật khẩu.");
      }

      const employee = await this.Employee.findById(employeeId).session(session);
      if (!employee) {
        throw new Error("Không tìm thấy nhân viên.");
      }

      if (employee.user_id) {
        throw new Error("Nhân viên này đã có tài khoản rồi.");
      }

      // Kiểm tra email đã bị dùng bởi người khác chưa
      const existingUser = await this.User.findOne({ email }).session(session);
      if (existingUser) {
        throw new Error("Email này đã được sử dụng.");
      }

      // Tạo User mới
      const hashedPassword = await bcrypt.hash(password, 10);
      const randomAvatar = this.defaultAvatars[Math.floor(Math.random() * this.defaultAvatars.length)];

      const newUser = await this.User.create([{
          email,
          password: hashedPassword,
          system_role: "employee",
          avatar: randomAvatar,
          emailVerified: true
      }], { session });

      // Link User mới vào Employee cũ
      employee.user_id = newUser[0]._id;
      await employee.save({ session });

      await session.commitTransaction();
      return { newUser: newUser[0] };

    } catch (error) {
      await session.abortTransaction();
      throw new Error("SERVER ERROR: " + error.message);
    } finally {
      session.endSession();
    }
  };

  // admin change password for employee's account
  async resetPasswordForEmployee (employeeId, newPassword) {
    try {
      const employee = await this.Employee.findById(employeeId);
      if (!employee || !employee.user_id) {
        throw new Error("Nhân viên chưa có tài khoản.");
      }

      const hashedPassword = await bcrypt.hash(newPassword, 10);

      await this.User.findByIdAndUpdate(employee.user_id, {
        password: hashedPassword
      });

      return { success: true };
    } catch (error) {
      throw new Error("SERVER ERROR: " + error.message);
    }
  };

  async toggleBanUser (employeeId, isBanned) {
    try {
      const employee = await this.Employee.findById(employeeId);
      if (!employee || !employee.user_id) {
        throw new Error("Nhân viên chưa có tài khoản.");
      }

      await this.User.findByIdAndUpdate(employee.user_id, {
        isBanned: isBanned,
        status: isBanned ? "banned" : "active"
      });

      return { success: true };
    } catch (error) {
      throw new Error("SERVER ERROR: " + error.message);
    }
  };

  async getMyProfile (userId) {
    try {
      const employee = await this.Employee.findOne({ user_id: userId })
        .populate("user_id", "email system_role avatar");

      if (!employee) {
        throw new Error("Không tìm thấy hồ sơ nhân viên.");
      }

      return { employee };
    } catch (err) {
      throw new Error("SERVER ERROR: " + err.message);
    }
  };

  async checkInShift (employeeId) {
    try {
      const now = new Date();

      const today = new Date(now);
      today.setHours(0, 0, 0, 0);

      const schedule = await this.Schedule.findOne({
        employee_id: employeeId,
        work_date: today,
      }).populate("shift_id");

      if (!schedule)
        throw new Error("Không có lịch làm việc hôm nay");

      // kiểm tra đã check-in chưa
      let attendance = await this.Attendance.findOne({
        schedule_id: schedule._id,
      });

      if (attendance?.check_in)
        throw new Error("Đã check-in rồi");

      const shift = schedule.shift_id;
      const checkInMinutes = now.getHours() * 60 + now.getMinutes();
      const beginMinutes = this.timeToMinutes(shift.begin_time);

      let status = "present";
      let lateMinutes = 0;

      if (checkInMinutes > beginMinutes) {
        status = "late";
        lateMinutes = checkInMinutes - beginMinutes;
      }

      attendance = await this.Attendance.create({
        employee_id: employeeId,
        schedule_id: schedule._id,
        check_in: now,
        status,
        late_minutes: lateMinutes,
      });

      return { attendance };

    } catch (err) {
      console.error(err);
      throw new Error("SERVER ERROR: " + err.message);
    }
  };

  async checkOutShift (employeeId) {
    try {
      const now = new Date();

      const today = new Date(now);
      today.setHours(0, 0, 0, 0);

      const schedule = await this.Schedule.findOne({
        employee_id: employeeId,
        work_date: today,
      }).populate("shift_id");

      if (!schedule)
        throw new Error("Không có lịch làm việc hôm nay");

      const attendance = await this.Attendance.findOne({
        schedule_id: schedule._id,
      });

      if (!attendance || !attendance.check_in)
        throw new Error("Chưa check-in");

      if (attendance.check_out)
        throw new Error("Đã check-out rồi");

      const shift = schedule.shift_id;
      const checkOutMinutes = now.getHours() * 60 + now.getMinutes();
      const endMinutes = this.timeToMinutes(shift.end_time);

      let earlyLeaveMinutes = 0;
      if (checkOutMinutes < endMinutes) {
        earlyLeaveMinutes = endMinutes - checkOutMinutes;
      }

      const workHours = (now - attendance.check_in) / (1000 * 60 * 60);

      attendance.check_out = now;
      attendance.early_leave_minutes = earlyLeaveMinutes;
      attendance.work_hours = Number(workHours.toFixed(2));

      await attendance.save();

      // Tự động tính lương sau khi check-out
      // try {
      //     await createEarningFromAttendance(attendance._id);
      // } catch (earningError) {
      //     console.error("Lỗi khi tính lương tự động:", earningError);
      // }

      return { attendance };

    } catch (err) {
      console.error(err);
      throw new Error("SERVER ERROR: " + err.message);
    }
  };
}

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

