import { USER_EVENTS } from "../../../shared/events/userEvents.js";
import mongoose from "mongoose";
import { cache, makeCacheKey } from "../../../shared/utils/cache.js";

const MAP_ROLE = {
    manager: "Quản lý",
    receptionist: "Lễ tân",
    technician: "Kỹ thuật viên",
    customer_service: "Chăm sóc khách hàng",
    housekeeper: "Nhân viên buồng phòng",
    accountant: "Kế toán",
    it: "Nhân viên IT"
};

const MAP_WEEKDAY = {
    monday: "Thứ 2",
    tuesday: "Thứ 3",
    wednesday: "Thứ 4",
    thursday: "Thứ 5",
    friday: "Thứ 6",
    saturday: "Thứ 7",
    sunday: "Chủ nhật"
};

const MAP_SHIFT_TYPE = {
    morning: "sáng",
    afternoon: "chiều",
    night: "tối"
};

export class ScheduleService {
    constructor({ Schedule, Attendance, Shift, Employee, ScheduleContract,
        eventBus, sendNotification, sendNotificationsToUsers
     }) {
        this.Schedule = Schedule;
        this.Attendance = Attendance;
        this.Shift = Shift;
        this.Employee = Employee;
        this.ScheduleContract = ScheduleContract;
        this.eventBus = eventBus;
        this.sendNotification = sendNotification;
        this.sendNotificationsToUsers = sendNotificationsToUsers;
    }

    // helper

    findManagersByIds = async () => {
        const replyManager = await this.eventBus.safeRequest(
            USER_EVENTS.GET_MANAGERS
        );

        let managerUsers, managerUserIds;
    
        if (replyManager.success) {
            managerUsers = replyManager.admins;
            managerUserIds = managerUsers.map(u => u._id);
        } else {
            return { managerUsers: [], managerUserIds: [] };
        }

        return { managerUsers, managerUserIds };
    };

    // manager manages schedules and shifts of all employees
    
    async getAllSchedules(query = {}) {
        try {
            const { employee_id, work_date, work_day, shift_type,
                status, contract_status, raw } = query;

            const contractFilter = {};
            
            if (employee_id) contractFilter.employee_id = employee_id;
            
            contractFilter.status = contract_status ? contract_status : { $in: ["active", "pending"] };

            // contract based filtering 
            const contracts = await this.ScheduleContract.find(contractFilter)
                .populate("employee_id", "full_name phone_number position")
                .select("-__v");

            if (!contracts.length) return { count: 0, employees: [] };

            // for each contract, query its schedules
            const scheduleFilter = {};
            
            if (work_date) scheduleFilter.work_date = new Date(work_date);
            
            scheduleFilter.status = status ? status : { $in: ["pending", "approved"] };

            const weekOrder = ["monday","tuesday","wednesday","thursday","friday","saturday","sunday"];

            const employees = await Promise.all(
                contracts.map(async (contract) => {
                    let schedules = await this.Schedule.find({
                        ...scheduleFilter,
                        contract_id: contract._id,
                        employee_id: contract.employee_id._id,
                    })
                    .populate("shift_id", "work_day shift_type begin_time end_time")
                    .select("-__v -created_at -updated_at");

                    if (work_day) {
                        schedules = schedules.filter(s => s.shift_id?.work_day === work_day);
                    }
                    if (shift_type) {
                        schedules = schedules.filter(s => s.shift_id?.shift_type === shift_type);
                    }

                    schedules.sort((a, b) => {
                        const dateDiff = new Date(a.work_date) - new Date(b.work_date);
                        if (dateDiff !== 0) return dateDiff;
                        
                        const dayDiff = weekOrder.indexOf(a.shift_id?.work_day) - weekOrder.indexOf(b.shift_id?.work_day);
                        if (dayDiff !== 0) return dayDiff;
                        
                        return (a.shift_id?.begin_time ?? "").localeCompare(b.shift_id?.begin_time ?? "");
                    });

                    const contractInfo = {
                        _id:        contract._id,
                        status:     contract.status,
                        valid_from: contract.valid_from,
                        valid_to:   contract.valid_to,
                    };

                    const employeeInfo = {
                        employee_id:  contract.employee_id._id,
                        full_name:    contract.employee_id.full_name,
                        phone_number: contract.employee_id.phone_number,
                        role:         contract.role,
                        contract:     contractInfo,
                        total_schedules: schedules.length,
                    };

                    const mappedSchedules = schedules.map(s => ({
                        _id:        s._id,
                        shift_id:   s.shift_id._id,
                        shift_type: s.shift_id.shift_type,
                        work_day:   s.shift_id.work_day,
                        begin_time: s.shift_id.begin_time,
                        end_time:   s.shift_id.end_time,
                        work_date:  s.work_date,
                        status:     s.status,
                        note:       s.note,
                    }));

                    if (raw === "true") {
                        return { ...employeeInfo, schedules: mappedSchedules };
                    }

                    const by_weekday = schedules.reduce((acc, s) => {
                        const day = s.shift_id?.work_day;
                        if (!day) return acc;
                        if (!acc[day]) acc[day] = [];

                        acc[day].push({
                            _id:        s._id,
                            shift_id:   s.shift_id._id,
                            shift_type: s.shift_id.shift_type,
                            begin_time: s.shift_id.begin_time,
                            end_time:   s.shift_id.end_time,
                            work_date:  s.work_date,
                            status:     s.status,
                            note:       s.note,
                        });

                        return acc;
                    }, {});

                    const sortedByWeekday = {};
                    for (const day of weekOrder) {
                        if (by_weekday[day]) sortedByWeekday[day] = by_weekday[day];
                    }

                    return { ...employeeInfo, by_weekday: sortedByWeekday };
                })
            );

            const filtered = employees.filter(e =>
                (e.schedules?.length ?? 0) > 0 ||
                Object.keys(e.by_weekday ?? {}).length > 0
            );

            return {
                count: filtered.length,
                employees: filtered,
            };

        } catch (error) {
            console.log("Error while fetching schedules:", error);
            throw error;
        }
    }

    async getScheduleById (scheduleId) {
        try {
            const cacheKey = `schedule:one:${scheduleId}`;
            const cached = await cache.get(cacheKey);
            if (cached) return cached;

            const schedule = await this.Schedule.findById(scheduleId)
                .select("-__v -created_at -updated_at")
                .populate("employee_id", "full_name phone_number")
                .populate("contract_id", "status valid_from valid_to")
                .populate("shift_id", "work_day shift_type begin_time end_time");

            if (!schedule) {
                throw new Error("Không tìm thấy lịch làm việc.");
            }

            await cache.set(cacheKey, schedule, 120);
            return schedule;

        } catch (error) {
            console.log("Error while fetching schedule by ID:", error);
            throw error;
        }
    };

    async getContractById(contractId, query = {}) {
        try {
            const cacheKey = makeCacheKey(`contract:one:${contractId}`, query);
            const cached = await cache.get(cacheKey);
            if (cached) return cached;

            const { status, work_date } = query;

            const contract = await this.ScheduleContract.findById(contractId)
                .populate("employee_id", "full_name phone_number position")
                .populate("recurring_shifts.shift_id", "work_day shift_type begin_time end_time")
                .select("-__v");

            if (!contract) throw new Error("Không tìm thấy hợp đồng lịch làm việc.");

            // fetch all schedules belonging to this contract
            const scheduleFilter = { contract_id: contractId };
            scheduleFilter.status = status ? status : { $in: ["pending", "approved"] };

            // if work_date provided then only show that specific week
            if (work_date) {
                const ref = new Date(work_date);
                const dayIndex = ref.getUTCDay();
                const diffToMonday = dayIndex === 0 ? -6 : 1 - dayIndex;

                const monday = new Date(ref);
                monday.setUTCDate(ref.getUTCDate() + diffToMonday);
                monday.setUTCHours(0, 0, 0, 0);

                const sunday = new Date(monday);
                sunday.setUTCDate(monday.getUTCDate() + 6);
                sunday.setUTCHours(23, 59, 59, 999);

                scheduleFilter.work_date = { $gte: monday, $lte: sunday };
            }

            const schedules = await this.Schedule.find(scheduleFilter)
                .populate("shift_id", "work_day shift_type begin_time end_time")
                .select("-__v -created_at -updated_at")
                .sort({ work_date: 1 });

            // group by week and sort by weekday and begin_time within each week
            const weekOrder = ["monday","tuesday","wednesday","thursday","friday","saturday","sunday"];

            const getWeekKey = (date) => {
                const d = new Date(date);
                const dayIndex = d.getUTCDay();
                const diffToMonday = dayIndex === 0 ? -6 : 1 - dayIndex;
                const monday = new Date(d);
                monday.setUTCDate(d.getUTCDate() + diffToMonday);
                monday.setUTCHours(0, 0, 0, 0);
                return monday.toISOString().split("T")[0];
            };

            const by_week = {};
            for (const schedule of schedules) {
                const weekKey = getWeekKey(schedule.work_date);
                const day = schedule.shift_id?.work_day;
                if (!day) continue;

                if (!by_week[weekKey]) {
                    by_week[weekKey] = { week_start: weekKey, total_shifts: 0, by_weekday: {} };
                }
                if (!by_week[weekKey].by_weekday[day]) {
                    by_week[weekKey].by_weekday[day] = [];
                }

                by_week[weekKey].by_weekday[day].push({
                    _id:        schedule._id,
                    shift_id:   schedule.shift_id._id,
                    shift_type: schedule.shift_id.shift_type,
                    work_day:   schedule.shift_id.work_day,
                    begin_time: schedule.shift_id.begin_time,
                    end_time:   schedule.shift_id.end_time,
                    work_date:  schedule.work_date,
                    status:     schedule.status,
                    note:       schedule.note,
                });
                by_week[weekKey].total_shifts++;
            }

            // sort weekdays within each week
            for (const weekKey of Object.keys(by_week)) {
                const sortedByWeekday = {};
                for (const day of weekOrder) {
                    if (by_week[weekKey].by_weekday[day]) {
                        by_week[weekKey].by_weekday[day].sort((a, b) =>
                            (a.begin_time ?? "").localeCompare(b.begin_time ?? "")
                        );
                        sortedByWeekday[day] = by_week[weekKey].by_weekday[day];
                    }
                }
                by_week[weekKey].by_weekday = sortedByWeekday;
            }

            const contractResponse = {
                contract: {
                    _id:        contract._id,
                    status:     contract.status,
                    valid_from: contract.valid_from,
                    valid_to:   contract.valid_to,
                    note:       contract.note,
                    role:       contract.role,
                },

                employee: {
                    _id:          contract.employee_id._id,
                    full_name:    contract.employee_id.full_name,
                    phone_number: contract.employee_id.phone_number,
                    position:     contract.employee_id.position,
                },

                recurring_shifts: contract.recurring_shifts.map(rs => ({
                    work_day:   rs.work_day,
                    shift_id:   rs.shift_id._id,
                    shift_type: rs.shift_id.shift_type,
                    begin_time: rs.shift_id.begin_time,
                    end_time:   rs.shift_id.end_time,
                })),

                total_weeks:     Object.keys(by_week).length,
                total_schedules: schedules.length,
                by_week,
            };
            await cache.set(cacheKey, contractResponse, 120);
            return contractResponse;

        } catch (error) {
            console.log("Error while fetching contract by ID:", error);
            throw error;
        }
    }

    async updateScheduleContractStatus(contractId, data) {
        try {
            const { status, note } = data;

            if (!mongoose.Types.ObjectId.isValid(contractId))
                throw new Error("contractId không hợp lệ.");

            const validStatuses = ["approved", "rejected"];
            if (!validStatuses.includes(status))
                throw new Error("Quản lý chỉ có thể chấp nhận hoặc từ chối lịch làm việc.");

            if (status === "rejected" && (!note || note.trim() === ""))
                throw new Error("Vui lòng cung cấp lý do khi từ chối lịch làm việc.");

            const contract = await this.ScheduleContract.findById(contractId)
                .populate("employee_id", "_id user_id full_name");

            if (!contract)
                throw new Error("Không tìm thấy hợp đồng lịch làm việc.");
            
            if (contract.status === "cancelled")
                throw new Error("Hợp đồng này đã bị hủy.");
            
            if (contract.status !== "pending")
                throw new Error("Chỉ có thể duyệt hợp đồng đang ở trạng thái chờ duyệt.");

            // find all pending schedules belonging to this contract
            const pendingSchedules = await this.Schedule.find({
                contract_id: contractId,
                status: "pending",
            });

            if (pendingSchedules.length === 0)
                throw new Error("Không có ca làm nào đang chờ duyệt trong hợp đồng này.");

            // update all schedules at once
            await this.Schedule.updateMany(
                { contract_id: contractId, status: "pending" },
                { status, ...(note && { note }) }
            );

            // sync contract status
            if (status === "approved") {
                await this.ScheduleContract.findByIdAndUpdate(contractId, {
                    status: "active"
                });
            } else if (status === "rejected") {
                await this.ScheduleContract.findByIdAndUpdate(contractId, {
                    status: "cancelled",
                    ...(note && { note }),
                });
            }

            const updatedContract = await this.ScheduleContract.findById(contractId);
            const updatedSchedules = await this.Schedule.find({ contract_id: contractId });

            // send notification 
            try {
                const employee = contract.employee_id;

                await this.sendNotification({
                    userId: employee.user_id,
                    title: status === "approved"
                        ? "Lịch làm việc của bạn đã được duyệt"
                        : "Lịch làm việc của bạn bị từ chối",
                    content: status === "approved"
                        ? `${pendingSchedules.length} ca làm của bạn đã được quản lý chấp thuận.`
                        : `${pendingSchedules.length} ca làm của bạn đã bị từ chối. Lý do: ${note}`,
                    type: "schedule",
                    kind: "ScheduleContract",
                    refId: contractId,
                });

            } catch (notifError) {
                console.error("Error sending notification:", notifError);
            }

            await Promise.all([
                cache.delByPattern(`contract:one:${contractId}:*`),
                cache.delByPattern("schedule:my:*"),
                cache.delByPattern("schedule:pending:*"),
            ]);
            return {
                contract: updatedContract,
                updated_count:  pendingSchedules.length,
                schedules:      updatedSchedules,
            };

        } catch (error) {
            console.log("Error while updating schedule contract status:", error);
            throw error;
        }
    }

    // shifts

    async createShift (data) {
        try {
            const { work_day, shift_type, begin_time, end_time, required_staff } = data;

            if (!work_day || !shift_type || !begin_time || !end_time || !required_staff) {
                throw new Error("Vui lòng nhập đầy đủ thông tin bắt buộc!");
            }

            const validDays = ["monday","tuesday","wednesday","thursday","friday","saturday","sunday"];
            if (!validDays.includes(work_day))
                throw new Error("Ngày trong tuần không hợp lệ.");

            const validTypes = ["morning","afternoon","night"];
            if (!validTypes.includes(shift_type))
                throw new Error("Loại ca làm không hợp lệ.");

            const timeRegex = /^([01]\d|2[0-3]):([0-5]\d)$/;
            if (!timeRegex.test(begin_time))
                throw new Error("Thời gian bắt đầu không hợp lệ. Định dạng đúng: HH:mm");

            if (!timeRegex.test(end_time))
                throw new Error("Thời gian kết thúc không hợp lệ. Định dạng đúng: HH:mm");

            const validRoles = ["receptionist","technician","customer_service","housekeeper","manager","accountant","it"];
            if (required_staff) {
                for (const [role, count] of Object.entries(required_staff)) {
                    if (!validRoles.includes(role))
                        throw new Error(`Vị trí "${role}" không hợp lệ.`);
                    if (typeof count !== "number" || count < 0 || !Number.isInteger(count))
                        throw new Error(`Số lượng nhân viên cho vị trí "${role}" phải >= 0.`);
                }
            }

            const existing = await this.Shift.findOne({ work_day, shift_type });
            if (existing)
                throw new Error("Đã tồn tại loại ca làm này trong cùng ngày.");

            const shift = await this.Shift.create({ work_day, shift_type, begin_time, end_time, required_staff });

            await cache.delByPattern("shift:list:*");
            return shift;

        } catch (error) {
            console.log("Error while creating shift:", error);
            throw error;
        }
    };
    
    async getAllShifts(query = {}) {
        try {
            const cacheKey = makeCacheKey("shift:list", query);
            const cached = await cache.get(cacheKey);
            if (cached) return cached;

            const { work_day, shift_type } = query;

            const filter = {};
            if (work_day) {
                const validDays = ["monday","tuesday","wednesday","thursday","friday","saturday","sunday"];
                if (!validDays.includes(work_day))
                    throw new Error("work_day không hợp lệ.");
                filter.work_day = work_day;
            }
            if (shift_type) {
                const validTypes = ["morning","afternoon","night"];
                if (!validTypes.includes(shift_type))
                    throw new Error("shift_type không hợp lệ.");
                filter.shift_type = shift_type;
            }

            const shifts = await this.Shift.find(filter)
                .select("-__v -created_at -updated_at")
                .sort({ work_day: 1, begin_time: 1 });

            const weekOrder = ["monday","tuesday","wednesday","thursday","friday","saturday","sunday"];
            shifts.sort((a, b) => {
                const dayDiff = weekOrder.indexOf(a.work_day) - weekOrder.indexOf(b.work_day);
                if (dayDiff !== 0) return dayDiff;
                return a.begin_time.localeCompare(b.begin_time);
            });

            const shiftsResponse = { count: shifts.length, shifts };
            await cache.set(cacheKey, shiftsResponse, 600);
            return shiftsResponse;

        } catch (error) {
            console.log("Error while fetching shifts:", error);
            throw error;
        }
    }

    async getShiftById(shiftId) {
        try {
            const cacheKey = `shift:one:${shiftId}`;
            const cached = await cache.get(cacheKey);
            if (cached) return cached;

            const shift = await this.Shift.findById(shiftId)
                .select("-__v -created_at -updated_at");

            if (!shift) throw new Error("Không tìm thấy ca làm.");

            await cache.set(cacheKey, shift, 600);
            return shift;

        } catch (error) {
            console.log("Error while fetching shift by ID:", error);
            throw error;
        }
    }

    async updateShift(shiftId, data) {
        try {
            const { work_day, shift_type, begin_time, end_time, required_staff } = data;

            const shift = await this.Shift.findById(shiftId);
            if (!shift) throw new Error("Không tìm thấy ca làm.");

            const validDays = ["monday","tuesday","wednesday","thursday","friday","saturday","sunday"];
            if (work_day && !validDays.includes(work_day))
                throw new Error("work_day không hợp lệ.");

            const validTypes = ["morning","afternoon","night"];
            if (shift_type && !validTypes.includes(shift_type))
                throw new Error("shift_type không hợp lệ.");

            const timeRegex = /^([01]\d|2[0-3]):([0-5]\d)$/;
            if (begin_time && !timeRegex.test(begin_time))
                throw new Error("begin_time không hợp lệ. Định dạng đúng: HH:mm");
            if (end_time && !timeRegex.test(end_time))
                throw new Error("end_time không hợp lệ. Định dạng đúng: HH:mm");

            const validRoles = ["receptionist","technician","customer_service","housekeeper","manager","accountant","it"];
            if (required_staff) {
                for (const [role, count] of Object.entries(required_staff)) {
                    if (!validRoles.includes(role))
                        throw new Error(`Vị trí "${role}" không hợp lệ.`);
                    if (typeof count !== "number" || count < 0 || !Number.isInteger(count))
                        throw new Error(`Số lượng nhân viên cho vị trí "${role}" phải >= 0.`);
                }
            }

            const targetDay  = work_day  ?? shift.work_day;
            const targetType = shift_type ?? shift.shift_type;
            const duplicate = await this.Shift.findOne({
                _id:        { $ne: shiftId },
                work_day:   targetDay,
                shift_type: targetType,
            });
            if (duplicate)
                throw new Error(`Ca ${targetType} ngày ${targetDay} đã tồn tại.`);

            const today = new Date();
            today.setHours(0, 0, 0, 0);
            const activeScheduleCount = await this.Schedule.countDocuments({
                shift_id: shiftId,
                work_date: { $gte: today },
                status: { $in: ["pending", "approved"] },
            });
            if (activeScheduleCount > 0)
                throw new Error(
                    `Không thể chỉnh sửa ca làm này vì có ${activeScheduleCount} lịch làm việc đang hoạt động. ` +
                    `Vui lòng hủy các lịch làm việc liên quan trước.`
                );

            const updated = await this.Shift.findByIdAndUpdate(
                shiftId,
                { work_day, shift_type, begin_time, end_time,
                ...(required_staff && { required_staff }) },
                { new: true, runValidators: true }
            );

            await Promise.all([
                cache.del(`shift:one:${shiftId}`),
                cache.delByPattern("shift:list:*"),
            ]);
            return updated;

        } catch (error) {
            console.log("Error while updating shift:", error);
            throw error;
        }
    }

    async deleteShift(shiftId) {
        try {
            const shift = await this.Shift.findById(shiftId);
            if (!shift) throw new Error("Không tìm thấy ca làm.");

            const today = new Date();
            today.setHours(0, 0, 0, 0);
            const activeScheduleCount = await this.Schedule.countDocuments({
                shift_id: shiftId,
                work_date: { $gte: today },
                status: { $in: ["pending", "approved"] },
            });
            if (activeScheduleCount > 0)
                throw new Error(
                    `Không thể xóa ca làm này vì có ${activeScheduleCount} lịch làm việc đang hoạt động. ` +
                    `Vui lòng hủy các lịch làm việc liên quan trước.`
                );

            const activeContractCount = await this.ScheduleContract.countDocuments({
                "recurring_shifts.shift_id": shiftId,
                status: "active",
            });
            if (activeContractCount > 0)
                throw new Error(
                    `Không thể xóa ca làm này vì có ${activeContractCount} hợp đồng lịch định kỳ đang sử dụng. ` +
                    `Vui lòng hủy các hợp đồng liên quan trước.`
                );

            await this.Shift.findByIdAndDelete(shiftId);

            await Promise.all([
                cache.del(`shift:one:${shiftId}`),
                cache.delByPattern("shift:list:*"),
            ]);
            return { success: true };

        } catch (error) {
            console.log("Error while deleting shift:", error);
            throw error;
        }
    }

    // employee manages their own schedule

    async registerSchedule (employeeUserId, data) {
        try {
            const { shifts, repeat = true, valid_from, valid_to } = data;

            if (!Array.isArray(shifts) || shifts.length === 0) {
                throw new Error("Vui lòng gửi danh sách các ca làm để đăng ký.");
            }

            for (const entry of shifts) {
                if (!entry.shift_id || !entry.work_date)
                    throw new Error("Mỗi ca làm phải có shift_id và work_date.");
                
                if (new Date(entry.work_date) <= new Date())
                    throw new Error(`Không được đăng ký ca làm ở ngày trong quá khứ: ${entry.work_date}`);
            }

            const employee = await this.Employee.findOne({ user_id: employeeUserId });
            if (!employee) {
                throw new Error("Không tìm thấy nhân viên.");
            }
            const role = employee.position;

            // create schedule contract if repeat = true
            let contract = null;
            let recurring_shifts = [];
            if (repeat) {
                if (!valid_from || !valid_to)
                    throw new Error("Vui lòng cung cấp ngày bắt đầu và ngày dự kiến kết thúc cho lịch lặp lại.");

                if (new Date(valid_to) <= new Date(valid_from))
                    throw new Error("Ngày dự kiến kết thúc phải sau ngày bắt đầu.");

                const shiftIds = shifts.map(e => e.shift_id);
                const shiftDocs = await this.Shift.find({ _id: { $in: shiftIds } });

                if (shiftDocs.length !== shiftIds.length)
                    throw new Error("Một số shift_id không tồn tại.");

                recurring_shifts = shiftDocs.map(s => ({
                    shift_id: s._id,
                    work_day: s.work_day,
                }));
            }

            const createdSchedules = [];
            for (const { shift_id, work_date } of shifts) {

                const shift = await this.Shift.findById(shift_id);
                if (!shift) {
                    throw new Error(`Ca làm ${shift_id} không tồn tại.`);
                }

                const dayOfWeek = new Date(work_date)
                    .toLocaleDateString("en-US", { weekday: "long", timeZone: "UTC" })
                    .toLowerCase();
                if (dayOfWeek !== shift.work_day)
                    throw new Error(
                        `Ngày ${work_date} là ${MAP_WEEKDAY[dayOfWeek]}, không khớp với ca làm yêu cầu ngày ${MAP_WEEKDAY[shift.work_day]}.`
                    );

                const requiredCount = shift.required_staff[role];
                if (!requiredCount || requiredCount === undefined) {
                    throw new Error(`Ca làm này không yêu cầu vị trí "${MAP_ROLE[role]}".`);
                }

                const currentCount = await this.Schedule.countDocuments({
                    shift_id: shift_id, 
                    work_date: new Date(work_date), 
                    role,
                    status: { $in: ["pending", "approved"] }
                });
                if (currentCount >= requiredCount)
                    throw new Error(`Ca ${MAP_WEEKDAY[shift.work_day]} ${MAP_SHIFT_TYPE[shift.shift_type]} đã đủ người đăng ký.`);

                const exists = await this.Schedule.findOne({
                    employee_id: employee._id,
                    shift_id: shift_id,
                    work_date: new Date(work_date),
                    status: { $in: ["pending", "approved"] }
                });

                if (exists) {
                    createdSchedules.push({ ...exists.toObject(), skipped: true });
                    continue;
                }

                if (repeat && !contract) {
                    contract = await this.ScheduleContract.create({
                        employee_id: employee._id,
                        recurring_shifts,
                        role,
                        valid_from: new Date(valid_from),
                        valid_to:   new Date(valid_to),
                        last_generated_week: new Date(shifts[0].work_date),
                    });
                }

                const createdSchedule = await this.Schedule.create({ 
                    contract_id: contract?._id ?? null,
                    employee_id: employee._id, 
                    shift_id: shift_id, 
                    work_date: new Date(work_date), 
                    role 
                });
                createdSchedules.push(createdSchedule);
            }

            // Send notifications
            try {
                const newlyCreated = createdSchedules.filter(s => !s.skipped);

                if (newlyCreated.length > 0) {
                    const { managerUserIds } = await this.findManagersByIds();

                    if (managerUserIds.length > 0) {
                        await this.sendNotificationsToUsers({
                            userIds: managerUserIds,
                            title: "Nhân viên vừa đăng ký lịch làm việc mới",
                            content: `Nhân viên với ID: #${employee._id.toString().slice(-6)} vừa đăng ký ${newlyCreated.length} ca làm mới. Vui lòng kiểm tra và phê duyệt.`,
                            type: "schedule",
                            kind: "Schedule",
                            refId: newlyCreated[0]._id 
                        });
                    }

                    await this.sendNotification({
                        userId: employeeUserId,
                        title: "Lịch làm việc mới đã được đăng ký",
                        content: `Bạn vừa đăng ký thành công ${newlyCreated.length} ca làm. Vui lòng chờ phê duyệt từ quản lý.`,
                        type: "schedule",
                        kind: "Schedule",
                        refId: newlyCreated[0]._id
                    });

                    console.log("Notifications sent for schedule registration.");
                }

            } catch (notifError) {
                console.error("Error sending notification:", notifError);
            }

            await Promise.all([
                cache.delByPattern("schedule:my:*"),
                cache.delByPattern("schedule:pending:*"),
            ]);
            return { contract, schedules: createdSchedules };

        } catch (err) {
            console.log("Error while employee registering schedule:", err.message);
            throw err;
        }
    };

    async viewMySchedule(employeeUserId, query = {}) {
        try {
            const cacheKey = makeCacheKey(`schedule:my:${employeeUserId}`, query);
            const cached = await cache.get(cacheKey);
            if (cached) return cached;

            const { work_date, status, shift_type } = query;

            const employee = await this.Employee.findOne({ user_id: employeeUserId });
            if (!employee) throw new Error("Không tìm thấy nhân viên.");
            const employee_id = employee._id;

            // find pending/active contract to determine schedule scope
            const contract = await this.ScheduleContract.findOne({
                employee_id,
                status: { $in: ["active", "pending"] },
            });

            // then build schedule filter
            const scheduleFilter = { employee_id };
            scheduleFilter.status = status ? status : { $in: ["pending", "approved"] };

            if (work_date) {
                const ref = new Date(work_date);
                const dayIndex = ref.getUTCDay();
                const diffToMonday = dayIndex === 0 ? -6 : 1 - dayIndex;

                const monday = new Date(ref);
                monday.setUTCDate(ref.getUTCDate() + diffToMonday);
                monday.setUTCHours(0, 0, 0, 0);

                const sunday = new Date(monday);
                sunday.setUTCDate(monday.getUTCDate() + 6);
                sunday.setUTCHours(23, 59, 59, 999);

                scheduleFilter.work_date = { $gte: monday, $lte: sunday };
            }

            if (contract) scheduleFilter.contract_id = contract._id;

            // fetch all schedules
            let schedules = await this.Schedule.find(scheduleFilter)
                .populate("shift_id", "work_day shift_type begin_time end_time")
                .select("-__v -created_at -updated_at")
                .sort({ work_date: 1 });

            if (shift_type) {
                schedules = schedules.filter(s => s.shift_id?.shift_type === shift_type);
            }

            if (!schedules.length) {
                return {
                    contract: null,
                    total_weeks: 0,
                    total_schedules: 0,
                    by_week: {},
                };
            }

            // group by week
            const weekOrder = ["monday","tuesday","wednesday","thursday","friday","saturday","sunday"];

            const getWeekKey = (date) => {
                const d = new Date(date);
                const dayIndex = d.getUTCDay();
                const diffToMonday = dayIndex === 0 ? -6 : 1 - dayIndex;
                const monday = new Date(d);
                monday.setUTCDate(d.getUTCDate() + diffToMonday);
                monday.setUTCHours(0, 0, 0, 0);
                return monday.toISOString().split("T")[0]; // e.g. "2025-06-02"
            };

            const by_week = {};

            for (const schedule of schedules) {
                const weekKey = getWeekKey(schedule.work_date);
                const day = schedule.shift_id?.work_day;
                if (!day) continue;

                if (!by_week[weekKey]) {
                    by_week[weekKey] = {
                        week_start: weekKey,
                        total_shifts: 0,
                        by_weekday: {},
                    };
                }
                if (!by_week[weekKey].by_weekday[day]) {
                    by_week[weekKey].by_weekday[day] = [];
                }

                by_week[weekKey].by_weekday[day].push({
                    _id:        schedule._id,
                    shift_id:   schedule.shift_id._id,
                    shift_type: schedule.shift_id.shift_type,
                    work_day:   schedule.shift_id.work_day,
                    begin_time: schedule.shift_id.begin_time,
                    end_time:   schedule.shift_id.end_time,
                    work_date:  schedule.work_date,
                    status:     schedule.status,
                    note:       schedule.note,
                });

                by_week[weekKey].total_shifts++;
            }

            // sort weekdays within each week
            for (const weekKey of Object.keys(by_week)) {
                const sortedByWeekday = {};
                for (const day of weekOrder) {
                    if (by_week[weekKey].by_weekday[day]) {
                        // sort by begin_time within same day
                        by_week[weekKey].by_weekday[day].sort((a, b) =>
                            (a.begin_time ?? "").localeCompare(b.begin_time ?? "")
                        );
                        sortedByWeekday[day] = by_week[weekKey].by_weekday[day];
                    }
                }
                by_week[weekKey].by_weekday = sortedByWeekday;
            }

            const myScheduleResponse = {
                contract,
                total_weeks: Object.keys(by_week).length,
                total_schedules: schedules.length,
                by_week,
            };
            await cache.set(cacheKey, myScheduleResponse, 120);
            return myScheduleResponse;

        } catch (error) {
            console.log("Error while employee fetching schedule:", error);
            throw error;
        }
    }

    // should not use this
    async updateSchedule(scheduleId, employeeUserId, data) {
        try {
            const { shift_id, work_date } = data;

            const theEmployee = await this.Employee.findOne({ user_id: employeeUserId });
            if (!theEmployee) throw new Error("Không tìm thấy nhân viên.");
            
            const employee_id = theEmployee._id;
            const role = theEmployee.position;

            const existingSchedule = await this.Schedule.findById(scheduleId);
            if (!existingSchedule) 
                throw new Error("Không tìm thấy lịch làm việc để cập nhật.");
            
            if (existingSchedule.employee_id.toString() !== employee_id.toString())
                throw new Error("Bạn không có quyền chỉnh sửa lịch làm việc này.");

            if (existingSchedule.status !== "pending")
                throw new Error("Chỉ có thể chỉnh sửa lịch làm đang chờ phê duyệt.");

            const targetDate = work_date ?? existingSchedule.work_date;
            if (new Date(targetDate) <= new Date())
                throw new Error("Không được chỉnh sửa ca làm ở ngày trong quá khứ.");

            const shift = await this.Shift.findById(shift_id);
            if (!shift) 
                throw new Error("Không tìm thấy ca làm.");

            const requiredCount = shift.required_staff[role];
            if (!requiredCount) 
                throw new Error(`Ca làm này không yêu cầu vị trí "${MAP_ROLE[role]}".`);

            const currentCount = await this.Schedule.countDocuments({
                _id: { $ne: scheduleId }, 
                shift_id,
                work_date: targetDate,
                role,
            });

            if (currentCount >= requiredCount)
                throw new Error(`Ca ${shift.work_day} ${shift.shift_type} đã đủ người đăng ký.`);

            const duplicate = await this.Schedule.findOne({
                _id: { $ne: scheduleId },
                employee_id,
                shift_id,
                work_date: targetDate,
            });

            if (duplicate) throw new Error("Nhân viên đã đăng ký ca làm này rồi.");

            const updated = await this.Schedule.findByIdAndUpdate(
                scheduleId,
                { shift_id, work_date: targetDate, role },
                { new: true }
            );

            await Promise.all([
                cache.del(`schedule:one:${scheduleId}`),
                cache.delByPattern("schedule:my:*"),
            ]);
            return updated;

        } catch (error) {
            console.log("Error while updating schedule:", error);
            throw error;
        }
    }

    // call this when employee wants to cancel a registered shift
    async deleteSchedule (employeeUserId, scheduleId) {
        try {
            const employee = await this.Employee.findOne({ user_id: employeeUserId });
            if (!employee) {
                throw new Error("Không tìm thấy nhân viên.");
            }
            const employee_id = employee._id;
            
            if (!mongoose.Types.ObjectId.isValid(scheduleId))
                throw new Error("scheduleId không hợp lệ.");

            const schedule = await this.Schedule.findOne({ _id: scheduleId, employee_id: employee_id });
            if (!schedule) {
                throw new Error("Không tìm thấy lịch làm việc tương ứng của nhân viên để xóa.");
            }

            if (!["pending", "approved"].includes(schedule.status))
                throw new Error("Chỉ có thể hủy lịch làm đang chờ duyệt hoặc đã được duyệt.");

            if (new Date(schedule.work_date) <= new Date())
                throw new Error("Không thể hủy ca làm trong quá khứ.");

            await this.Schedule.findByIdAndUpdate(scheduleId, { $set: { status: "cancelled" } } );

            // Send notifications
            try {
                const { managerUserIds } = await this.findManagersByIds();

                if (managerUserIds.length > 0) {
                    await this.sendNotificationsToUsers({
                        userIds: managerUserIds,
                        title: "Nhân viên vừa hủy lịch làm việc",
                        content: `Nhân viên với ID: #${employee._id.toString().slice(-6)} vừa hủy 1 ca làm.`,
                        type: "schedule",
                        kind: "Schedule",
                        refId: scheduleId
                    });
                }

                await this.sendNotification({
                    userId: employeeUserId,
                    title: "Ca làm đã được hủy",
                    content: `Ca làm của bạn đã được hủy thành công.`,
                    type: "schedule",
                    kind: "Schedule",
                    refId: scheduleId
                });

                console.log("Notifications sent for schedule cancellation.");

            } catch (notifError) {
                console.error("Error sending notification:", notifError);
            }

            await Promise.all([
                cache.del(`schedule:one:${scheduleId}`),
                cache.delByPattern("schedule:my:*"),
                cache.delByPattern("schedule:pending:*"),
            ]);
            return {
                success: true,
                has_contract: !!schedule.contract_id,
                contract_id: schedule.contract_id,
            };

        } catch (err) {
            console.log("Error while employee delete schedule:", err.message);
            throw err;
        }
    };

    // after employee chooses to delete an existed shift, ask if she want to cancel the upcoming shifts in the same schedule contract 
    // if yes, call this function to cancel all the upcoming shifts in the same schedule contract
    async cancelContract(employeeUserId, contractId, data = {}) {
        try {
            const { keep_approved_schedules = false } = data;
            // keep_approved_schedules: false (default) → hủy tất cả schedule tương lai kể cả approved
            // keep_approved_schedules: true → chỉ hủy pending, giữ lại approved

            const employee = await this.Employee.findOne({ user_id: employeeUserId });
            if (!employee) throw new Error("Không tìm thấy nhân viên.");

            if (!mongoose.Types.ObjectId.isValid(contractId))
                throw new Error("contractId không hợp lệ.");

            const contract = await this.ScheduleContract.findById(contractId);
            if (!contract)
                throw new Error("Không tìm thấy hợp đồng lịch làm việc.");

            if (contract.employee_id.toString() !== employee._id.toString())
                throw new Error("Bạn không có quyền hủy hợp đồng này.");

            if (contract.status === "cancelled")
                throw new Error("Hợp đồng này đã bị hủy trước đó.");

            if (contract.status === "expired")
                throw new Error("Hợp đồng này đã hết hạn, không cần hủy.");

            await this.ScheduleContract.findByIdAndUpdate(contractId, { status: "cancelled" });

            const today = new Date();
            today.setHours(0, 0, 0, 0);

            const statusFilter = keep_approved_schedules
                ? { $in: ["pending"] }
                : { $in: ["pending", "approved"] };

            const result = await this.Schedule.updateMany(
                {
                    contract_id: contractId,
                    employee_id: employee._id,
                    work_date: { $gt: today },
                    status: statusFilter,
                },
                { status: "cancelled" }
            );
            const cancelledCount = result.modifiedCount;

            try {
                const { managerUserIds } = await this.findManagersByIds();

                if (managerUserIds.length > 0) {
                    await this.sendNotificationsToUsers({
                        userIds: managerUserIds,
                        title: "Nhân viên vừa hủy lịch làm việc định kỳ",
                        content: keep_approved_schedules
                            ? `Nhân viên #${employee._id.toString().slice(-6)} vừa hủy lịch định kỳ, giữ lại ${cancelledCount === 0 ? "các" : ""} ca đã được duyệt.`
                            : `Nhân viên #${employee._id.toString().slice(-6)} vừa hủy lịch định kỳ và ${cancelledCount} ca làm tương lai.`,
                        type: "schedule",
                        kind: "ScheduleContract",
                        refId: contractId,
                    });
                }

                await this.sendNotification({
                    userId: employeeUserId,
                    title: "Lịch làm việc định kỳ đã được hủy",
                    content: keep_approved_schedules
                        ? `Lịch định kỳ của bạn đã được hủy. Các ca đã được duyệt vẫn được giữ nguyên.`
                        : `Lịch định kỳ và ${cancelledCount} ca làm tương lai của bạn đã được hủy thành công.`,
                    type: "schedule",
                    kind: "ScheduleContract",
                    refId: contractId,
                });
            } catch (notifError) {
                console.error("Error sending notification:", notifError);
            }

            await Promise.all([
                cache.delByPattern(`contract:one:${contractId}:*`),
                cache.delByPattern("schedule:my:*"),
                cache.delByPattern("schedule:pending:*"),
            ]);
            return {
                success: true,
                cancelled_schedules_count: cancelledCount,
                keep_approved_schedules,
            };

        } catch (error) {
            console.log("Error while cancelling work contract:", error);
            throw error;
        }
    }

    // views available shifts on employee's schedule screen
    async getAvailableShifts(employeeUserId, query = {}) {
        try {
            const { work_date } = query;

            // validation
            if (!work_date) work_date = new Date().toISOString().slice(0, 10); // default to today
            const referenceDate = new Date(work_date);
            
            if (isNaN(referenceDate)) 
                throw new Error("work_date không hợp lệ.");

            if (referenceDate <= new Date()) 
                throw new Error("Không thể xem ca làm trống cho ngày trong quá khứ.");

            const employee = await this.Employee.findOne({ user_id: employeeUserId });
            if (!employee) throw new Error("Không tìm thấy nhân viên.");
            
            const employee_id = employee._id;
            const role = employee.position;

            // get the week contains work_date
            const dayOfWeekIndex = referenceDate.getUTCDay();
            const diffToMonday = dayOfWeekIndex === 0 ? -6 : 1 - dayOfWeekIndex;

            const monday = new Date(referenceDate);
            monday.setUTCDate(referenceDate.getUTCDate() + diffToMonday);
            monday.setUTCHours(0, 0, 0, 0);

            const sunday = new Date(monday);
            sunday.setUTCDate(monday.getUTCDate() + 6);
            sunday.setUTCHours(23, 59, 59, 999);

            const weekOrder = ["monday","tuesday","wednesday","thursday","friday","saturday","sunday"];

            // map weekday name -> actual Date of that day in this week
            const weekDates = {};
            for (let i = 0; i < 7; i++) {
                const d = new Date(monday);
                d.setUTCDate(monday.getUTCDate() + i);
                weekDates[weekOrder[i]] = d;
            }

            const existingContract = await this.ScheduleContract.findOne({
                employee_id,
                status: { $in: ["active", "pending"] },
                valid_from: { $lte: sunday },
                valid_to:   { $gte: monday },
            });

            // get all shifts of the week then group by work_day 
            const allShifts = await this.Shift.find({}).lean();

            const shiftsByDay = allShifts.reduce((acc, shift) => {
                if (!acc[shift.work_day]) acc[shift.work_day] = [];
                acc[shift.work_day].push(shift);
                return acc;
            }, {});

            // build result grouped by weekday
            const by_weekday = {};

            for (const day of weekOrder) {
                const dayDate = weekDates[day];
                const dayShifts = shiftsByDay[day] ?? [];

                if (dayDate <= new Date()) {
                    by_weekday[day] = {
                        date: dayDate,
                        disabled: true,
                        reason: "Ngày này đã qua.",
                        shifts: [],
                    };
                    continue;
                }

                const shifts = await Promise.all(
                    dayShifts.map(async (shift) => {
                        const shift_id = shift._id;
                        const disabledReasons = [];

                        const requiredCount = shift.required_staff?.[role] ?? 0;
                        if (!requiredCount) {
                            return {
                                ...shift,
                                slot_info: null,
                                disabled: true,
                                reasons: [`Ca làm này không yêu cầu vị trí "${MAP_ROLE[role]}".`],
                            };
                        }

                        const [approvedCount, pendingCount] = await Promise.all([
                            this.Schedule.countDocuments({ shift_id, role, work_date: dayDate, status: "approved" }),
                            this.Schedule.countDocuments({ shift_id, role, work_date: dayDate, status: "pending" }),
                        ]);

                        const effectiveFilled = approvedCount + pendingCount;
                        if (effectiveFilled >= requiredCount) {
                            disabledReasons.push(`Ca làm đã đủ ${requiredCount} nhân viên vị trí "${MAP_ROLE[role]}".`);
                        }

                        const employeeSchedule = await this.Schedule.findOne({
                            employee_id, shift_id,
                            work_date: dayDate,
                            status: { $in: ["pending", "approved"] },
                        });

                        if (employeeSchedule) {
                            if (employeeSchedule.status === "approved") {
                                disabledReasons.push("Bạn đã được xếp vào ca làm này.");
                            } else if (employeeSchedule.status === "pending") {
                                disabledReasons.push("Bạn đã đăng ký ca làm này và đang chờ phê duyệt.");
                            }
                            // rejected/cancelled → allow re-registering
                        }

                        // check if this shift is already covered by employee's contract
                        const coveredByContract = existingContract
                            ? existingContract.recurring_shifts.some(
                                rs => rs.shift_id.toString() === shift_id.toString()
                                    && rs.work_day === day
                            )
                            : false;

                        if (coveredByContract) {
                            disabledReasons.push("Ca này đã nằm trong lịch định kỳ của bạn.");
                        }

                        return {
                            ...shift,
                            slot_info: {
                                required:  requiredCount,
                                approved:  approvedCount,
                                pending:   pendingCount,
                                remaining: Math.max(0, requiredCount - effectiveFilled),
                            },
                            covered_by_contract: coveredByContract,
                            disabled: disabledReasons.length > 0,
                            reasons:  disabledReasons,
                        };
                    })
                );

                by_weekday[day] = {
                    date:   dayDate,
                    shifts: shifts,
                };
            }

            return {
                week_start: monday,
                week_end:   sunday,
                has_contract: !!existingContract,
                contract: existingContract
                    ? {
                        _id:        existingContract._id,
                        status:     existingContract.status,
                        valid_from: existingContract.valid_from,
                        valid_to:   existingContract.valid_to,
                    }
                    : null,
                by_weekday,
            };

        } catch (error) {
            console.log("Error while getting available shifts:", error.message);
            throw error;
        }
    }

    // views pending schedules on manager's schedule management screen
    async getPendingScheduleRequests(query = {}) {
        try {
            const cacheKey = makeCacheKey("schedule:pending", query);
            const cached = await cache.get(cacheKey);
            if (cached) return cached;

            const { role } = query;

            const contractFilter = { status: "pending" };
            if (role) contractFilter.role = role;

            const pendingContracts = await this.ScheduleContract.find(contractFilter)
                .populate("employee_id", "full_name phone_number position")
                .populate("recurring_shifts.shift_id", "work_day shift_type begin_time end_time")
                .select("-__v")
                .sort({ created_at: 1 });

            if (!pendingContracts.length) return { count: 0, requests: [] };

            // get pending schedules for each contract
            const requests = await Promise.all(
                pendingContracts.map(async (contract) => {
                    const pendingSchedules = await this.Schedule.find({
                        contract_id: contract._id,
                        status: "pending",
                    })
                    .populate("shift_id", "work_day shift_type begin_time end_time")
                    .select("-__v -created_at -updated_at")
                    .sort({ work_date: 1 });

                    return {
                        contract: {
                            contract_id:  contract._id,
                            status:       contract.status,
                            valid_from:   contract.valid_from,
                            valid_to:     contract.valid_to,
                            registered_at: contract.created_at,
                        },
                        employee_info: {
                            employee_id:  contract.employee_id._id,
                            full_name:    contract.employee_id.full_name,
                            phone_number: contract.employee_id.phone_number,
                            role:         contract.role,
                        },
                        recurring_shifts: contract.recurring_shifts.map(rs => ({
                            work_day:   rs.shift_id.work_day,
                            shift_type: rs.shift_id.shift_type,
                            begin_time: rs.shift_id.begin_time,
                            end_time:   rs.shift_id.end_time,
                        })),

                        total_pending: pendingSchedules.length,

                        schedules: pendingSchedules.map(s => ({
                            _id:        s._id,
                            work_date:  s.work_date,
                            work_day:   s.shift_id.work_day,
                            shift_type: s.shift_id.shift_type,
                            begin_time: s.shift_id.begin_time,
                            end_time:   s.shift_id.end_time,
                        })),
                    };
                })
            );

            const pendingResponse = { count: requests.length, requests };
            await cache.set(cacheKey, pendingResponse, 60);
            return pendingResponse;

        } catch (error) {
            console.log("Error while fetching pending schedule requests:", error);
            throw error;
        }
    }
}