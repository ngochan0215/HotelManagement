import mongoose from "mongoose";
import { User, Employee, Shift, Schedule, Attendance } from "../models/index.js";

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