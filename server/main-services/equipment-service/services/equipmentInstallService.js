import mongoose from "mongoose";
import { EMPLOYEE_EVENTS } from "../../../shared/events/employeeEvents.js";
import { ROOM_EVENTS } from "../../../shared/events/roomEvents.js";
import { USER_EVENTS } from "../../../shared/events/userEvents.js";
import { cache, makeCacheKey } from "../../../shared/utils/cache.js";

export class EquipmentInstallService {
    constructor({ Equipment, EquipmentCategory, EquipmentLog, InstallTicket, 
        InstallDetail, eventBus, sendNotification, sendNotificationsToUsers }) {
        this.Equipment = Equipment;
        this.EquipmentCategory = EquipmentCategory;
        this.EquipmentLog = EquipmentLog;
        this.InstallTicket = InstallTicket;
        this.InstallDetail = InstallDetail;
        this.eventBus = eventBus;
        this.sendNotification = sendNotification;
        this.sendNotificationsToUsers = sendNotificationsToUsers;
    }

    invalidateInstallCaches = async (ticketId = null, roomId = null) => {
        const ops = [
            cache.delByPattern("eq:install:list:*"),
            cache.delByPattern("eq:install:my:*"),
        ];
        if (ticketId) ops.push(cache.del(`eq:install:ticket:${ticketId}`));
        if (roomId) ops.push(cache.del(`eq:install:suggestions:${roomId}`));
        await Promise.all(ops);
    };

    // HELPER

    async getBusyEquipmentIds({ extraFilter = {}, date = null,  includeSameDateUninstall = false} = {}) {
        const activeTickets = await this.InstallTicket.find({
            status: { $in: ["pending", "assigned", "waiting_confirm"] },
            ...extraFilter
        }).select("_id type install_date");

        const ticketIds = activeTickets.map(t => t._id);

        if (!ticketIds.length) {
            return { activeInstallTicketIds: [], busyEquipmentIds: [] };
        }

        const details = await this.InstallDetail.find({
            ticket_id: { $in: ticketIds }
        }).select("equipment_id");

        let busyIds = details.map(d => d.equipment_id.toString());

        if (includeSameDateUninstall && date) {
            const start = new Date(date);
            start.setHours(0,0,0,0);
            const end = new Date(start.getTime() + 24 * 60 * 60 * 1000);

            const sameDateTickets = await this.InstallTicket.find({
                type: "uninstall",
                status: { $in: ["pending", "assigned", "waiting_confirm"] },
                install_date: { $gte: start, $lt: end }
            }).select("_id");

            if (sameDateTickets.length) {
                const sameDetails = await this.InstallDetail.find({
                    ticket_id: { $in: sameDateTickets.map(t => t._id) }
                }).select("equipment_id");

                busyIds.push(...sameDetails.map(d => d.equipment_id.toString()));
            }
        }

        return {
            activeInstallTicketIds: ticketIds,
            busyEquipmentIds: [...new Set(busyIds)]
        };
    }

    calculateStatus({ install_date, handled_by }) {
        const today = new Date();
        today.setHours(0,0,0,0);

        const installDate = new Date(install_date);
        installDate.setHours(0,0,0,0);

        const isToday = installDate.getTime() === today.getTime();

        if (handled_by) 
            return "assigned";
        if (isToday) 
            return "waiting_confirm";
        return "pending";
    }

    async applyEquipmentChanges({ equipmentIds, room_id, status, note, handled_by }) {
        const now = new Date();

        await this.Equipment.updateMany(
            { _id: { $in: equipmentIds } },
            { status, room_id }
        );

        await this.EquipmentLog.updateMany(
            { equipment_id: { $in: equipmentIds }, end_time: null },
            { $set: { end_time: now } }
        );

        const logs = equipmentIds.map(id => ({
            equipment_id: id,
            room_id,
            status,
            condition: "good",
            start_time: now,
            end_time: null,
            note,
            handled_by
        }));

        await this.EquipmentLog.insertMany(logs);
    }

    async selectEquipments({ items, baseQuery, busyIds = [] }) {
        const selected = [];

        for (const item of items) {
            if (item.specific_equipment_id) {
                if (!mongoose.Types.ObjectId.isValid(item.specific_equipment_id)) {
                    throw new Error(`ID không hợp lệ: ${item.specific_equipment_id}`);
                }

                const eq = await this.Equipment.findOne({
                    _id: item.specific_equipment_id,
                    ...baseQuery,
                    status: { $nin: ["installing", "removing"] }, 
                });

                if (!eq) {
                    throw new Error(`Thiết bị ${item.specific_equipment_id} không khả dụng.`);
                }

                const idStr = eq._id.toString();
                if (busyIds.includes(idStr)) {
                    throw new Error(`Thiết bị ${idStr} đang nằm trong phiếu khác.`);
                }

                selected.push(eq._id);
                busyIds.push(idStr);

            } else if (item.category_id) {
                const quantity = Number(item.quantity) || 1;

                const eqs = await this.Equipment.find({
                    category_id: item.category_id,
                    ...baseQuery,
                    status: { $nin: ["installing", "removing"] }, 
                    _id: { $nin: busyIds }
                }).limit(quantity);

                if (eqs.length < quantity) {
                    throw new Error(`Không đủ thiết bị cho category ${item.category_id}`);
                }

                eqs.forEach(e => {
                    const idStr = e._id.toString();
                    selected.push(e._id);
                    busyIds.push(idStr);
                });
            }
        }

        if (!selected.length) {
            throw new Error("Danh sách thiết bị trống.");
        }

        return selected;
    }

    populateEmployeeAndHandler = async (installs) => {
        const isArray = Array.isArray(installs);
        const list = isArray ? installs : [installs];

        const employeeIds = [...new Set(
            list
                .map(i => i.employee_id?.toString())
                .filter(Boolean)
        )];

        const handlerIds = [...new Set(
            list
                .map(i => i.handled_by?.toString())
                .filter(Boolean)
        )];


        const [employeeReply, handlerReply] = await Promise.all([
            employeeIds.length > 0
                ? this.eventBus.safeRequest(EMPLOYEE_EVENTS.GET_INFO, { employee_ids: employeeIds })
                : Promise.resolve({ success: true, employees: [] }),
            handlerIds.length > 0
                ? this.eventBus.safeRequest(EMPLOYEE_EVENTS.GET_INFO, { employee_ids: handlerIds })
                : Promise.resolve({ success: true, employees: [] }),
        ]);

        let employeeMap = {};
        let handlerMap = {};

        for (const emp of (employeeReply.employees || [])) {
            employeeMap[emp._id.toString()] = emp;
        }
        for (const emp of (handlerReply.employees || [])) {
            handlerMap[emp._id.toString()] = emp;
        }

        const results = list.map(install => ({
            ...install,
            employee_info: employeeMap[install.employee_id?.toString()] || null,
            handler_info: handlerMap[install.handled_by?.toString()] || null
        }));

        return isArray ? results : results[0];
    };

    populateRoom = async (tickets) => {
        const isArray = Array.isArray(tickets);
        const list = isArray ? tickets : [tickets];
        //console.log("LIST: ", list);

        const roomIds = [...new Set(
            list
                .map(e => e.room_id?.toString())
                .filter(Boolean)
        )];

        let roomMap = {};

        if (roomIds.length > 0) {
            const reply = await this.eventBus.safeRequest(
                ROOM_EVENTS.GET_ROOMS_INFO,
                { room_ids: roomIds }
            );
            for (const room of (reply.rooms || [])) {
                roomMap[room._id.toString()] = {
                    _id: room._id,
                    room_number: room.room_number,
                    room_status: room.room_status
                };
            }
        }

        const results = list.map(ticket => ({
            ...ticket,
            room_info: roomMap[ticket.room_id?.toString()] || null
        }));

        return isArray ? results : results[0];
    };

    getEmployeeByUserId = async (employeeUserId) => {
        const reply = await this.eventBus.safeRequest(
            EMPLOYEE_EVENTS.CHECK_EXISTS_USERID,
            { employee_user_id: employeeUserId }
        );

        if (!reply.success)
            throw new Error(reply.message || "Không tìm thấy nhân viên.");
        
        return reply.employee;
    };
 
    getEmployeeById = async (employeeId) => {
        const reply = await this.eventBus.safeRequest(
            EMPLOYEE_EVENTS.CHECK_EXISTS,
            { employee_id: employeeId }
        );

        if (!reply.success)
            throw new Error(reply.message || "Không tìm thấy nhân viên.");
        
        return reply.employee;
    };
 
    getTechnicianAvailable = async (employeeId) => {
        const reply = await this.eventBus.safeRequest(
            EMPLOYEE_EVENTS.CHECK_TECHINICIAN_AVAILABLE,
            { employee_id: employeeId }
        );

        if (!reply.success)
            throw new Error(reply.message || "Nhân viên kỹ thuật không hợp lệ hoặc không tồn tại.");
        
        return reply.employee;
    };
 
    getRoomById = async (roomId) => {
        const reply = await this.eventBus.safeRequest(
            ROOM_EVENTS.CHECK_EXISTS,
            { room_id: roomId }
        );

        if (!reply.success)
            throw new Error(reply.message || "Không tìm thấy phòng.");
        
        return reply.room;
    };
 
    getManagersUserIds = async () => {
        const reply = await this.eventBus.safeRequest(
            USER_EVENTS.GET_MANAGERS
        );
        
        if (!reply.success) return [];
        
        return reply.managers.map(u => u._id);
    };

    // MAIN FUNCTIONS    
    createInstallTicket = async (employeeUserId, data) => {
        try {
            const { room_id, install_date, items, handled_by } = data;
    
            if (!install_date || !room_id) {
                throw new Error("Yêu cầu nhập đầy đủ thông tin: room_id, install_date.");
            }

            const installDate = new Date(install_date);
            const today = new Date();
            today.setHours(0, 0, 0, 0);
            installDate.setHours(0, 0, 0, 0);

            if (installDate < today) {
                throw new Error("Ngày nhập không hợp lệ! Không thể nhỏ hơn ngày hiện tại.");
            }
    
            const [employee, targetRoom] = await Promise.all([
                this.getEmployeeByUserId(employeeUserId),
                this.getRoomById(room_id),
            ]);

            const sourceQuery = {
                status: "in-stock",
                condition: { $in: ["new", "good"] },
                room_id: null
            };
            
            const { activeInstallTicketIds, busyEquipmentIds } = await this.getBusyEquipmentIds();
            const status = this.calculateStatus({ install_date, handled_by });

            const selectedEquipmentIds = await this.selectEquipments({
                items, 
                sourceQuery,
                busyEquipmentIds
            });
                
            const existedDetail = await this.InstallDetail.findOne({
                equipment_id: { $in: selectedEquipmentIds },
                ticket_id: { $in: activeInstallTicketIds }
            });
    
            if (existedDetail) {
                const install_ticket = await this.InstallTicket.findById(existedDetail.ticket_id);
                throw new Error(`Có thiết bị đang thuộc phiếu xử lý khác (Phiếu #${install_ticket?._id.toString().slice(-6) || 'N/A'}).`);
            }
    
            let handledByEmployee = null;
            if (handled_by) {
                await this.getEmployeeById(handled_by);
                handledByEmployee = await this.getTechnicianAvailable(handled_by);
    
                const targetDay = new Date(install_date);
                targetDay.setHours(0, 0, 0, 0);
                const nextDay = new Date(targetDay.getTime() + 24 * 60 * 60 * 1000);

                const activeTicket = await this.InstallTicket.findOne({
                    handled_by: handled_by,
                    status: { $in: ["pending", "assigned", "waiting_confirm"] },
                    install_date: { $gte: targetDay, $lt: nextDay },
                });
                if (activeTicket) {
                    throw new Error("Nhân viên này đã được gán phiếu khác vào cùng ngày, không thể gán thêm.");
                }
            }

            const install = await this.InstallTicket.create({
                employee_id: employee?._id,
                handled_by: handled_by || handledByEmployee?._id || null,
                room_id: room_id,
                type: 'install',
                install_date,
                status,
            });
    
            const details = selectedEquipmentIds.map((eid) => ({
                ticket_id: install._id,
                equipment_id: eid,
            }));

            await this.InstallDetail.insertMany(details);
    
            await this.applyEquipmentChanges({
                equipmentIds: selectedEquipmentIds,
                room_id,
                status: "installing",
                note: "Đang làm thủ tục xuất kho lắp đặt",
                handled_by: handled_by || handledByEmployee?._id || null
            });
                
            // send notifications
            try {
                const adminUserIds = await this.getManagersUserIds();
                const notifPromises = [];
                if (handledByEmployee && handledByEmployee.user_id) {
                    const roomText = ` phòng ${targetRoom.room_number}`;
                    notifPromises.push(this.sendNotification({
                        userId: handledByEmployee.user_id,
                        title: "Công việc lắp đặt thiết bị mới",
                        content: `Bạn được gán phiếu lắp đặt thiết bị${roomText} #${install._id.toString().slice(-6)}`,
                        type: "equipment",
                        kind: "InstallTicket",
                        refId: install._id,
                    }));
                }
                if (adminUserIds.length > 0) {
                    notifPromises.push(this.sendNotificationsToUsers({
                        userIds: adminUserIds,
                        title: "Phiếu lắp đặt mới",
                        content: `Có phiếu lắp đặt thiết bị mới #${install._id.toString().slice(-6)} được tạo${handledByEmployee ? ` và đã gán cho ${handledByEmployee.full_name}` : ''}`,
                        type: "system",
                        kind: "InstallTicket",
                        refId: install._id
                    }));
                }
                await Promise.all(notifPromises);
            } catch (notifError) {
                console.error("Error sending notification:", notifError);
            }

            await this.invalidateInstallCaches(null, room_id);
            return install;

        } catch (error) {
            console.log("Error in creating equipment install ticket: ", error.message);
            throw error;
        }
    };
    
    createUninstallTicket = async (employeeUserId, data) => {
        try {
            const { from_room_id, install_date, items, handled_by } = data;
    
            if (!employeeUserId || !install_date || !from_room_id) {
                throw new Error("Yêu cầu nhập đầy đủ thông tin: from_room_id, install_date.");
            }

            const installDate = new Date(install_date);
            const today = new Date();
            today.setHours(0, 0, 0, 0);
            installDate.setHours(0, 0, 0, 0);

            if (installDate < today) {
                throw new Error("Ngày tháo dỡ không hợp lệ! Không thể nhỏ hơn ngày hiện tại.");
            }

            const [employee, sourceRoom] = await Promise.all([
                this.getEmployeeByUserId(employeeUserId),
                this.getRoomById(from_room_id),
            ]);

            const sourceQuery = {
                status: "in-use",
                room_id: from_room_id
            };

            const { activeInstallTicketIds, busyEquipmentIds } = await this.getBusyEquipmentIds({
                date: install_date,
                includeSameDateUninstall: true
            });

            const selectedEquipmentIds = await this.selectEquipments({
                items, 
                sourceQuery,
                busyEquipmentIds
            });

            const status = this.calculateStatus({ install_date, handled_by });
    
            let handledByEmployee = null;
            if (handled_by) {
                await this.getEmployeeById(handled_by);
                handledByEmployee = await this.getTechnicianAvailable(handled_by);
    
                const targetDay = new Date(install_date);
                targetDay.setHours(0, 0, 0, 0);
                const nextDay = new Date(targetDay.getTime() + 24 * 60 * 60 * 1000);

                const activeTicket = await this.InstallTicket.findOne({
                    handled_by: handled_by,
                    status: { $in: ["pending", "assigned", "waiting_confirm"] },
                    install_date: { $gte: targetDay, $lt: nextDay },
                });
                if (activeTicket) {
                    throw new Error("Nhân viên này đã được gán phiếu khác vào cùng ngày, không thể gán thêm.");
                }
            }

            const install = await this.InstallTicket.create({
                employee_id: employee?._id,
                handled_by: handled_by || null,
                room_id: from_room_id,
                type: 'uninstall',
                install_date,
                status,
            });
    
            const details = selectedEquipmentIds.map((eid) => ({
                ticket_id: install._id,
                equipment_id: eid,
            }));
            await this.InstallDetail.insertMany(details);
    
            await this.applyEquipmentChanges({
                equipmentIds: selectedEquipmentIds,
                room_id: from_room_id,
                status: "removing",
                note: "Đang làm thủ tục tháo dỡ thiết bị về kho",
                handled_by: handled_by || handledByEmployee?._id || null
            });

            try {
                const adminUserIds = await this.getManagersUserIds();
                const notifPromises = [];
                if (handledByEmployee && handledByEmployee.user_id) {
                    const roomText = ` phòng ${sourceRoom.room_number}`;
                    notifPromises.push(this.sendNotification({
                        userId: handledByEmployee.user_id,
                        title: "Công việc tháo dỡ thiết bị mới",
                        content: `Bạn được gán phiếu tháo dỡ thiết bị${roomText} #${install._id.toString().slice(-6)}`,
                        type: "equipment",
                        kind: "InstallTicket",
                        refId: install._id,
                    }));
                }
                if (adminUserIds.length > 0) {
                    notifPromises.push(this.sendNotificationsToUsers({
                        userIds: adminUserIds,
                        title: "Phiếu tháo dỡ thiết bị mới",
                        content: `Có phiếu tháo dỡ thiết bị mới #${install._id.toString().slice(-6)} được tạo${handledByEmployee ? ` và đã gán cho ${handledByEmployee.full_name}` : ''}`,
                        type: "system",
                        kind: "InstallTicket",
                        refId: install._id
                    }));
                }
                await Promise.all(notifPromises);
            } catch (notifError) {
                console.error("Error sending notification:", notifError);
            }

            await this.invalidateInstallCaches(null, from_room_id);
            return install;

        } catch (error) {
            console.log("Error in creating uninstall equipment ticket: ", error.message);
            throw error;
        }
    };
    
    getAllEquipmentInstalls = async (query = {}) => {
        try {
            const { employee_id, room_id, min_install_date, max_install_date, status } = query;

            const cacheKey = makeCacheKey("eq:install:list", {
                employee_id: employee_id || null,
                room_id: room_id || null,
                min_install_date: min_install_date || null,
                max_install_date: max_install_date || null,
                status: status || null,
            });
            const cached = await cache.get(cacheKey);
            if (cached) return cached;

            let filter = {};
        
            if (employee_id) {
                await this.getEmployeeById(employee_id);
                filter.employee_id = employee_id;
            }
        
            if (room_id) {
                await this.getRoomById(room_id);
                filter.room_id = room_id;
            }
        
            if (min_install_date || max_install_date) {
                filter.install_date = {};
                if (min_install_date) filter.install_date.$gte = new Date(min_install_date);
                if (max_install_date) filter.install_date.$lte = new Date(max_install_date);
            }
        
            if (status) filter.status = status;
        
            const installs = await this.InstallTicket.find(filter)
                .sort({ install_date: -1 })
                .select("-created_at -updated_at -__v")
                .lean();

            const results = await this.populateEmployeeAndHandler(installs);
            const finalResult = await this.populateRoom(results);

            const response = { counts: finalResult.length, installs: finalResult };
            await cache.set(cacheKey, response, 60);
            return response;

        } catch (error) {
            console.log("Error in getting all equipment install tickets: ", error.message);
            throw error;
        }
    };
    
    getAllInstallsForTasks = async (query = {}) => {
        const { counts, installs } = await this.getAllEquipmentInstalls(query);

        if (!installs.length) return { counts: 0, installs: [] };

        const ticketIds = installs.map(i => i._id);

        const details = await this.InstallDetail.find({ ticket_id: { $in: ticketIds } })
            .populate({
                path: "equipment_id",
                populate: { path: "category_id", select: "name" },
                select: "category_id condition status code"
            })
            .lean();

        const detailMap = {};
        for (const d of details) {
            const key = d.ticket_id.toString();
            if (!detailMap[key]) detailMap[key] = [];
            detailMap[key].push(d);
        }

        const result = installs.map(install => ({
            ...install,
            install_details: detailMap[install._id.toString()] || []
        }));

        return { counts: result.length, installs: result };
    };

    getSmartInstallSuggestions = async (roomId) => {
        try {
            if (!roomId) throw new Error("Vui lòng cung cấp room_id");

            const cacheKey = `eq:install:suggestions:${roomId}`;
            const cached = await cache.get(cacheKey);
            if (cached) return cached;

            const reply = await this.eventBus.safeRequest(
                ROOM_EVENTS.CHECK_EXISTS,
                { room_id: roomId }
            );
            if (!reply.found) throw new Error("Không tìm thấy phòng.");
            if (reply.room.category_id == null)
                throw new Error("Phòng này chưa có loại phòng, không thể đưa ra gợi ý thiết bị.");

            const room = reply.room;
            
            const replyDefaultEquipments = await this.eventBus.safeRequest(
                ROOM_EVENTS.GET_DEFAULT_EQUIPMENTS_ROOM_CATEGORY,
                { categoryId: room.category_id }
            );
            if (!replyDefaultEquipments.success) throw new Error(replyDefaultEquipments.message);

            const defaultEquipments = replyDefaultEquipments.defaultEquipments;
            if (!defaultEquipments.length)
                throw new Error("Loại phòng này không có thiết bị mặc định");

            const equipmentCategoryIds = defaultEquipments.map(d =>
                d.equipment_category_id?.toString?.() ?? d.equipment_category_id
            );

            const equipmentCategories = await this.EquipmentCategory.find(
                { _id: { $in: equipmentCategoryIds } },
                { name: 1, description: 1, unit: 1 }
            ).lean();

            const categoryMap = new Map(
                equipmentCategories.map(c => [c._id.toString(), c])
            );

            const currentEquipments = await this.Equipment.find({
                room_id: roomId,
                status: "in-use"
            }).lean();

            const currentEquipmentCount = {};
            currentEquipments.forEach(eq => {
                const catId = eq.category_id?.toString();
                if (catId) currentEquipmentCount[catId] = (currentEquipmentCount[catId] || 0) + 1;
            });

            const stockEquipments = await this.Equipment.find({
                status: "in-stock",
                room_id: null,
                condition: { $in: ["new", "good"] }
            }).lean();

            const stockEquipmentCount = {};
            stockEquipments.forEach(eq => {
                const catId = eq.category_id?.toString();
                if (catId) stockEquipmentCount[catId] = (stockEquipmentCount[catId] || 0) + 1;
            });

            const suggestions = [];
            for (const defaultEq of defaultEquipments) {
                const equipmentCategoryId = defaultEq.equipment_category_id?.toString();
                const categoryDetail = categoryMap.get(equipmentCategoryId);

                const requiredQuantity = defaultEq.quantity || 0;
                const currentQuantity = currentEquipmentCount[equipmentCategoryId] || 0;
                const neededQuantity = requiredQuantity - currentQuantity;
                const availableInStock = stockEquipmentCount[equipmentCategoryId] || 0;

                if (neededQuantity > 0 && availableInStock > 0) {
                    const suggestedQuantity = Math.min(neededQuantity, availableInStock);
                    suggestions.push({
                        category_id: equipmentCategoryId,
                        category_name: categoryDetail?.name || "Unknown",
                        category_description: categoryDetail?.description || "",
                        category_unit: categoryDetail?.unit || "item",
                        required_quantity: requiredQuantity,
                        current_quantity: currentQuantity,
                        needed_quantity: neededQuantity,
                        available_in_stock: availableInStock,
                        suggested_quantity: suggestedQuantity,
                        reason: currentQuantity === 0
                            ? `Thiết bị chưa có trong phòng (cần ${requiredQuantity}, có ${availableInStock} trong kho)`
                            : `Thiếu ${neededQuantity} ${categoryDetail?.unit || "cái"} (hiện có ${currentQuantity}/${requiredQuantity}, có ${availableInStock} trong kho)`
                    });
                }
            }

            suggestions.sort((a, b) => {
                if (a.current_quantity === 0 && b.current_quantity > 0) return -1;
                if (a.current_quantity > 0 && b.current_quantity === 0) return 1;
                return b.needed_quantity - a.needed_quantity;
            });

            const result = {
                room_id: roomId,
                room_number: room.room_number,
                room_category: room.category_id?.category_name ?? room.category_id,
                suggestions,
                total_suggestions: suggestions.length
            };

            await cache.set(cacheKey, result, 120);
            return result;

        } catch (error) {
            console.error("Error in getSmartInstallSuggestions:", error);
            throw error;
        }
    };
    
    getMyInstallTickets = async (employeeUserId, query = {}) => {
        try {
            const { status, isAssigned, isCreated } = query;

            const cacheKey = makeCacheKey("eq:install:my", {
                userId: employeeUserId,
                status: status || null,
                isAssigned: isAssigned ?? null,
                isCreated: isCreated ?? null,
            });
            const cached = await cache.get(cacheKey);
            if (cached) return cached;

            let filter = {};

            const employee = await this.getEmployeeByUserId(employeeUserId);

            const assigned = isAssigned === true || isAssigned === "true";
            const created = isCreated === true || isCreated === "true";

            if (assigned && created) {
                filter.$or = [
                    { handled_by: employee._id },
                    { employee_id: employee._id }
                ];
            } else if (assigned) {
                filter.handled_by = employee._id;
            } else if (created) {
                filter.employee_id = employee._id;
            } else {
                filter.handled_by = employee._id;
            }

            if (status) {
                filter.status = status;
            }
        
            const installs = await this.InstallTicket.find(filter)
                .sort({ created_at: -1 })
                .select("-created_at -updated_at -__v")
                .lean();

            const result = await this.populateEmployeeAndHandler(installs);
            const finalResult = await this.populateRoom(result);

            const response = { count: finalResult.length, installs: finalResult };
            await cache.set(cacheKey, response, 60);
            return response;

        } catch (error) {
            console.log("Error in getting my equipment install/uninstall tickets: ", error.message);
            throw error;
        }
    };
    
    getEquipmentInstallById = async (ticketId) => {
        try {
            const cacheKey = `eq:install:ticket:${ticketId}`;
            const cached = await cache.get(cacheKey);
            if (cached) return cached;

            const install = await this.InstallTicket.findById(ticketId)
                .select("-created_at -updated_at -__v").lean();
        
            const result = await this.populateEmployeeAndHandler(install);
            const finalResult = await this.populateRoom(result);

            if (!install)
                throw new Error("Không tìm thấy phiếu lắp đặt.");
        
            const installDetails = await this.InstallDetail.find({ ticket_id: ticketId })
                .populate({
                    path: "equipment_id",
                    populate: {
                        path: "category_id",
                        select: "name description"
                    },
                    select: "category_id condition status code"
                });

            const final = { ...finalResult, install_details: installDetails };
            await cache.set(cacheKey, final, 120);
            return final;

        } catch (error) {
            console.log("Error in getting equipment un/install ticket: ", error.message);
            throw error;
        }
    };

    updateEquipmentInstall = async (ticketId, updateData) => {
        try {
            const { room_id, install_date, items, handled_by } = updateData;

            const install_ticket = await this.InstallTicket.findById(ticketId);
            if (!install_ticket) {
                throw new Error("Không tìm thấy phiếu lắp đặt thiết bị.");
            }

            if (["completed", "expired"].includes(install_ticket.status)) {
                throw new Error("Không thể chỉnh sửa phiếu đã hoàn tất hoặc quá hạn.");
            }

            if (install_ticket.started_at) {
                throw new Error("Không thể chỉnh sửa phiếu khi nhân viên đã bắt đầu công việc.");
            }

            const today = new Date();
            today.setHours(0, 0, 0, 0);

            const ticketDate = new Date(install_ticket.install_date);
            ticketDate.setHours(0, 0, 0, 0);

            const ticketDateArrived = ticketDate <= today;
            const hasAssignedTechnician = install_ticket.handled_by != null;

            if (ticketDateArrived && hasAssignedTechnician) {
                throw new Error("Không thể cập nhật phiếu vì đã đến ngày lắp đặt và đã gán nhân viên.");
            }

            if (install_date) {
                const newDate = new Date(install_date);
                newDate.setHours(0, 0, 0, 0);

                if (newDate < today) {
                    throw new Error("Ngày lắp đặt không hợp lệ! Không thể nhỏ hơn ngày hiện tại.");
                }

                if (ticketDateArrived && newDate.getTime() !== ticketDate.getTime()) {
                    throw new Error("Không thể thay đổi ngày khi đã đến hoặc qua ngày lắp đặt thiết bị");
                }

                install_ticket.install_date = install_date;

            } else if (ticketDateArrived && handled_by === undefined) {
                throw new Error("Không thể sửa khi đã đến hoặc qua ngày lắp đặt thiết bị");
            }

            if (room_id) {
                await this.getRoomById(room_id);
                install_ticket.room_id = room_id;
            }

            if (handled_by !== undefined) {
                if (!handled_by) {
                    install_ticket.handled_by = null;
                } else {
                    const technician = await this.getTechnicianAvailable(handled_by);

                    const technicianChanged = !install_ticket.handled_by
                        || install_ticket.handled_by.toString() !== handled_by;

                    if (technicianChanged) {
                        const targetDay = new Date(install_ticket.install_date);
                        targetDay.setHours(0, 0, 0, 0);
                        const nextDay = new Date(targetDay.getTime() + 24 * 60 * 60 * 1000);

                        const activeTicket = await this.InstallTicket.findOne({
                            handled_by,
                            status: { $in: ["pending", "assigned", "waiting_confirm"] },
                            install_date: { $gte: targetDay, $lt: nextDay },
                            _id: { $ne: install_ticket._id },
                        });

                        if (activeTicket) {
                            throw new Error("Nhân viên này đã được gán phiếu khác vào cùng ngày, không thể gán thêm.");
                        }
                    }

                    install_ticket.handled_by = technician._id;
                }
            }

            install_ticket.status = this.calculateStatus({
                install_date: install_ticket.install_date,
                handled_by: install_ticket.handled_by,
            });

            await install_ticket.save();

            if (items?.length) {
                const categoryIds = items.map((item) => {
                    if (!item.category_id || !mongoose.Types.ObjectId.isValid(item.category_id)
                        || !Number.isInteger(item.quantity) || item.quantity <= 0) {
                        throw new Error("Mỗi mục thiết bị phải có category_id hợp lệ và quantity là số nguyên dương.");
                    }
                    return item.category_id.toString();
                });

                if (new Set(categoryIds).size !== categoryIds.length) {
                    throw new Error("Mỗi category_id chỉ được xuất hiện một lần trong danh sách thiết bị.");
                }

                const { busyEquipmentIds } = await this.getBusyEquipmentIds({
                    extraFilter: { _id: { $ne: install_ticket._id } },
                });

                const selectedEquipmentIds = await this.selectEquipments({
                    items,
                    baseQuery: {
                        status: "in-stock",
                        condition: { $in: ["new", "good"] },
                        room_id: null,
                    },
                    busyIds: busyEquipmentIds,
                });

                const oldDetails = await this.InstallDetail.find({ ticket_id: install_ticket._id });
                const oldEquipmentIds = oldDetails.map((d) => d.equipment_id);

                if (oldEquipmentIds.length) {
                    await this.applyEquipmentChanges({
                        equipmentIds: oldEquipmentIds,
                        room_id: null,
                        status: "in-stock",
                        note: "Thiết bị đang ở kho",
                        handled_by: install_ticket.employee_id || null,
                    });

                    await this.InstallDetail.deleteMany({ ticket_id: install_ticket._id });
                }

                // Assign new equipment
                await this.InstallDetail.insertMany(
                    selectedEquipmentIds.map((eid) => ({ ticket_id: install_ticket._id, equipment_id: eid }))
                );

                await this.applyEquipmentChanges({
                    equipmentIds: selectedEquipmentIds,
                    room_id: install_ticket.room_id,
                    status: "installing",
                    note: "Thiết bị đang chờ lắp đặt",
                    handled_by: install_ticket.employee_id || null,
                });
            }

            try {
                if (handled_by !== undefined && install_ticket.handled_by) {
                    const updatedTicket = await this.InstallTicket.findById(install_ticket._id)

                    const [room, employee] = await Promise.all([
                        this.getRoomById(install_ticket.room_id),
                        this.getEmployeeById(install_ticket.handled_by),
                    ]);

                    if (employee.user_id) {
                        const roomText = updatedTicket.room_id ? ` phòng ${room.room_number}` : "";
                        const typeText = install_ticket.type === "uninstall" ? "tháo dỡ" : "lắp đặt";

                        await this.sendNotification({
                            userId: employee.user_id,
                            title: "Công việc mới được gán",
                            content: `Bạn được gán phiếu ${typeText} thiết bị${roomText} #${install_ticket._id.toString().slice(-6)}`,
                            type: "equipment",
                            kind: "InstallTicket",
                            refId: install_ticket._id
                        });
                    }
                }
            } catch (notifError) {
                console.error("Error sending notification:", notifError);
            }

            await this.invalidateInstallCaches(ticketId, install_ticket.room_id?.toString());
            return { data: {
                install_ticket,
                ...(items?.length && { equipment_count: items.length }),
            }};

        } catch (error) {
            console.log("Error in updating equipment install ticket: ", error.message);
            throw error;
        }
    };
    
    deleteEquipmentInstall = async (ticketId) => {
        try {
            if (!mongoose.Types.ObjectId.isValid(ticketId)) {
                throw new Error("ID phiếu lắp đặt không hợp lệ.");
            }
        
            const installTicket = await this.InstallTicket.findById(ticketId).lean();
            if (!installTicket) {
                throw new Error("Không tìm thấy phiếu lắp đặt thiết bị.");
            }

            const [room, employee] = await Promise.all([
                this.getRoomById(installTicket.room_id),
                installTicket.handled_by ? this.getEmployeeById(installTicket.handled_by) : Promise.resolve(null),
            ]);
        
            if (!["pending", "assigned", "waiting_confirm"].includes(installTicket.status)) {
                throw new Error("Chỉ được xóa phiếu lắp đặt ở trạng thái pending, assigned hoặc waiting_confirm.");
            }
        
            const today = new Date();
            today.setHours(0, 0, 0, 0);
        
            const installDate = new Date(installTicket.install_date);
            installDate.setHours(0, 0, 0, 0);
        
            const isToday = installDate.getTime() === today.getTime();
            
            if (isToday && installTicket.started_at) {
                throw new Error("Không thể hủy phiếu vì nhân viên đã bắt đầu thực hiện.");
            }
        
            const details = await this.InstallDetail.find({ ticket_id: ticketId });        
            // if (details.length > 0 && !force) {
            //   await session.abortTransaction();
            //   return res.status(400).json({
            //     success: false,
            //     message: `Phiếu có ${details.length} thiết bị. Dùng ?force=true để xóa.`,
            //   });
            // }
        
            const equipmentIds = details.map(d => d.equipment_id);
            await this.InstallDetail.deleteMany({ ticket_id: ticketId });
        
            if (equipmentIds.length > 0) {
                const now = new Date();
                await this.EquipmentLog.updateMany(
                    {
                        equipment_id: { $in: equipmentIds },
                        end_time: null,
                    },
                    { $set: { end_time: now } },
                );
            
                if (installTicket.type === 'uninstall') {
                    await this.Equipment.updateMany(
                        { _id: { $in: equipmentIds } },
                        { 
                            status: "in-use",
                            condition: "good",
                            room_id: installTicket.room_id 
                        },
                    );
                    
                    const logs = equipmentIds.map(equipmentId => ({
                        equipment_id: equipmentId,
                        room_id: installTicket.room_id,
                        status: "in-use",
                        condition: "good",
                        start_time: now,
                        end_time: null,
                        note: `Thiết bị quay về phòng do phiếu tháo dỡ ${installTicket._id} bị hủy`,
                        handled_by: installTicket.employee_id || null,
                    }));
                    
                    await this.EquipmentLog.insertMany(logs);
                } else {
                    await this.Equipment.updateMany(
                        { _id: { $in: equipmentIds } },
                        { 
                            status: "in-stock",
                            condition: "new",
                            room_id: null 
                        },
                    );
                                        
                    const logs = equipmentIds.map(equipmentId => ({
                        equipment_id: equipmentId,
                        room_id: null,
                        status: "in-stock",
                        condition: "new",
                        start_time: now,
                        end_time: null,
                        note: `Thiết bị quay về kho do phiếu lắp đặt ${installTicket._id} bị hủy`,
                        handled_by: installTicket.employee_id || null,
                    }));
                    
                    await this.EquipmentLog.insertMany(logs);
                }
            }
        
            await this.InstallTicket.deleteOne({ _id: ticketId });
        
            const roomText = installTicket.room_id ? ` phòng ${room.room_number}` : "";
            const typeText = installTicket.type === 'uninstall' ? 'tháo dỡ' : 'lắp đặt';
            const shortTicketId = installTicket._id.toString().slice(-6);
            const technicianName = employee.full_name || null;
            const technicianUserId = employee.user_id || null;
                
            try {
                const adminUserIds = await this.getManagersUserIds();
                const notifPromises = [];
                if (technicianUserId) {
                    notifPromises.push(this.sendNotification({
                        userId: technicianUserId,
                        title: `Phiếu ${typeText} thiết bị đã bị hủy`,
                        content: `Phiếu ${typeText} thiết bị${roomText} #${shortTicketId} đã bị hủy.`,
                        type: "equipment",
                        kind: "InstallTicket",
                        refId: installTicket._id
                    }));
                }
                if (adminUserIds.length > 0) {
                    notifPromises.push(this.sendNotificationsToUsers({
                        userIds: adminUserIds,
                        title: `Phiếu ${typeText} thiết bị đã bị hủy`,
                        content: `Phiếu ${typeText} thiết bị${roomText} #${shortTicketId} đã bị hủy${technicianName ? ` (đã gán cho ${technicianName})` : ''}.`,
                        type: "system",
                        kind: "InstallTicket",
                        refId: installTicket._id
                    }));
                }
                await Promise.all(notifPromises);
            } catch (notifError) {
                console.error("Error sending notification:", notifError);
            }
        
            await this.invalidateInstallCaches(ticketId, installTicket.room_id?.toString());
            return { success: true };

        } catch (error) {
            console.log("Error in deleting equipment install/uninstall ticket: ", error.message);
            throw error;
        }
    };
    
    confirmEquipmentInstall = async (ticketId) => {
        try {        
            if (!mongoose.Types.ObjectId.isValid(ticketId)) {
                throw new Error("ID phiếu lắp đặt không hợp lệ.");
            }
        
            const ticket = await this.InstallTicket.findById(ticketId);
            if (!ticket) {
                throw new Error("Không tìm thấy phiếu lắp đặt/tháo dỡ thiết bị.");
            }
            if (ticket.status !== "waiting_confirm") {
                throw new Error("Chỉ có thể xác nhận phiếu ở trạng thái chờ xác nhận.");
            }
            if (!ticket.completed_at) {
                throw new Error("Nhân viên chưa hoàn thành công việc. Không thể xác nhận.");
            }
        
            const today = new Date();
            today.setHours(0, 0, 0, 0);
            const installDate = new Date(ticket.install_date);
            installDate.setHours(0, 0, 0, 0);
        
            if (installDate > today) {
                throw new Error("Chưa đến ngày thực hiện, không thể xác nhận.");
            }
        
            const details = await this.InstallDetail.find({ ticket_id: ticketId });
            const equipmentIds = details.map(d => d.equipment_id);

            if (details.length === 0) {
                throw new Error("Phiếu không có thiết bị nào.");
            }
            
            let expectedStatus = "installing";
            if (ticket.type === 'uninstall') {
                expectedStatus = "removing";
            }
            
            const allEquipments = await this.Equipment.find({
                _id: { $in: equipmentIds }
            }).populate("category_id", "_id name");

            const invalidEquipments = allEquipments.filter(eq => eq.status !== expectedStatus);
            if (invalidEquipments.length > 0) {
                const invalidStatuses = invalidEquipments.map(eq => `${eq._id}: ${eq.status}`).join(", ");
                throw new Error(`Có ${invalidEquipments.length} thiết bị không có status="${expectedStatus}". Các thiết bị: ${invalidStatuses}`);
            }
        
            if (allEquipments.length !== equipmentIds.length) {
                const foundEquipmentIds = allEquipments.map(eq => eq._id.toString());
                const missingEquipmentIds = equipmentIds.filter(id => !foundEquipmentIds.includes(id.toString()));
                
                throw new Error(`Không tìm thấy ${missingEquipmentIds.length} thiết bị trong hệ thống. Yêu cầu: ${equipmentIds.length}, Tìm thấy: ${allEquipments.length}.`);
            }
        
            const equipments = allEquipments;
        
            const equipmentsWithoutCategory = equipments.filter(eq => !eq.category_id);
            if (equipmentsWithoutCategory.length > 0) {
                throw new Error(`Có ${equipmentsWithoutCategory.length} thiết bị không có danh mục (category_id). Vui lòng kiểm tra lại.`);
            }
        
            await this.EquipmentLog.updateMany(
                {
                    equipment_id: { $in: equipmentIds },
                    end_time: null,
                },
                {
                    $set: { end_time: new Date() },
                },
            );
        
            let newStatus = "in-use";
            let newRoomId = ticket.room_id;
            let logNote = "Hoàn tất lắp đặt vào phòng";
        
            if (ticket.type === 'uninstall') {
                newStatus = "in-stock";
                newRoomId = null;
                logNote = `Đã thu hồi về kho`;
            } else if (!ticket.room_id) {
                newStatus = "in-stock";
                newRoomId = null;
                logNote = "Đã thu hồi về kho";
            }
        
            await this.Equipment.updateMany(
                { _id: { $in: equipmentIds } },
                {
                    status: newStatus,
                    condition: "good",
                    room_id: newRoomId,
                    install_ticket_id: ticket._id
                },
            );
        
            const logs = equipmentIds.map((equipmentId) => ({
                    equipment_id: equipmentId,
                    room_id: newRoomId,
                    status: newStatus,
                    condition: "good",
                    start_time: new Date(),
                    end_time: null,
                    note: logNote,
                    handled_by: ticket.employee_id || null,
                }));
        
            await this.EquipmentLog.insertMany(logs);
        
            // Cập nhật storage_quantity của EquipmentCategory
            // Đếm số lượng thiết bị theo từng category_id
            const categoryCountMap = new Map();
            
            equipments.forEach(eq => {
                const categoryId = eq.category_id?._id?.toString() || eq.category_id?.toString() || eq.category_id;
                if (!categoryId) {
                    throw new Error(`Thiết bị ${eq._id} không có category_id hợp lệ.`);
                }
                categoryCountMap.set(categoryId, (categoryCountMap.get(categoryId) || 0) + 1);
            });
            
            // Trừ storage_quantity khi lắp đặt thành công vào phòng
            if (ticket.type === 'install' && newStatus === 'in-use') {
                // Cập nhật storage_quantity cho từng category (trừ đi số lượng đã lắp đặt)
                for (const [categoryId, count] of categoryCountMap.entries()) {
                    await this.EquipmentCategory.updateOne(
                    { _id: categoryId },
                    { $inc: { storage_quantity: -count } },
                    );
                }
            }

            // Cộng lại storage_quantity khi tháo dỡ về kho
            else if (ticket.type === 'uninstall' && newStatus === 'in-stock') {
            // Cập nhật storage_quantity cho từng category (cộng lại số lượng đã tháo dỡ)
                for (const [categoryId, count] of categoryCountMap.entries()) {
                    await this.EquipmentCategory.updateOne(
                    { _id: categoryId },
                    { $inc: { storage_quantity: count } },
                    );
                }
            }
        
            ticket.status = "completed";
            await ticket.save();
            
            // send notifications
            try {
                const [room, handler, adminUserIds] = await Promise.all([
                    this.getRoomById(ticket.room_id),
                    this.getEmployeeById(ticket.handled_by),
                    this.getManagersUserIds(),
                ]);

                const roomText = ticket.room_id ? ` phòng ${room.room_number}` : "";
                const typeText = ticket.type === 'uninstall' ? 'tháo dỡ' : 'lắp đặt';
                const technicianName = handler.full_name || "Nhân viên";

                const notifPromises = [];
                if (handler.user_id) {
                    notifPromises.push(this.sendNotification({
                        userId: handler.user_id,
                        title: "Công việc đã được xác nhận",
                        content: `Phiếu ${typeText} thiết bị${roomText} #${ticket._id.toString().slice(-6)} đã được admin xác nhận hoàn thành.`,
                        type: "equipment",
                        kind: "InstallTicket",
                        refId: ticket._id
                    }));
                }
                if (adminUserIds.length > 0) {
                    notifPromises.push(this.sendNotificationsToUsers({
                        userIds: adminUserIds,
                        title: "Đã xác nhận công việc",
                        content: `Đã xác nhận hoàn thành phiếu ${typeText} thiết bị${roomText} #${ticket._id.toString().slice(-6)} của ${technicianName}.`,
                        type: "system",
                        kind: "InstallTicket",
                        refId: ticket._id
                    }));
                }
                await Promise.all(notifPromises);

            } catch (notifError) {
                console.error("Error sending notification:", notifError);
            }

            await Promise.all([
                this.invalidateInstallCaches(ticketId, ticket.room_id?.toString()),
                cache.del("eq:import:out_of_stock"),
                cache.delByPattern("eq:install:suggestions:*"),
            ]);
            return { install_id: ticket._id, equipment_count: equipmentIds.length };

        } catch (error) {
            console.log("Error in confirming install/uninstall equipment ticket: ", error.message);
            throw error;
        }
    };

    startInstallTicket = async (ticketId, userId) => {
        try {
            if (!mongoose.Types.ObjectId.isValid(ticketId)) {
                throw new Error("ID phiếu lắp đặt không hợp lệ.");
            }

            const [employee, ticket] = await Promise.all([
                this.getEmployeeByUserId(userId),
                this.InstallTicket.findById(ticketId),
            ]);
            if (!ticket) {
                throw new Error("Không tìm thấy phiếu lắp đặt thiết bị.");
            }
        
            if (!ticket.handled_by || ticket.handled_by.toString() !== employee._id.toString()) {
                throw new Error("Bạn không được gán phiếu này.");
            }
        
            if (ticket.status !== "assigned" && ticket.status !== "waiting_confirm") {
                throw new Error("Chỉ có thể bắt đầu phiếu ở trạng thái assigned hoặc waiting_confirm.");
            }

            const today = new Date();
            today.setHours(0, 0, 0, 0);
            const installDate = new Date(ticket.install_date);
            installDate.setHours(0, 0, 0, 0);
        
            if (installDate > today) {
                throw new Error("Chưa đến ngày thực hiện, không thể bắt đầu.");
            }
        
            if (ticket.started_at) {
                throw new Error("Phiếu này đã được bắt đầu rồi.");
            }
        
            ticket.status = "waiting_confirm";
            ticket.started_at = new Date();
            await ticket.save();

            // send notifications
            try {
                const [room, handler, adminUserIds] = await Promise.all([
                    this.getRoomById(ticket.room_id),
                    this.getEmployeeById(ticket.handled_by),
                    this.getManagersUserIds(),
                ]);

                const roomText = ticket.room_id ? ` phòng ${room.room_number}` : "";
                const typeText = ticket.type === 'uninstall' ? 'tháo dỡ' : 'lắp đặt';
                const technicianName = handler.full_name || "Nhân viên";

                const notifPromises = [];
                if (handler.user_id) {
                    notifPromises.push(this.sendNotification({
                        userId: handler.user_id,
                        title: "Đã xác nhận bắt đầu công việc",
                        content: `Phiếu ${typeText} thiết bị${roomText} #${ticket._id.toString().slice(-6)} đã được admin xác nhận hoàn thành.`,
                        type: "equipment",
                        kind: "InstallTicket",
                        refId: ticket._id
                    }));
                }
                if (adminUserIds.length > 0) {
                    notifPromises.push(this.sendNotificationsToUsers({
                        userIds: adminUserIds,
                        title: "Nhân viên đã bắt đầu công việc",
                        content: `${technicianName} đã xác nhận bắt đầu phiếu ${typeText} thiết bị${roomText} #${ticket._id.toString().slice(-6)}`,
                        type: "system",
                        kind: "InstallTicket",
                        refId: ticket._id
                    }));
                }
                await Promise.all(notifPromises);

            } catch (notifError) {
                console.error("Error sending notification:", notifError);
            }

            await this.invalidateInstallCaches(ticketId, ticket.room_id?.toString());
            return { data: { install_id: ticket._id, started_at: ticket.started_at } };

        } catch (error) {
            console.log("Error in employee embark on install ticket: ", error.message);
            throw error;
        }
    };
    
    completeInstallTicket = async (ticketId, userId) => {
        try {
            if (!mongoose.Types.ObjectId.isValid(ticketId)) {
                throw new Error("ID phiếu lắp đặt không hợp lệ.");
            }

            const [employee, ticket] = await Promise.all([
                this.getEmployeeByUserId(userId),
                this.InstallTicket.findById(ticketId),
            ]);
            if (!ticket) {
                throw new Error("Không tìm thấy phiếu lắp đặt thiết bị.");
            }
        
            if (!ticket.handled_by || ticket.handled_by.toString() !== employee._id.toString()) {
                throw new Error("Bạn không được gán phiếu này.");
            }

            if (!ticket.started_at) {
                throw new Error("Bạn cần bắt đầu công việc trước khi hoàn thành.");
            }

            const today = new Date();
            today.setHours(0, 0, 0, 0);
            const installDate = new Date(ticket.install_date);
            installDate.setHours(0, 0, 0, 0);
        
            if (installDate > today) {
                throw new Error("Chưa đến ngày thực hiện, không thể hoàn thành.");
            }
        
            if (ticket.completed_at) {
                throw new Error("Phiếu này đã được hoàn thành rồi.");
            }
        
            //ticket.status = "completed";
            ticket.completed_at = new Date();
            await ticket.save();

            try {
                const [room, handler, adminUserIds] = await Promise.all([
                    this.getRoomById(ticket.room_id),
                    this.getEmployeeById(ticket.handled_by),
                    this.getManagersUserIds(),
                ]);

                const roomText = ticket.room_id ? ` phòng ${room.room_number}` : "";
                const typeText = ticket.type === 'uninstall' ? 'tháo dỡ' : 'lắp đặt';
                const technicianName = handler.full_name || "Nhân viên";

                const notifPromises = [];
                if (handler.user_id) {
                    notifPromises.push(this.sendNotification({
                        userId: handler.user_id,
                        title: "Đã xác nhận hoàn thành công việc",
                        content: `Bạn đã xác nhận hoàn thành phiếu ${typeText} thiết bị${roomText} #${ticket._id.toString().slice(-6)}. Đang chờ admin xác nhận.`,
                        type: "equipment",
                        kind: "InstallTicket",
                        refId: ticket._id
                    }));
                }
                if (adminUserIds.length > 0) {
                    notifPromises.push(this.sendNotificationsToUsers({
                        userIds: adminUserIds,
                        title: "Nhân viên đã xác nhận hoàn thành công việc",
                        content: `${technicianName} đã xác nhận hoàn thành phiếu ${typeText} thiết bị${roomText} #${ticket._id.toString().slice(-6)}. Vui lòng xác nhận`,
                        type: "system",
                        kind: "InstallTicket",
                        refId: ticket._id
                    }));
                }
                await Promise.all(notifPromises);

            } catch (notifError) {
                console.error("Error sending notification:", notifError);
            }

            await this.invalidateInstallCaches(ticketId, ticket.room_id?.toString());
            return { data: { install_id: ticket._id, completed_at: ticket.completed_at } };

        } catch (error) {
            console.log("Error in employee mark complete install ticket: ", error.message);
            throw error;
        }
    };

    // jobs for checking tasks related to equipment import and install
    
    // notifyImportTickets = async () => {
    //     const start = new Date();
    //     start.setHours(0, 0, 0, 0);
    
    //     const end = new Date();
    //     end.setHours(23, 59, 59, 999);
    
    //     // const managers = await User.find({ system_role: "manager" }).select("_id");
    
    //     // phiếu quá hạn nhập
    //     const expiredTickets = await EquipmentTicket.find({
    //         status: "waiting_confirm",
    //         import_date: { $lt: start }
    //     });
    
    //     if (expiredTickets.length > 0) {
    //         await EquipmentTicket.updateMany(
    //             { _id: { $in: expiredTickets.map(t => t._id) } },
    //             { status: "expired" }
    //         );
    
    //         const managerIds = managers.map(m => m._id);
            
    //         for (const ticket of expiredTickets) {
    //             try {
    //               await pushNotificationToUsers(
    //                   managerIds,
    //                   "Phiếu nhập thiết bị quá hạn",
    //                   `Phiếu nhập thiết bị ${ticket._id} đã quá ngày nhập kho và bị chuyển sang trạng thái quá hạn.`,
    //                   "system",
    //                   "Order",
    //                   ticket._id,
    //                   "unread"
    //               );
    //             } catch (error) {
    //               console.error(`Error sending notification for expired ticket ${ticket._id}:`, error);
    //             }
    //         }
    //     }
    
    //     // phiếu đến ngày
    //     const todayTickets = await EquipmentTicket.find({
    //       status: "pending",
    //       import_date: { $gte: start, $lte: end }
    //     });
    
    //     if (todayTickets.length > 0) {
    //         await EquipmentTicket.updateMany(
    //             { _id: { $in: todayTickets.map(t => t._id) } },
    //             { status: "waiting_confirm" }
    //         );
    
    //         const managerIds = managers.map(m => m._id);
            
    //         for (const ticket of todayTickets) {
    //             try {
    //                 await pushNotificationToUsers(
    //                     managerIds,
    //                     "Phiếu nhập thiết bị đến ngày",
    //                     `Phiếu nhập ${ticket._id} đã đến ngày nhập kho.`,
    //                     "system",
    //                     "Order",
    //                     ticket._id,
    //                     "unread"
    //                 );
    //             } catch (error) {
    //                 console.error(`Error sending notification for today ticket ${ticket._id}:`, error);
    //             }
    //         }
    //     }
    // };
    
    // notifyInstallTickets = async () => {
    //   // const session = await mongoose.startSession();
    //   // session.startTransaction();
    //   try {
    //     const now = new Date();
    
    //     const start = new Date();
    //     start.setHours(0, 0, 0, 0);
    
    //     const end = new Date();
    //     end.setHours(23, 59, 59, 999);
    
    //     const managers = await User.find({ system_role: "manager" })
    //       .select("_id");
    //       //.session(session);
    
    //     // phiếu quá hạn
    //     const expiredTickets = await EquipmentInstall.find({
    //       status: { $in: ["waiting_confirm", "pending", "assigned"] },
    //       install_date: { $lt: start },
    //     });
    
    //     //console.log("EXPIRED TICKETS: ", expiredTickets);
    
    //     for (const ticket of expiredTickets) {
    //       ticket.status = "expired";
    //       await ticket.save();
    
    //       // lấy chi tiết
    //       const details = await InstallDetail.find({
    //         install_id: ticket._id,
    //       });
    
    //       const equipmentIds = details.map(d => d.equipment_id);
    
    //       if (equipmentIds.length) {
    //         // Lấy thông tin thiết bị để đếm theo category
    //         const equipments = await Equipment.find({ _id: { $in: equipmentIds } });
            
    //         // update equipment về trạng thái gốc và xóa room_id
    //         await Equipment.updateMany(
    //           { _id: { $in: equipmentIds } },
    //           { 
    //             status: "in-stock", 
    //             condition: "new",
    //             room_id: null // Xóa room_id khi phiếu hết hạn
    //           }
    //         );
    
    //         // Cập nhật storage_quantity: Cộng lại số lượng thiết bị về kho
    //         // Chỉ áp dụng cho phiếu lắp đặt (type = 'install') - thiết bị đã được trừ kho trước đó
    //         if (ticket.type === 'install') {
    //           const categoryCountMap = new Map();
    //           equipments.forEach(eq => {
    //             const categoryId = eq.category_id.toString();
    //             categoryCountMap.set(categoryId, (categoryCountMap.get(categoryId) || 0) + 1);
    //           });
              
    //           for (const [categoryId, count] of categoryCountMap.entries()) {
    //             await EquipmentCategory.updateOne(
    //               { _id: categoryId },
    //               { $inc: { storage_quantity: count } } // Cộng lại số lượng về kho
    //             );
    //           }
    //         }
    
    //         // đóng log cũ (chỉ log của phiếu này)
    //         await EquipmentLog.updateMany(
    //           {
    //             equipment_id: { $in: equipmentIds },
    //             end_time: null,
    //           },
    //           { $set: { end_time: now } }
    //         );
    
    //         // tạo log mới
    //         const logs = equipmentIds.map(equipmentId => ({
    //           equipment_id: equipmentId,
    //           room_id: null, // room_id = null khi về kho
    //           status: "in-stock",
    //           condition: "new",
    //           start_time: now,
    //           note: `Thiết bị quay về kho do phiếu ${ticket.type === 'uninstall' ? 'tháo dỡ' : 'lắp đặt'} ${ticket._id} quá hạn`,
    //           handled_by: ticket.employee_id || null,
    //         }));
    
    //         await EquipmentLog.insertMany(logs);
    //       }
    
    //       // soft delete detail
    //       await InstallDetail.deleteMany(
    //         { install_id: ticket._id }
    //       );
    //     }
    
    //     // thông báo phiếu quá hạn
    //     if (expiredTickets.length) {
    //       const managerIds = managers.map(m => m._id);
          
    //       for (const ticket of expiredTickets) {
    //         try {
    //           await pushNotificationToUsers(
    //             managerIds,
    //             "Phiếu lắp đặt thiết bị quá hạn",
    //             `Phiếu lắp đặt thiết bị ${ticket._id} đã quá hạn và bị hủy.`,
    //             "equipment",
    //             "EquipmentInstall",
    //             ticket._id,
    //             "unread"
    //           );
    //         } catch (error) {
    //           console.error(`Error sending notification for expired install ticket ${ticket._id}:`, error);
    //         }
    //       }
    //       console.log(`[CRON] done updating ${expiredTickets.length} expired install tickets.`)
    //     }
    
    //     // phiếu đến ngày: chuyển từ "pending" → "waiting_confirm" nếu chưa gán nhân viên
    //     // hoặc từ "pending" → "assigned" nếu đã gán nhân viên (nhưng logic này đã được xử lý ở createInstallTicket)
    //     const todayTickets = await EquipmentInstall.find({
    //       status: "pending",
    //       install_date: { $gte: start, $lte: end },
    //     });
    
    //     if (todayTickets.length) {
    //       await EquipmentInstall.updateMany(
    //         { _id: { $in: todayTickets.map(t => t._id) } },
    //         { status: "waiting_confirm" },
    //       );
    
    //       const managerIds = managers.map(m => m._id);
          
    //       for (const ticket of todayTickets) {
    //         try {
    //           await pushNotificationToUsers(
    //             managerIds,
    //             "Phiếu lắp đặt thiết bị đến ngày",
    //             `Phiếu lắp đặt thiết bị ${ticket._id} đã đến ngày lắp đặt.`,
    //             "equipment",
    //             "EquipmentInstall",
    //             ticket._id,
    //             "unread"
    //           );
    //         } catch (error) {
    //           console.error(`Error sending notification for today install ticket ${ticket._id}:`, error);
    //         }
    //       }
    
    //       console.log(`[CRON] done updating ${todayTickets.length} pending install tickets.`);
    //     }
    
    //     // await session.commitTransaction();
    //     // session.endSession();
    //   } catch (err) {
    //     // await session.abortTransaction();
    //     // session.endSession();
    //     console.error("[CRON] notifyInstallTickets error:", err);
    //   }
    // };
}