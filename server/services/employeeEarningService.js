import mongoose from "mongoose";
import { Employee, Attendance, EmployeeEarning } from "../models/index.js";

// Số giờ làm việc chuẩn trong 1 tháng (8 giờ/ngày x 20 ngày)
const STANDARD_MONTHLY_HOURS = 160;

/**
 * Tính lương cho một Attendance record
 * @param {Object} attendance - Attendance record đã có check_in, check_out, work_hours
 * @param {Object} employee - Employee record có fixed_salary
 * @returns {Object} - { earning_amount, hourly_rate, work_hours }
 */
export const calculateEarningFromAttendance = (attendance, employee) => {
    if (!attendance.work_hours || attendance.work_hours <= 0) {
        return null;
    }

    if (!employee.fixed_salary || employee.fixed_salary <= 0) {
        console.warn(`Employee ${employee._id} không có fixed_salary`);
        return null;
    }

    // Tính hourly rate từ fixed_salary
    const hourly_rate = employee.fixed_salary / STANDARD_MONTHLY_HOURS;
    
    // Tính earning amount
    const earning_amount = attendance.work_hours * hourly_rate;

    return {
        earning_amount: Math.round(earning_amount),
        hourly_rate: Math.round(hourly_rate),
        work_hours: attendance.work_hours
    };
};

/**
 * Tạo EmployeeEarning từ một Attendance record
 * @param {ObjectId} attendanceId - ID của Attendance
 * @param {Object} session - MongoDB session (optional)
 * @returns {Object} - EmployeeEarning record hoặc null
 */

export const createEarningFromAttendance = async (attendanceId, session = null) => {
    try {
        const attendance = await Attendance.findById(attendanceId)
            .populate({
                path: 'schedule_id',
                populate: { path: 'employee_id' }
            })
            .session(session || null);

        if (!attendance) {
            throw new Error("Attendance not found");
        }

        if (!attendance.check_out || !attendance.work_hours) {
            console.log(`Attendance ${attendanceId} chưa check-out hoặc chưa có work_hours`);
            return null;
        }

        // Kiểm tra xem đã tạo earning chưa
        const existingEarning = await EmployeeEarning.findOne({ attendance_id: attendanceId })
            .session(session || null);
        
        if (existingEarning) {
            console.log(`Earning đã tồn tại cho attendance ${attendanceId}`);
            return existingEarning;
        }

        const employee = await Employee.findById(attendance.employee_id)
            .session(session || null);

        if (!employee) {
            throw new Error("Employee not found");
        }

        const earningData = calculateEarningFromAttendance(attendance, employee);
        
        if (!earningData) {
            return null;
        }

        // Lấy ngày làm việc từ schedule
        const schedule = attendance.schedule_id;
        const period_date = schedule?.work_date || attendance.check_out;

        const earning = await EmployeeEarning.create([{
            employee_id: attendance.employee_id,
            attendance_id: attendanceId,
            earning_amount: earningData.earning_amount,
            work_hours: earningData.work_hours,
            hourly_rate: earningData.hourly_rate,
            status: 'available',
            completed_at: attendance.check_out,
            period_date: period_date
        }], { session: session || undefined });

        console.log(`Đã tạo earning ${earning[0]._id} cho attendance ${attendanceId}: ${earningData.earning_amount} VND`);
        return earning[0];
    } catch (error) {
        console.error(`Error creating earning from attendance ${attendanceId}:`, error);
        throw error;
    }
};

/**
 * Tính lương cho tất cả Attendance records trong một khoảng thời gian
 * @param {ObjectId} employeeId - ID của Employee
 * @param {Date} startDate - Ngày bắt đầu
 * @param {Date} endDate - Ngày kết thúc
 * @param {Object} session - MongoDB session (optional)
 * @returns {Array} - Danh sách EmployeeEarning đã tạo
 */
export const calculateEarningsForPeriod = async (employeeId, startDate, endDate, session = null) => {
    try {
        // Tìm tất cả Attendance đã check-out trong khoảng thời gian
        const attendances = await Attendance.find({
            employee_id: employeeId,
            check_out: { $exists: true, $ne: null },
            work_hours: { $gt: 0 },
            created_at: {
                $gte: startDate,
                $lte: endDate
            }
        })
        .populate({
            path: 'schedule_id',
            populate: { path: 'employee_id' }
        })
        .session(session || null)
        .sort({ check_out: 1 });

        const earnings = [];
        
        for (const attendance of attendances) {
            // Kiểm tra xem đã có earning chưa
            const existing = await EmployeeEarning.findOne({ attendance_id: attendance._id })
                .session(session || null);
            
            if (existing) {
                earnings.push(existing);
                continue;
            }

            const earning = await createEarningFromAttendance(attendance._id, session);
            if (earning) {
                earnings.push(earning);
            }
        }

        return earnings;
    } catch (error) {
        console.error(`Error calculating earnings for period:`, error);
        throw error;
    }
};

/**
 * Tính lương cho tất cả Attendance chưa có earning
 * @param {ObjectId} employeeId - ID của Employee (optional, nếu không có thì tính cho tất cả)
 * @param {Object} session - MongoDB session (optional)
 * @returns {Array} - Danh sách EmployeeEarning đã tạo
 */
export const calculateAllPendingEarnings = async (employeeId = null, session = null) => {
    try {
        const query = {
            check_out: { $exists: true, $ne: null },
            work_hours: { $gt: 0 }
        };

        if (employeeId) {
            query.employee_id = employeeId;
        }

        // Tìm tất cả Attendance đã check-out nhưng chưa có earning
        const attendances = await Attendance.find(query)
            .populate({
                path: 'schedule_id',
                populate: { path: 'employee_id' }
            })
            .session(session || null)
            .sort({ check_out: 1 });

        // Lấy danh sách attendance_id đã có earning
        const existingEarnings = await EmployeeEarning.find({
            attendance_id: { $in: attendances.map(a => a._id) }
        })
        .select('attendance_id')
        .session(session || null);

        const existingAttendanceIds = new Set(existingEarnings.map(e => e.attendance_id.toString()));

        const earnings = [];
        
        for (const attendance of attendances) {
            // Bỏ qua nếu đã có earning
            if (existingAttendanceIds.has(attendance._id.toString())) {
                continue;
            }

            const earning = await createEarningFromAttendance(attendance._id, session);
            if (earning) {
                earnings.push(earning);
            }
        }

        console.log(`Đã tạo ${earnings.length} earnings mới`);
        return earnings;
    } catch (error) {
        console.error(`Error calculating all pending earnings:`, error);
        throw error;
    }
};
