import bcrypt from "bcrypt";
import mongoose from "mongoose";
import { User, Employee, Shift, Schedule } from "../models/index.js";

//------ EMPLOYEE ------//
export const registerEmployee = async (req, res) => {
  try {
    const { email, password, full_name, phone_number, date_birth, CCCD, position, fixed_salary } = req.body;

    const existingUser = await User.findOne({ email });
    if (existingUser) {
      return res.status(400).json({ message: "Email đã tồn tại." });
    }

    const existingPhone = await User.findOne({ phone_number });
    if (existingPhone)
      return res.status(400).json({ message: "Số điện thoại đã tồn tại." });

    const existingCCCD = await User.findOne({ CCCD });
    if (existingCCCD)
    return res.status(400).json({ message: "Số căn cước công dân đã tồn tại." });

    if (!email || !password || !full_name || !phone_number || !date_birth || !CCCD || !position || !fixed_salary) {
      return res.status(400).json({ message: "Vui lòng nhập đầy đủ thông tin bắt buộc!" });
    }

    const hashedPassword = await bcrypt.hash(password, 10);
    const randomAvatar = defaultAvatars[Math.floor(Math.random() * defaultAvatars.length)];
    
    const newUser = await User.create({
      email, password: hashedPassword, system_role: "employee", avatar: randomAvatar
    });

    const newEmployee =  await Employee.create({
      user_id: newUser._id, full_name, phone_number, date_birth, CCCD, position, fixed_salary
    });

    res.status(201).json({ 
      message: "Tạo tài khoản và thêm thông tin nhân viên thành công.", 
      data: { user_account: newUser, employee_account: newEmployee }
    });
  } catch (err) {
    res.status(500).json({ message: "SERVER ERROR: ", err: err.message });
  }
};

export const getAllEmployess = async (req, res) => {
    try {
        const employees = await Employee.find()
            .select("-__v")
            .populate("user_id", "email system_role -_id");
        res.status(200).json(employees);
    } catch (error) {
        res.status(500).json({ message: error.message });
    }
};

export const getEmployeeById = async (req, res) => {
    try {
        const { employee_id } = req.params;
        const employee = await Employee.findById(employee_id);

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
      const employeeId = req.params;
      const { status, position, fixed_salary } = req.body;

      const requester = await User.findById(req.user._id);

      if (!requester || requester.system_role !== "manager") {
        return res.status(403).json({ message: "Bạn không phải Quản lý, không có quyền thực hiện thao tác này." });
      }

      const employee = await Employee.findById(employeeId);
      if (!employee) {
        return res.status(404).json({ message: "Không tìm thấy nhân viên." });
      }

      if (status) employee.status = status;
      if (position) employee.position = position;
      if (fixed_salary) employee.fixed_salary = fixed_salary;

      await employee.save();

      res.status(200).json({
        message: "Cập nhật thông tin nhân viên thành công.",
        employee
      });
    } catch (err) {
      console.error(err);
      res.status(500).json({ message: "Lỗi server." });
    }
};

//------ SCHEDULE ------//

export const getAllSchedules = async (req, res) => {
  try {
    const schedules = await Schedule.find()
      .populate("employee_id", "full_name phone_number")
      .populate("shift_id", "work_day shift_type begin_time end_time")
      .sort({ created_at: -1 })
      .select("-__v");

    res.status(200).json({ success: true, count: schedules.length, schedules });

  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
};

export const getScheduleById = async (req, res) => {
  try {
    const schedule = await Schedule.findById(req.params.id)
      .populate("employee_id", "full_name phone_number")
      .populate("shift_id", "work_day shift_type begin_time end_time");

    if (!schedule)
      return res.status(404).json({ success: false, message: "Không tìm thấy lịch làm việc." });

    res.status(200).json({ success: true, data: schedule });

  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
};

// get schedules of all employee, group by week day
export const getAllEmployeesWeeklySchedule = async (req, res) => {
  try {
    const schedules = await Schedule.find()
      .populate("employee_id", "fullname phone_number")
      .populate("shift_id", "work_day shift_type begin_time end_time")
      .sort({ "shift_id.work_day": 1, "shift_id.begin_time": 1 });

    if (!schedules.length) {
      return res.status(404).json({
        success: false,
        message: "No schedules found in the system.",
      });
    }

    // Gom nhóm theo ngày trong tuần
    const grouped = schedules.reduce((acc, s) => {
      const day = s.shift_id.work_day;
      if (!acc[day]) acc[day] = [];

      // Kiểm tra nếu nhân viên đã có trong acc[day]
      let employeeEntry = acc[day].find(
        (e) => e.employee_id.toString() === s.employee_id._id.toString()
      );

      if (!employeeEntry) {
        employeeEntry = {
          employee_id: s.employee_id._id,
          fullname: s.employee_id.fullname,
          phone_number: s.employee_id.phone_number,
          shifts: [],
        };
        acc[day].push(employeeEntry);
      }

      // Thêm ca vào nhân viên
      employeeEntry.shifts.push({
        shift_id: s.shift_id._id,
        shift_type: s.shift_id.shift_type,
        begin_time: s.shift_id.begin_time,
        end_time: s.shift_id.end_time,
      });

      return acc;
    }, {});

    // Sắp xếp theo thứ trong tuần
    const weekOrder = ["monday","tuesday","wednesday","thursday","friday","saturday","sunday"];
    const sortedGrouped = {};
    for (const day of weekOrder) {
      if (grouped[day]) sortedGrouped[day] = grouped[day];
    }

    res.status(200).json({
      success: true,
      total_days: Object.keys(sortedGrouped).length,
      weekly_schedule: sortedGrouped,
    });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
};

// employee register his own schedule
// export const registerSchedule = async (req, res) => {
//   try {
//     const { employee_id, shift_ids } = req.body;

//     if (!employee_id || !Array.isArray(shift_ids) || shift_ids.length === 0)
//         return res.status(400).json({ success: false, message: "Yêu cầu nhập đầy đủ thông tin." });

//     const employee = await Employee.findById(employee_id);
//     if (!employee)
//         return res.status(404).json({ success: false, message: "Không tìm thấy nhân viên." });

//     const shifts = await Shift.find({ _id: { $in: shift_ids } });
//     if (shifts.length !== shift_ids.length)
//         return res.status(400).json({ success: false, message: "Tồn tại ca làm không hợp lệ." });

//     // lấy lịch làm việc hiện tại của nhân viên
//     const existingSchedules = await Schedule.find({ employee_id }).populate("shift_id");

//     const isTimeOverlap = (aStart, aEnd, bStart, bEnd) => {
//     return aStart < bEnd && bStart < aEnd;
//     };

//     const newSchedules = [];
//     const skipped = [];

//     for (const shift of shifts) {
//         // Kiểm tra trùng ca
//         const duplicate = existingSchedules.find(
//             (s) => s.shift_id._id.toString() === shift._id.toString()
//         );
//         if (duplicate) {
//             skipped.push({ shift_id: shift._id, reason: "Already registered for this shift." });
//             continue;
//         }

//         // Check overlapping time on same work_day
//         const conflict = existingSchedules.find(
//             (s) =>
//             s.shift_id.work_day === shift.work_day &&
//             isTimeOverlap(
//                 s.shift_id.begin_time,
//                 s.shift_id.end_time,
//                 shift.begin_time,
//                 shift.end_time
//             )
//         );
//         if (conflict) {
//             skipped.push({
//             shift_id: shift._id,
//             reason: `Overlaps with existing shift on ${shift.work_day}.`,
//             });
//             continue;
//         }

//         // Nếu hợp lệ thì thêm vào danh sách insert
//         newSchedules.push({ employee_id, shift_id: shift._id });
//     }

//     let inserted = [];
//     if (newSchedules.length > 0) {
//         inserted = await Schedule.insertMany(newSchedules);
//     }

//     res.status(201).json({
//         success: true,
//         message: "Đã đăng ký lịch làm việc thành công.",
//         inserted_count: inserted.length,
//         skipped_count: skipped.length,
//         inserted,
//         skipped,
//     });
//   } catch (error) {
//     res.status(500).json({ success: false, message: error.message });
//   }
// };

export const registerSchedule = async (req, res) => {
  const session = await mongoose.startSession();
  session.startTransaction();

  try {
    const employeeId = req.user.employee_id;
    const { shifts } = req.body;

    if (!Array.isArray(shifts) || shifts.length === 0) {
      return res.status(400).json({
          message: "Vui lòng gửi danh sách các ca làm để đăng ký."
      });
    }

    // lấy thông tin nhân viên
    const employee = await Employee.findById(employeeId);
    if (!employee) {
        return res.status(404).json({ message: "Không tìm thấy nhân viên." });
    }

    const role = employee.role;
    for (const shiftId of shifts) {
      // lấy thông tin shift
      const shift = await Shift.findById(shiftId);
      if (!shift) {
        await session.abortTransaction();
        return res.status(400).json({ message: `Ca làm ${shiftId} không tồn tại.` });
      }

      // số lượng nhân viên cần cho role này
      const requiredCount = shift.required_staff[role];
      if (!requiredCount) {
          await session.abortTransaction();
          return res.status(400).json({ message: `Ca làm này không yêu cầu role "${role}".`});
      }

      const currentSchedules = await Schedule.find({ shift_id: shiftId })
          .populate("employee_id");

      const currentCount = currentSchedules.filter(s => s.employee_id.role === role).length;

      if (currentCount >= requiredCount) {
        await session.abortTransaction();
        return res.status(400).json({
          message: `Ca làm "${shift.name}" đã đủ nhân viên cho vị trí ${role}.`
        });
      }

      // Kiểm tra nhân viên đã đăng ký ca này chưa
      const exists = await Schedule.findOne({
        employee_id: employeeId,
        shift_id: shiftId
      });

      if (exists) continue; // bỏ qua nếu đã đăng ký trước đó

      await Schedule.create(
        [{ employee_id: employeeId, shift_id: shiftId }],
        { session }
      );
    }

    await session.commitTransaction();
    return res.status(200).json({
      message: "Đăng ký lịch làm việc thành công!"
    });

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
    const { employee_id } = req.params;

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
        shift_id: schedule.shift_id._id,
        shift_type: schedule.shift_id.shift_type,
        begin_time: schedule.shift_id.begin_time,
        end_time: schedule.shift_id.end_time,
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
      schedule_by_day: sortedGrouped,
    });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
};

// employee update his own schedules
export const updateSchedule = async (req, res) => {
  try {
    const { employee_id, shift_id } = req.body;

    // Validate existence
    const [employee, shift] = await Promise.all([
      Employee.findById(employee_id),
      Shift.findById(shift_id),
    ]);

    if (!employee)
      return res.status(404).json({ success: false, message: "Employee not found." });
    if (!shift)
      return res.status(404).json({ success: false, message: "Shift not found." });

    // Prevent duplicate combination
    const duplicate = await Schedule.findOne({
      _id: { $ne: req.params.id },
      employee_id,
      shift_id,
    });
    if (duplicate)
      return res.status(400).json({
        success: false,
        message: "This employee already has that shift.",
      });

    const updated = await Schedule.findByIdAndUpdate(
      req.params.id,
      { employee_id, shift_id },
      { new: true }
    );

    if (!updated)
      return res.status(404).json({ success: false, message: "Schedule not found." });

    res.status(200).json({
      success: true,
      message: "Schedule updated successfully.",
      data: updated,
    });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
};
