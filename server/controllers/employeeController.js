import bcrypt from "bcrypt";
import mongoose from "mongoose";
import { User, Employee, Shift, Schedule, Attendance } from "../models/index.js";
import { defaultAvatars } from "../config/avatars.js";
import { 
    createEarningFromAttendance, 
    calculateAllPendingEarnings,
    calculateEarningsForPeriod 
} from "../services/employeeEarningService.js";

//------ EMPLOYEE ------//
export const registerEmployee = async (req, res) => {
  const session = await mongoose.startSession();
  session.startTransaction();

  try {
    const { email, password, full_name, phone_number, date_birth, CCCD, position, fixed_salary } = req.body;

    if (!email || !password || !full_name || !phone_number || !date_birth || !CCCD || !position || !fixed_salary) {
      await session.abortTransaction();
      return res.status(400).json({ message: "Vui lòng nhập đầy đủ thông tin bắt buộc!" });
    }

    const existingUser = await User.findOne({ email }).session(session);
    if (existingUser) {
      await session.abortTransaction();
      return res.status(400).json({ message: "Email đã tồn tại." });
    }

    const existingPhone = await Employee.findOne({ phone_number }).session(session);
    if (existingPhone) {
      await session.abortTransaction();
      return res.status(400).json({ message: "Số điện thoại đã tồn tại." });
    }

    const existingCCCD = await Employee.findOne({ CCCD }).session(session);
    if (existingCCCD) {
      await session.abortTransaction();
      return res.status(400).json({ message: "Số căn cước công dân đã tồn tại." });
    }

    const hashedPassword = await bcrypt.hash(password, 10);
    const randomAvatar = defaultAvatars[Math.floor(Math.random() * defaultAvatars.length)];
    
    const newUser = await User.create(
      [{
        email,
        password: hashedPassword,
        system_role: "employee",
        avatar: randomAvatar,
        emailVerified: true
      }],
      { session }
    );

    const newEmployee = await Employee.create(
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

    res.status(201).json({ 
      message: "Tạo tài khoản và thêm thông tin nhân viên thành công.", 
      data: {
        user_id: newUser[0]._id,
        employee_id: newEmployee[0]._id
      }
    });
  } catch (err) {
    await session.abortTransaction();
    res.status(500).json({ message: "SERVER ERROR: ", err: err.message });
  } finally {
    session.endSession();
  }
};

export const getAllEmployees = async (req, res) => {
  try {
    const { position, status, min_salary, max_salary, min_year, max_year } = req.query;

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

    let employees = await Employee.find(filter)
      .select("-__v -created_at -updated_at")
      .populate({
        path: "user_id",
        select: "email system_role avatar _id"
      });

    res.status(200).json({
      success: true,
      count: employees.length,
      employees
    });

  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};

export const getEmployeeById = async (req, res) => {
    try {
        const employee_id = req.params.id;
        const employee = await Employee.findById(employee_id)
          .select("-__v -created_at -updated_at -createdAt -updatedAt")
          .populate("user_id", "email system_role avatar -_id");

        if (!employee) {
            return res.status(404).json({ success: false, message: "Không tìm thấy nhân viên." });
        }
        return res.status(200).json({ success: true, employee });

    } catch (err) {
        console.error(err);
        return res.status(500).json({ success: false, message: "SERVER ERROR:", err: err.message });
    }
}

export const updateEmployee = async (req, res) => {
    try {
      const employeeId = req.params.id;
      const { status, position, fixed_salary } = req.body;

      const employee = await Employee.findById(employeeId).select("-__v -created_at -updated_at -createdAt -updatedAt");
      if (!employee) {
        return res.status(404).json({ message: "Không tìm thấy nhân viên." });
      }

      const valid_status = ["resign", "working"];
      if (status) {
        if (!valid_status.includes(status))
          return res.status(400).json({ message: `Trạng thái không hợp lệ. Giá trị cho phép: ${VALID_STATUS.join(", ")}` });

        employee.status = status;
      }

      const valid_positions = ["manager", "receptionist", "housekeeping", "technician", "customer_service"];
      if (position) {
        if (!valid_positions.includes(position))
          return res.status(400).json({ message: `Vị trí không hợp lệ. Giá trị cho phép: ${valid_positions.join(", ")}` });

        employee.position = position;
      }

      if (fixed_salary) employee.fixed_salary = fixed_salary;

      await employee.save();

      res.status(200).json({
        message: "Cập nhật thông tin nhân viên thành công.",
        employee
      });
    } catch (err) {
      console.error(err);
      res.status(500).json({ message: "Lỗi server.", error: err.message });
    }
};

//------ SCHEDULE ------//

// get all schedules, with optional filters
export const getAllSchedules = async (req, res) => {
  try {
    const {
      employee_id,
      work_date,
      work_day,
      shift_type,
      week,
      raw
    } = req.query;

    const filter = {};

    if (employee_id) filter.employee_id = employee_id;
    if (work_date) filter.work_date = work_date;

    let schedules = await Schedule.find(filter)
      .populate("employee_id", "fullname phone_number")
      .populate("shift_id", "work_day shift_type begin_time end_time")
      .sort({ "shift_id.work_day": 1, "shift_id.begin_time": 1 })
      .select("-__v -created_at -updated_at");

    // Filter theo field của shift (vì populate nên phải lọc thủ công)
    if (work_day) {
      schedules = schedules.filter(
        s => s.shift_id.work_day === work_day
      );
    }

    if (shift_type) {
      schedules = schedules.filter(
        s => s.shift_id.shift_type === shift_type
      );
    }

    if (!schedules.length) {
      return res.status(404).json({
        success: false,
        message: "Không tìm thấy lịch làm việc nào thỏa yêu cầu."
      });
    }

    // trả danh sách gốc, không lọc
    if (raw === "true" || week !== "true") {
      return res.status(200).json({
        success: true,
        count: schedules.length,
        schedules
      });
    }

    // group theo tuần
    const grouped = schedules.reduce((acc, s) => {
      const day = s.shift_id.work_day;
      if (!acc[day]) acc[day] = [];

      let employeeEntry = acc[day].find(
        e => e.employee_id.toString() === s.employee_id._id.toString()
      );

      if (!employeeEntry) {
        employeeEntry = {
          employee_id: s.employee_id._id,
          fullname: s.employee_id.fullname,
          phone_number: s.employee_id.phone_number,
          shifts: []
        };
        acc[day].push(employeeEntry);
      }

      employeeEntry.shifts.push({
        shift_id: s.shift_id._id,
        shift_type: s.shift_id.shift_type,
        begin_time: s.shift_id.begin_time,
        end_time: s.shift_id.end_time
      });

      return acc;
    }, {});

    const weekOrder = [
      "monday","tuesday","wednesday",
      "thursday","friday","saturday","sunday"
    ];

    const sortedGrouped = {};
    for (const day of weekOrder) {
      if (grouped[day]) sortedGrouped[day] = grouped[day];
    }

    res.status(200).json({
      success: true,
      total_days: Object.keys(sortedGrouped).length,
      weekly_schedule: sortedGrouped
    });

  } catch (error) {
    res.status(500).json({
      success: false,
      message: error.message
    });
  }
};

export const getScheduleById = async (req, res) => {
  try {
    const schedule = await Schedule.findById(req.params.id)
      .select("-__v -created_at -updated_at")
      .populate("employee_id", "full_name phone_number")
      .populate("shift_id", "work_day shift_type begin_time end_time");

    if (!schedule)
      return res.status(404).json({ success: false, message: "Không tìm thấy lịch làm việc." });

    res.status(200).json({ success: true, data: schedule });

  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
};

// employee register his own schedule
export const registerSchedule = async (req, res) => {
  const session = await mongoose.startSession();
  session.startTransaction();

  try {
    const employeeId = req.user.userId;
    const { shifts, work_date } = req.body;

    if (!Array.isArray(shifts) || shifts.length === 0) {
      return res.status(400).json({
        message: "Vui lòng gửi danh sách các ca làm để đăng ký."
      });
    }

    if ( new Date(work_date) <= new Date() ) {
      return res.status(400).json({ message: "Không được đăng kí ca làm ở ngày trong quá khứ." });
    }

    const employee = await Employee.findOne({ user_id: employeeId }).session(session);
    if (!employee) {
      return res.status(404).json({ message: "Không tìm thấy nhân viên." });
    }
    const role = employee.position;

    for (const shiftId of shifts) {

      const shift = await Shift.findById(shiftId).session(session);
      if (!shift) {
        return res.status(400).json({ message: `Ca làm ${shiftId} không tồn tại.` });
      }

      const requiredCount = shift.required_staff[role];
      if (!requiredCount || requiredCount === undefined) {
        return res.status(400).json({ message: `Ca làm này không yêu cầu vị trí "${role}".`});
      }

      const currentCount = await Schedule.countDocuments({
        shift_id: shiftId,
        work_date,
        role,
      }).session(session);
      if (currentCount >= requiredCount)
        return res.status(400).json({ message: `Ca ${shift.work_day} ${shift.shift_type} đã đủ người` });

      const exists = await Schedule.findOne({
        employee_id: employee._id,
        shift_id: shiftId,
        work_date
      }).session(session);

      if (exists) continue; // bỏ qua nếu đã đăng ký trước đó

      await Schedule.create(
        [{ employee_id: employee._id, shift_id: shiftId, work_date, role }],
        { session }
      );
    }

    await session.commitTransaction();
    return res.status(200).json({ message: "Đăng ký lịch làm việc thành công!"});

  } catch (err) {
    await session.abortTransaction();
    return res.status(500).json({ message: err.message });
  } finally {
    session.endSession();
  }
};

// get schedules of an employee, group by week day
export const viewMySchedule = async (req, res) => {
  try {
    const user_id = req.user.userId;
    const employee = await Employee.findOne({ user_id: user_id });
    if (!employee) {
      return res.status(404).json({ success: false, message: "!!!Không tìm thấy nhân viên." });
    }

    const employee_id = employee._id;
    // kiểm tra tồn tại nhân viên
    const schedules = await Schedule.find({ employee_id })
      .populate("shift_id", "work_day shift_type begin_time end_time")
      .sort({ "shift_id.work_day": 1, "shift_id.begin_time": 1 });

    if (!schedules.length) {
        return res.status(404).json({ success: false, message: "Bạn chưa có lịch làm việc nào." });
    }

    // Gom nhóm theo ngày trong tuần
    const grouped = schedules.reduce((acc, schedule) => {
      const day = schedule.shift_id.work_day;
      if (!acc[day]) acc[day] = [];

      acc[day].push({
        _id: schedule._id,
        shift_id: schedule.shift_id._id,
        shift_type: schedule.shift_id.shift_type,
        begin_time: schedule.shift_id.begin_time,
        end_time: schedule.shift_id.end_time,
        work_date: schedule.work_date,
      });
      return acc;
    }, {});

    // Sắp xếp theo thứ trong tuần cố định
    const weekOrder = ["monday","tuesday","wednesday","thursday","friday","saturday","sunday"];
    const sortedGrouped = {};
    for (const day of weekOrder) {
      if (grouped[day]) sortedGrouped[day] = grouped[day];
    }

    res.status(200).json({
      success: true,
      employee_id,
      total_days: Object.keys(sortedGrouped).length,
      by_weekday: sortedGrouped,
    });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
};

// employee update one specific schedules
export const updateSchedule = async (req, res) => {
  try {
    const { shift_id } = req.body;
    const schedule_id = req.params.id;
    const user_id = req.user.userId;

    const theEmployee = await Employee.findOne({ user_id: user_id });
    const employee_id = theEmployee._id;

    // Validate existence
    const [employee, shift] = await Promise.all([
      Employee.findById(employee_id),
      Shift.findById(shift_id),
    ]);

    if (!employee)
      return res.status(404).json({ success: false, message: "Không tìm thấy nhân viên." });
    if (!shift)
      return res.status(404).json({ success: false, message: "Không tìm thấy ca làm." });

    const duplicate = await Schedule.findOne({
      _id: { $ne: schedule_id },
      employee_id,
      shift_id,
    });
    if (duplicate)
      return res.status(400).json({
        success: false,
        message: "Nhân viên đã đăng ký ca làm này rồi.",
      });

    const updated = await Schedule.findByIdAndUpdate(
      schedule_id,
      { employee_id, shift_id },
      { new: true }
    );

    if (!updated)
      return res.status(404).json({ success: false, message: "Không tìm thấy lịch làm việc." });

    res.status(200).json({
      success: true,
      message: "Cập nhật lịch làm việc mới thành công.",
      data: updated,
    });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
};

// employee delete one specific schedule
export const deleteSchedule = async (req, res) => {
  const session = await mongoose.startSession();
  session.startTransaction();

  try {
    const employeeId = req.user.userId;
    const scheduleId = req.params.id;

    const employee = await Employee.findOne({ user_id: employeeId }).session(session);
    if (!employee) {
      return res.status(404).json({ message: "Không tìm thấy nhân viên." });
    }
    const employee_id = employee._id;
    
    const schedule = await Schedule.findOne({_id: scheduleId, employee_id: employee_id }).session(session);
    if (!schedule) {
      return res.status(404).json({
        message: "Không tìm thấy lịch làm việc tương ứng của nhân viên để xóa."
      });
    }

    await Schedule.deleteOne(
      { _id: scheduleId},
      { session }
    );

    await session.commitTransaction();
    return res.status(200).json({
      message: "Xóa lịch làm việc thành công."
    });

  } catch (err) {
    await session.abortTransaction();
    return res.status(500).json({ message: err.message });
  } finally {
    session.endSession();
  }
};

export const createAccountForExistingEmployee = async (req, res) => {
  const session = await mongoose.startSession();
  session.startTransaction();
  try {
    const { id } = req.params;
    const { email, password } = req.body;

    if (!email || !password) {
      return res.status(400).json({ message: "Vui lòng nhập Email và Mật khẩu." });
    }

    const employee = await Employee.findById(id).session(session);
    if (!employee) {
      return res.status(404).json({ message: "Không tìm thấy nhân viên." });
    }

    if (employee.user_id) {
      return res.status(400).json({ message: "Nhân viên này đã có tài khoản rồi." });
    }

    // Kiểm tra email đã bị dùng bởi người khác chưa
    const existingUser = await User.findOne({ email }).session(session);
    if (existingUser) {
      return res.status(400).json({ message: "Email này đã được sử dụng." });
    }

    // Tạo User mới
    const hashedPassword = await bcrypt.hash(password, 10);
    const randomAvatar = defaultAvatars[Math.floor(Math.random() * defaultAvatars.length)];

    const newUser = await User.create([{
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
    res.status(200).json({ message: "Tạo tài khoản thành công!", user: newUser[0] });

  } catch (error) {
    await session.abortTransaction();
    res.status(500).json({ message: error.message });
  } finally {
    session.endSession();
  }
};

// 2. Reset mật khẩu (Dành cho Admin đổi pass nhân viên)
export const resetPasswordForEmployee = async (req, res) => {
  try {
    const { id } = req.params; // Employee ID
    const { newPassword } = req.body;

    const employee = await Employee.findById(id);
    if (!employee || !employee.user_id) {
      return res.status(404).json({ message: "Nhân viên chưa có tài khoản." });
    }

    const hashedPassword = await bcrypt.hash(newPassword, 10);

    await User.findByIdAndUpdate(employee.user_id, {
        password: hashedPassword
    });

    res.status(200).json({ message: "Đổi mật khẩu thành công." });
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};

// 3. Khóa / Mở khóa tài khoản (Ban/Unban)
export const toggleBanUser = async (req, res) => {
  try {
    const { id } = req.params; // Employee ID
    const { isBanned } = req.body; // true hoặc false

    const employee = await Employee.findById(id);
    if (!employee || !employee.user_id) {
      return res.status(404).json({ message: "Nhân viên chưa có tài khoản." });
    }

    await User.findByIdAndUpdate(employee.user_id, {
        isBanned: isBanned,
        status: isBanned ? "banned" : "active" // Cập nhật cả status nếu model User của bạn dùng field này
    });

    res.status(200).json({ message: `Đã ${isBanned ? "khóa" : "mở khóa"} tài khoản thành công.` });
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};

// --- THÊM HÀM NÀY ĐỂ NHÂN VIÊN LẤY PROFILE CỦA CHÍNH MÌNH ---
export const getMyProfile = async (req, res) => {
  try {
    // req.user.userId được lấy từ verifyToken middleware
    const userId = req.user.userId;

    const employee = await Employee.findOne({ user_id: userId })
      .populate("user_id", "email system_role avatar");

    if (!employee) {
      return res.status(404).json({ message: "Không tìm thấy hồ sơ nhân viên." });
    }

    res.status(200).json({ success: true, employee });
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
};

// chấm công vào làm
export const checkInShift = async (req, res) => {
  try {
    const { employee_id } = req.body;
    const now = new Date();

    // lấy ngày làm việc (00:00)
    const today = new Date(now);
    today.setHours(0, 0, 0, 0);

    const schedule = await Schedule.findOne({
      employee_id,
      work_date: today,
    }).populate("shift_id");

    if (!schedule)
      return res.status(404).json({
        success: false,
        message: "Không có lịch làm việc hôm nay",
      });

    // kiểm tra đã check-in chưa
    let attendance = await Attendance.findOne({
      schedule_id: schedule._id,
    });

    if (attendance?.check_in)
      return res.status(400).json({
        success: false,
        message: "Đã check-in rồi",
      });

    const shift = schedule.shift_id;

    const checkInMinutes =
      now.getHours() * 60 + now.getMinutes();
    const beginMinutes = timeToMinutes(shift.begin_time);

    let status = "present";
    let lateMinutes = 0;

    if (checkInMinutes > beginMinutes) {
      status = "late";
      lateMinutes = checkInMinutes - beginMinutes;
    }

    attendance = await Attendance.create({
      employee_id,
      schedule_id: schedule._id,
      check_in: now,
      status,
      late_minutes: lateMinutes,
    });

    return res.status(200).json({
      success: true,
      message: "Check-in thành công",
      data: attendance,
    });
  } catch (err) {
    console.error(err);
    res.status(500).json({ success: false, message: "Server error" });
  }
};

// checkout tan làm
export const checkOutShift = async (req, res) => {
  try {
    const { employee_id } = req.body;
    const now = new Date();

    const today = new Date(now);
    today.setHours(0, 0, 0, 0);

    const schedule = await Schedule.findOne({
      employee_id,
      work_date: today,
    }).populate("shift_id");

    if (!schedule)
      return res.status(404).json({
        success: false,
        message: "Không có lịch làm việc hôm nay",
      });

    const attendance = await Attendance.findOne({
      schedule_id: schedule._id,
    });

    if (!attendance || !attendance.check_in)
      return res.status(400).json({
        success: false,
        message: "Chưa check-in",
      });

    if (attendance.check_out)
      return res.status(400).json({
        success: false,
        message: "Đã check-out rồi",
      });

    const shift = schedule.shift_id;

    const checkOutMinutes = now.getHours() * 60 + now.getMinutes();
    const endMinutes = timeToMinutes(shift.end_time);

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
    try {
        await createEarningFromAttendance(attendance._id);
    } catch (earningError) {
        console.error("Lỗi khi tính lương tự động:", earningError);
        // Không throw error, chỉ log để không ảnh hưởng đến check-out
    }

    return res.status(200).json({
      success: true,
      message: "Check-out thành công",
      data: attendance,
    });
  } catch (err) {
    console.error(err);
    res.status(500).json({ success: false, message: "Server error" });
  }
};

// Tính lương cho nhân viên (dành cho Manager)
export const calculateEmployeeSalary = async (req, res) => {
  try {
    const { employee_id, start_date, end_date } = req.body;
    
    // Nếu có employee_id, start_date, end_date -> tính cho khoảng thời gian cụ thể
    if (employee_id && start_date && end_date) {
      const startDate = new Date(start_date);
      const endDate = new Date(end_date);
      
      if (isNaN(startDate.getTime()) || isNaN(endDate.getTime())) {
        return res.status(400).json({ 
          success: false, 
          message: "Ngày không hợp lệ" 
        });
      }
      
      if (startDate > endDate) {
        return res.status(400).json({ 
          success: false, 
          message: "Ngày bắt đầu phải trước ngày kết thúc" 
        });
      }
      
      const earnings = await calculateEarningsForPeriod(employee_id, startDate, endDate);
      
      return res.status(200).json({
        success: true,
        message: `Đã tính lương cho ${earnings.length} ca làm việc`,
        data: {
          count: earnings.length,
          total_amount: earnings.reduce((sum, e) => sum + e.earning_amount, 0),
          earnings
        }
      });
    }
    
    // Nếu chỉ có employee_id -> tính tất cả pending earnings cho nhân viên đó
    if (employee_id) {
      const earnings = await calculateAllPendingEarnings(employee_id);
      
      return res.status(200).json({
        success: true,
        message: `Đã tính lương cho ${earnings.length} ca làm việc`,
        data: {
          count: earnings.length,
          total_amount: earnings.reduce((sum, e) => sum + e.earning_amount, 0),
          earnings
        }
      });
    }
    
    // Nếu không có tham số -> tính tất cả pending earnings cho tất cả nhân viên
    const earnings = await calculateAllPendingEarnings();
    
    return res.status(200).json({
      success: true,
      message: `Đã tính lương cho ${earnings.length} ca làm việc`,
      data: {
        count: earnings.length,
        total_amount: earnings.reduce((sum, e) => sum + e.earning_amount, 0),
        earnings
      }
    });
  } catch (error) {
    console.error("Lỗi khi tính lương:", error);
    res.status(500).json({ 
      success: false, 
      message: "Lỗi server", 
      error: error.message 
    });
  }
};

