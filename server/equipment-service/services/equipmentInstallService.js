import mongoose from "mongoose";
import { EMPLOYEE_EVENTS } from "../../shared/events/employeeEvents.js";

export class EquipmentInstallService {
    constructor({ Equipment, EquipmentCategory, EquipmentLog, InstallTicket, InstallDetail, eventBus }) {
        this.Equipment = Equipment;
        this.EquipmentCategory = EquipmentCategory;
        this.EquipmentLog = EquipmentLog;
        this.InstallTicket = InstallTicket;
        this.InstallDetail = InstallDetail;
        this.eventBus = eventBus;
    }

    // HELPER

    async getBusyEquipmentIds(extraFilter = {}) {
        const activeTickets = await this.InstallTicket.find({
            status: { $in: ["pending", "assigned", "waiting_confirm"] },
            ...extraFilter
        }).select("_id");

        const ticketIds = activeTickets.map(t => t._id);

        if (!ticketIds.length) return [];

        const details = await this.InstallDetail.find({
            ticket_id: { $in: ticketIds }
        }).select("equipment_id");

        const busyIds = details.map(d => d.equipment_id.toString());

        return { activeInstallTicketIds: ticketIds, busyEquipmentIds: busyIds };
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
                const eq = await this.Equipment.findOne({
                    _id: item.specific_equipment_id,
                    ...baseQuery,
                    status: { $ne: "installing" }, 
                    _id: { $nin: busyIds }
                });

                if (!eq) {
                    throw new Error(`Thiết bị ${item.specific_equipment_id} không khả dụng.`);
                }

                selected.push(eq._id);
            }

            // category-based
            else if (item.category_id) {
                const quantity = Number(item.quantity) || 1;

                const eqs = await this.Equipment.find({
                    category_id: item.category_id,
                    ...baseQuery,
                    status: { $ne: "installing" }, 
                    _id: { $nin: busyIds }
                }).limit(quantity);

                if (eqs.length < quantity) {
                    throw new Error(`Không đủ thiết bị cho category ${item.category_id}`);
                }

                eqs.forEach(e => {
                    selected.push(e._id);
                    busyIds.push(e._id.toString());
                });
            }
        }

        if (!selected.length) {
            throw new Error("Danh sách thiết bị trống.");
        }

        return selected;
    }

    populateEmployeeAndHandler = async (installs) => {
        const employeeIds = [...new Set(
            installs
                .map(i => i.employee_id?.toString())
                .filter(Boolean)
        )];

        const handlerIds = [...new Set(
            installs
                .map(i => i.handled_by?.toString())
                .filter(Boolean)
        )];


        let employeeMap = {};
        let handlerMap = {};

        if (employeeIds.length > 0) {
            const reply = await this.eventBus.request(
                EMPLOYEE_EVENTS.GET_INFO,
                { employee_ids: employeeIds }
            );
            for (const emp of reply.employees) {
                employeeMap[emp._id.toString()] = emp;
            }
        }

        if (handlerIds.length > 0) {
            const reply = await this.eventBus.request(
                EMPLOYEE_EVENTS.GET_INFO,
                { employee_ids: handlerIds }
            );
            for (const emp of reply.employees) {
                handlerMap[emp._id.toString()] = emp;
            }
        }

        const results = installs.map(install => ({
            ...install,
            employee_info: employeeMap[install.employee_id?.toString()] || null,
            handler_info: handlerMap[install.handled_by?.toString()] || null
        }));

        return results;
    }

    // MAIN FUNCTIONS
    
    createInstallTicket = async (employeeUserId, data) => {
        try {
            const { room_id, install_date, items, handled_by } = data;
    
            if (!install_date || !room_id) {
                throw new Error("Yêu cầu nhập đầy đủ thông tin: room_id, install_date.");
            }
    
            if (employeeUserId) {
                const reply = await this.eventBus.request(
                    EMPLOYEE_EVENTS.CHECK_EXISTS_USERID,
                    { employee_user_id: employeeUserId }
                );
                if (!reply.found)
                    throw new Error("Không tìm thấy nhân viên.");
            }
    
            // const targetRoom = await Room.findById(room_id).session(session);
            // if (!targetRoom) {
            //     await session.abortTransaction();
            //     return res.status(400).json({ success: false, message: "Không tìm thấy phòng đích." });
            // }
                
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
                // const reply = await this.eventBus.request(
                //     EMPLOYEE_EVENTS.CHECK_EXISTS,
                //     { employeeId }
                // );

                // if (!reply.found)
                //     throw new Error("Không tìm thấy nhân viên.");
                // handledByEmployee = await Employee.findOne({ 
                //     _id: handled_by,
                //     position: "technician",
                //     status: "working"
                // }).session(session);
    
                // if (!handledByEmployee) {
                //     await session.abortTransaction();
                //     return res.status(400).json({ 
                //         success: false, 
                //         message: "Nhân viên kỹ thuật không hợp lệ hoặc không tồn tại." 
                //     });
                // }
    
                const activeTicket = await this.InstallTicket.findOne({
                    handled_by: handled_by,
                    status: { $in: ["pending", "assigned", "waiting_confirm"] }
                });
                if (activeTicket) {
                    throw new Error("Nhân viên này đang có phiếu đang xử lý, không thể gán thêm.");
                }
            }
    
            const install = await this.InstallTicket.create({
                employee_id: employeeUserId,
                handled_by: handled_by || null,
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
                handled_by: employeeUserId
            });
                
            // Gửi thông báo
            // try {
            //   // Gửi thông báo cho nhân viên được gán (nếu có)
            //   if (handledByEmployee && handledByEmployee.user_id) {
            //     const roomText = ` phòng ${targetRoom.room_number}`;
                
            //     await pushNotificationToUsers(
            //       [handledByEmployee.user_id],
            //       "Công việc mới được gán",
            //       `Bạn được gán phiếu lắp đặt thiết bị${roomText} #${install._id.toString().slice(-6)}`,
            //       "equipment",
            //       "EquipmentInstall",
            //       install._id,
            //       "unread"
            //     );
            //   }
    
            //   // Gửi thông báo cho admin về phiếu lắp đặt mới
            //   const adminUsers = await User.find({ 
            //     isBanned: { $ne: true },
            //     system_role: "manager"
            //   }).select("_id");
            //   const adminUserIds = adminUsers.map(u => u._id);
              
            //   if (adminUserIds.length > 0) {
            //     await pushNotificationToUsers(
            //       adminUserIds,
            //       "Phiếu lắp đặt mới",
            //       `Có phiếu lắp đặt thiết bị mới #${install._id.toString().slice(-6)} được tạo${handledByEmployee ? ` và đã gán cho ${handledByEmployee.full_name}` : ''}`,
            //       "system",
            //       "EquipmentInstall",
            //       install._id,
            //       "unread"
            //     );
            //   }
            // } catch (notifError) {
            //   console.error("Error sending notification:", notifError);
            //   // Không throw error để không ảnh hưởng đến response chính
            // }
            
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

            if (employeeUserId) {
                const reply = await this.eventBus.request(
                    EMPLOYEE_EVENTS.CHECK_EXISTS_USERID,
                    { employee_user_id: employeeUserId }
                );
                if (!reply.found)
                    throw new Error("Không tìm thấy nhân viên.");
            }
    
            // // Validate from_room_id
            // const sourceRoom = await Room.findById(from_room_id).session(session);
            // if (!sourceRoom) {
            //     await session.abortTransaction();
            //     return res.status(400).json({ success: false, message: "Không tìm thấy phòng nguồn." });
            // }
        
            const { activeInstallTicketIds, busyEquipmentIds } = await this.getBusyEquipmentIds();
            
            const sourceQuery = {
                status: "in-use",
                room_id: from_room_id
            };

            const selectedEquipmentIds = await this.selectEquipments({
                items, 
                sourceQuery,
                busyEquipmentIds
            })

            const status = this.calculateStatus({ install_date, handled_by });
    
                        
            const installDate = new Date(install_date);
            installDate.setHours(0, 0, 0, 0);
            
            const sameDateUninstallTickets = await this.InstallTicket.find({
                type: 'uninstall',
                status: { $in: ["pending", "assigned", "waiting_confirm"] },
                install_date: {
                    $gte: installDate,
                    $lt: new Date(installDate.getTime() + 24 * 60 * 60 * 1000)
                }
            }).select("_id");
            
            const sameDateUninstallTicketIds = sameDateUninstallTickets.map(t => t._id);
            
            if (sameDateUninstallTicketIds.length > 0) {
                const sameDateBusyDetails = await this.InstallDetail.find({
                    ticket_id: { $in: sameDateUninstallTicketIds }
                }).select("equipment_id");
                
                busyEquipmentIds.push(...sameDateBusyDetails.map(d => d.equipment_id));
            }
    
            for (const item of items) {
                if (item.specific_equipment_id) {

                    if (!mongoose.Types.ObjectId.isValid(item.specific_equipment_id)) {
                        throw new Error(`ID thiết bị không hợp lệ: ${item.specific_equipment_id}`);
                    }
    
                    const eq = await this.Equipment.findOne({
                        _id: item.specific_equipment_id,
                        ...sourceQuery,
                        status: { $nin: ["installing", "removing"] }
                    })
                    .populate("category_id", "name");
    
                    if (!eq) {
                        throw new Error(`Thiết bị có ID ${item.specific_equipment_id} không khả dụng tại phòng ${sourceRoom.room_number} hoặc đang được sử dụng trong phiếu khác. Thiết bị phải có status=in-use và room_id=${from_room_id}.`);
                    }
    
                    const equipmentIdStr = eq._id.toString();
                    const isBusy = busyEquipmentIds.some(busyId => busyId.toString() === equipmentIdStr);
                    if (isBusy) {
                        throw new Error(`Thiết bị có ID ${item.specific_equipment_id} đang được sử dụng trong phiếu khác.`);
                    }
    
                    if (eq._id.toString() !== item.specific_equipment_id.toString()) {
                        throw new Error(`Lỗi: ID thiết bị không khớp. Yêu cầu: ${item.specific_equipment_id}, Tìm thấy: ${eq._id}`);
                    }
    
                    selectedEquipmentIds.push(eq._id);
                }
                else if (item.category_id) {
                    const quantity = Number(item.quantity) || 1;
                    
                    const query = {
                        category_id: item.category_id,
                        ...sourceQuery,
                        status: { $nin: ["installing", "removing"] },
                        _id: { $nin: busyEquipmentIds }
                    };
                    
                    const availableEqs = await this.Equipment.find(query).limit(quantity);
    
                    if (availableEqs.length < quantity) {
                        throw new Error(`Không đủ số lượng cho danh mục ${item.category_id} tại phòng này. Có thể một số thiết bị đang được sử dụng trong phiếu khác.`);
                    }
    
                    availableEqs.forEach(e => {
                        selectedEquipmentIds.push(e._id);
                        busyEquipmentIds.push(e._id);
                    });
                }
            }
    
            if (selectedEquipmentIds.length === 0) {
                throw new Error("Danh sách thiết bị trống.");
            }
    
            const existedDetail = await this.InstallDetail.findOne({
                equipment_id: { $in: selectedEquipmentIds },
                ticket_id: { $in: activeInstallTicketIds }
            });
    
            if (existedDetail) {
                const install_ticket = await this.InstallTicket.findById(existedDetail.ticket_id);
                throw new Error(`Có thiết bị đang thuộc phiếu xử lý khác (Phiếu #${install_ticket?._id.toString().slice(-6) || 'N/A'}).`);
            }
    
            // let handledByEmployee = null;
            // if (handled_by) {
            //     handledByEmployee = await Employee.findOne({ 
            //         _id: handled_by,
            //         position: "technician",
            //         status: "working"
            //     }).session(session);
    
            //     if (!handledByEmployee) {
            //         await session.abortTransaction();
            //         return res.status(400).json({ 
            //             success: false, 
            //             message: "Nhân viên kỹ thuật không hợp lệ hoặc không tồn tại." 
            //         });
            //     }
    
            //     // Kiểm tra nhân viên có đang bận không
            //     // const activeTicket = await EquipmentInstall.findOne({
            //     //     handled_by: handled_by,
            //     //     status: { $in: ["pending", "assigned", "waiting_confirm"] }
            //     // }).session(session);
    
            //     // if (activeTicket) {
            //     //     await session.abortTransaction();
            //     //     return res.status(400).json({ 
            //     //         success: false, 
            //     //         message: "Nhân viên này đang có phiếu đang xử lý, không thể gán thêm." 
            //     //     });
            //     // }
            // }
    
            // Xác định status dựa trên install_date và handled_by
    
            const install = await this.InstallTicket.create({
                    employee_id: employeeUserId,
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
                handled_by: employeeUserId
            });
                
            // Gửi thông báo
            // try {
            //   if (handledByEmployee && handledByEmployee.user_id) {
            //     const roomText = `Phòng ${sourceRoom.room_number}`;
                
            //     await pushNotificationToUsers(
            //       [handledByEmployee.user_id],
            //       "Công việc mới được gán",
            //       `Bạn được gán phiếu tháo dỡ thiết bị${roomText} #${install._id.toString().slice(-6)}`,
            //       "equipment",
            //       "EquipmentInstall",
            //       install._id,
            //       "unread"
            //     );
            //   }
    
            //   const adminUsers = await User.find({ 
            //     isBanned: { $ne: true },
            //     system_role: "manager"
            //   }).select("_id");
            //   const adminUserIds = adminUsers.map(u => u._id);
              
            //   if (adminUserIds.length > 0) {
            //     await pushNotificationToUsers(
            //       adminUserIds,
            //       "Phiếu tháo dỡ mới",
            //       `Có phiếu tháo dỡ thiết bị mới #${install._id.toString().slice(-6)} được tạo${handledByEmployee ? ` và đã gán cho ${handledByEmployee.full_name}` : ''}`,
            //       "system",
            //       "EquipmentInstall",
            //       install._id,
            //       "unread"
            //     );
            //   }
            // } catch (notifError) {
            //   console.error("Error sending notification:", notifError);
            // }
            
            return install;
    
        } catch (error) {
            console.log("Error in creating uninstall equipment ticket: ", error.message);
            throw error;
        }
    };
    
    getAllEquipmentInstalls = async (query = {}) => {
        try {
            const { employee_id, room_id, min_install_date, max_install_date, status } = query;
            let filter = {};
        
            if (employee_id) {
                const reply = await this.eventBus.request(
                    EMPLOYEE_EVENTS.CHECK_EXISTS,
                    { employee_id }
                );

                if (!reply.found)
                    throw new Error("Không tìm thấy nhân viên.");

                filter.employee_id = employee_id;
            }
        
            // if (room_id) {
            //     const room = await Room.findById(room_id);
            //     if (!room)
            //         return res.status(400).json({ success: false, message: "Không tìm thấy phòng." });
        
            //     filter.room_id = room_id;
            // }
        
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
                // .populate("room_id", "room_number")
                // .populate("employee_id", "full_name")
                // .populate("handled_by", "full_name phone_number");

            const results = await this.populateEmployeeAndHandler(installs);

            return { counts: results.length, installs: results };
            
        } catch (error) {
            console.log("Error in getting all equipment install tickets: ", error.message);
            throw error;
        }
    };
    
    // getSmartInstallSuggestions = async (roomId) => {
    //   try {    
    //     if (!roomId) {
    //         throw new Error("Vui lòng cung cấp room_id");
    //     }
    
    //     // const room = await Room.findById(room_id).populate("category_id", "_id category_name");
    //     // if (!room) {
    //     //   return res.status(404).json({
    //     //     success: false,
    //     //     message: "Không tìm thấy phòng"
    //     //   });
    //     // }
    
    //     // if (!room.category_id) {
    //     //   return res.status(400).json({
    //     //     success: false,
    //     //     message: "Phòng này chưa có loại phòng"
    //     //   });
    //     // }
    
    //     const defaultEquipments = await DefaultEquipment.find({
    //       category_id: room.category_id._id
    //     }).populate("equipment_category_id", "name description unit");
    
    //     if (defaultEquipments.length === 0) {
    //       return res.status(200).json({
    //         success: true,
    //         suggestions: [],
    //         message: "Loại phòng này không có thiết bị mặc định"
    //       });
    //     }
    
    //     // Lấy danh sách thiết bị hiện có trong phòng (status = "in-use")
    //     const currentEquipments = await Equipment.find({
    //       room_id: room_id,
    //       status: "in-use"
    //     }).populate("category_id", "_id name");
    
    //     // Đếm số lượng từng loại thiết bị hiện có trong phòng
    //     const currentEquipmentCount = {};
    //     currentEquipments.forEach(eq => {
    //       const catId = eq.category_id?._id?.toString() || eq.category_id?.toString();
    //       if (catId) {
    //         currentEquipmentCount[catId] = (currentEquipmentCount[catId] || 0) + 1;
    //       }
    //     });
    
    //     // Kiểm tra số lượng thiết bị có sẵn trong kho (status = "in-stock")
    //     const stockEquipmentCount = {};
    //     const stockEquipments = await Equipment.find({
    //       status: "in-stock",
    //       room_id: null,
    //       condition: { $in: ["new", "good"] }
    //     }).populate("category_id", "_id name");
        
    //     stockEquipments.forEach(eq => {
    //       const catId = eq.category_id?._id?.toString() || eq.category_id?.toString();
    //       if (catId) {
    //         stockEquipmentCount[catId] = (stockEquipmentCount[catId] || 0) + 1;
    //       }
    //     });
    
    //     // So sánh với thiết bị mặc định và tạo danh sách gợi ý
    //     const suggestions = [];
    //     for (const defaultEq of defaultEquipments) {
    //       const equipmentCategoryId = defaultEq.equipment_category_id?._id?.toString() || defaultEq.equipment_category_id?.toString();
    //       const requiredQuantity = defaultEq.quantity || 0;
    //       const currentQuantity = currentEquipmentCount[equipmentCategoryId] || 0;
    //       const neededQuantity = requiredQuantity - currentQuantity;
    //       const availableInStock = stockEquipmentCount[equipmentCategoryId] || 0;
    
    //       // Chỉ gợi ý nếu thiếu thiết bị (neededQuantity > 0) và có sẵn trong kho
    //       if (neededQuantity > 0 && availableInStock > 0) {
    //         // Số lượng gợi ý = min(neededQuantity, availableInStock)
    //         const suggestedQuantity = Math.min(neededQuantity, availableInStock);
            
    //         suggestions.push({
    //           category_id: equipmentCategoryId,
    //           category_name: defaultEq.equipment_category_id?.name || "Unknown",
    //           category_description: defaultEq.equipment_category_id?.description || "",
    //           category_unit: defaultEq.equipment_category_id?.unit || "item",
    //           required_quantity: requiredQuantity,
    //           current_quantity: currentQuantity,
    //           needed_quantity: neededQuantity,
    //           available_in_stock: availableInStock,
    //           suggested_quantity: suggestedQuantity,
    //           reason: currentQuantity === 0 
    //             ? `Thiết bị chưa có trong phòng (cần ${requiredQuantity}, có ${availableInStock} trong kho)` 
    //             : `Thiếu ${neededQuantity} ${defaultEq.equipment_category_id?.unit || "cái"} (hiện có ${currentQuantity}/${requiredQuantity}, có ${availableInStock} trong kho)`
    //         });
    //       }
    //     }
    
    //     // Sắp xếp theo thứ tự ưu tiên: thiết bị chưa có trước, sau đó là thiết bị thiếu
    //     suggestions.sort((a, b) => {
    //       if (a.current_quantity === 0 && b.current_quantity > 0) return -1;
    //       if (a.current_quantity > 0 && b.current_quantity === 0) return 1;
    //       return b.needed_quantity - a.needed_quantity;
    //     });
    
    //     return res.status(200).json({
    //       success: true,
    //       room_id: room_id,
    //       room_number: room.room_number,
    //       room_category: room.category_id.category_name,
    //       suggestions: suggestions,
    //       total_suggestions: suggestions.length
    //     });
    
    //   } catch (error) {
    //     console.error("Error in getSmartInstallSuggestions:", error);
    //     return res.status(500).json({
    //       success: false,
    //       message: "Lỗi server: " + error.message
    //     });
    //   }
    // };
    
    getMyInstallTickets = async (employeeUserId, status) => {
        try {
            const reply = await this.eventBus.request(
                EMPLOYEE_EVENTS.GET_INFO_USERID,
                { employee_user_id: employeeUserId }
            );
            if (!reply.found)
                throw new Error("Không tìm thấy nhân viên.");

            const employee = reply.employee;
            let filter = { handled_by: employee._id };
            if (status) {
            filter.status = status;
            }
        
            const installs = await this.InstallTicket.find(filter)
                .sort({ created_at: -1 })
                .select("-created_at -updated_at -__v")
                .lean();
            //   .populate("room_id", "room_number")
            //   .populate("employee_id", "full_name")
            //   .populate({
            //     path: "handled_by",
            //     select: "full_name phone_number"
            //   })

            const result = await this.populateEmployeeAndHandler(installs);

            return { count: result.length, installs: result };
        
        } catch (error) {
            console.log("Error in getting my equipment install/uninstall tickets: ", error.message);
            throw error;
        }
    };
    
    getEquipmentInstallById = async (ticketId) => {
        try {
            const install = await this.InstallTicket.findById(ticketId)
                .select("-created_at -updated_at -__v")
            //   .populate("room_id", "room_number")
            //   .populate("employee_id", "full_name")
            //   .populate("handled_by", "full_name phone_number");
        
            const result = await this.populateEmployeeAndHandler(install);

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

            return { install: 
                {
                    ...result.toObject(),
                    install_details: installDetails
                } 
            };
        
        } catch (error) {
            console.log("Error in getting equipment un/install ticket: ", error.message);
            throw error;
        }
    };
    
    updateEquipmentInstall = async (ticketId, data) => {
        try {
            const { room_id, install_date, items, handled_by } = data;
    
            const install_ticket = await this.InstallTicket.findById(ticketId);
            if (!install_ticket) {
                throw new Error("Không tìm thấy phiếu lắp đặt thiết bị.");
            }
    
            if (install_ticket.status === "completed" || install_ticket.status === "expired") {
                throw new Error("Không thể chỉnh sửa phiếu đã hoàn tất hoặc quá hạn.");
            }
    
            if (install_ticket.started_at) {
                throw new Error("Không thể chỉnh sửa phiếu khi nhân viên đã bắt đầu công việc.");
            }
    
            const today = new Date();
            today.setHours(0, 0, 0, 0);
    
            const ticketDate = new Date(install_ticket.install_date);
            ticketDate.setHours(0, 0, 0, 0);
    
            const hasArrived = ticketDate <= today;
            const hasAssignedTechnician = install_ticket.handled_by !== null && install_ticket.handled_by !== undefined;
    
            if (hasArrived && hasAssignedTechnician) {
                throw new Error("Không thể cập nhật phiếu vì đã đến ngày lắp đặt và đã gán nhân viên.");
            }
    
            // if (room_id) {
            //     const room = await Room.findById(room_id).session(session);
            //     if (!room) {
            //         await session.abortTransaction();
            //         return res.status(400).json({ success: false, message: "Không tìm thấy phòng." });
            //     }
            //     install_ticket.room_id = room_id;
            // }
    
            if (install_date) {
                const installDate = new Date(install_date);
                installDate.setHours(0, 0, 0, 0);
    
                if (installDate < today) {
                    throw new Error("Ngày lắp đặt không hợp lệ! Không thể nhỏ hơn ngày hiện tại.");
                }
    
                if (ticketDate <= today && installDate.getTime() !== ticketDate.getTime()) {
                    throw new Error("Không thể thay đổi ngày khi đã đến hoặc qua ngày lắp đặt thiết bị");
                }
            } else if (ticketDate <= today) {
                if (handled_by === undefined) {
                    throw new Error("Không thể sửa người thực hiện khi đã đến hoặc qua ngày lắp đặt thiết bị");
                }
            }
    
            if (handled_by !== undefined) {
                if (handled_by === null || handled_by === "") {
                    install_ticket.handled_by = null;
                } else {
                    // const technician = await Employee.findOne({ 
                    //     _id: handled_by,
                    //     position: "technician",
                    //     status: "working"
                    // });
    
                    // if (!technician) {
                    //     await session.abortTransaction();
                    //     return res.status(400).json({ 
                    //         success: false, 
                    //         message: "Nhân viên kỹ thuật không hợp lệ hoặc không tồn tại." 
                    //     });
                    // }
    
                    if (!install_ticket.handled_by || install_ticket.handled_by.toString() !== handled_by) {
                        const activeTicket = await this.InstallTicket.findOne({
                            handled_by: handled_by,
                            status: { $in: ["pending", "assigned", "waiting_confirm"] },
                            _id: { $ne: install_ticket._id }
                        });
    
                        if (activeTicket) {
                            throw new Error("Nhân viên này đang có phiếu đang xử lý, không thể gán thêm.");
                        }
                    }
    
                    install_ticket.handled_by = handled_by;
                }
            }
    
            if (install_date) {
                 install_ticket.install_date = install_date;
                 
                 const installDate = new Date(install_date);
                 installDate.setHours(0, 0, 0, 0);
                 const isToday = installDate.getTime() === today.getTime();
                 
                 if (installDate.getTime() >= today.getTime()) {
                     if (install_ticket.handled_by) {
                         install_ticket.status = "assigned"; 
                     } else if (isToday) {
                         install_ticket.status = "waiting_confirm"; 
                     } else {
                         install_ticket.status = "pending";
                     }
                 }
            }
            
            if (handled_by !== undefined && !install_date) {
                const installDate = new Date(install_ticket.install_date);
                installDate.setHours(0, 0, 0, 0);
                const isToday = installDate.getTime() === today.getTime();
                
                if (install_ticket.handled_by) {
                    install_ticket.status = "assigned";
                } else if (isToday) {
                    install_ticket.status = "waiting_confirm";
                } else {
                    install_ticket.status = "pending";
                }
            }
    
            await install_ticket.save();
    
            if (!items || !Array.isArray(items) || items.length === 0) {
                // Gửi thông báo nếu thay đổi nhân viên
                try {
                    if (handled_by !== undefined && install_ticket.handled_by) {
                        const updatedTicket = await this.InstallTicket.findById(install_ticket._id)
                            .populate("room_id", "room_number")
                            .populate("handled_by", "user_id full_name");
                        
                        if (updatedTicket.handled_by && updatedTicket.handled_by.user_id) {
                            const roomText = updatedTicket.room_id ? ` phòng ${updatedTicket.room_id.room_number}` : "";
                            const typeText = install_ticket.type === 'uninstall' ? 'tháo dỡ' : 'lắp đặt';
                            
                            await pushNotificationToUsers(
                                [updatedTicket.handled_by.user_id],
                                "Công việc mới được gán",
                                `Bạn được gán phiếu ${typeText} thiết bị${roomText} #${install_ticket._id.toString().slice(-6)}`,
                                "equipment",
                                "EquipmentInstall",
                                install_ticket._id,
                                "unread"
                            );
                        }
                    }
                } catch (notifError) {
                    console.error("Error sending notification:", notifError);
                }
    
                return res.status(200).json({
                    success: true,
                    message: "Cập nhật phiếu lắp đặt thiết bị thành công.",
                    data: {
                        install_ticket
                    }
                });
            }
    
            const categoryIds = [];
    
            for (const item of items) {
                 if ( !item.category_id || !mongoose.Types.ObjectId.isValid(item.category_id) || !Number.isInteger(item.quantity) || item.quantity <= 0 ) {
                     await session.abortTransaction();
                     return res.status(400).json({ success: false, message: "Danh sách thiết bị không hợp lệ (category_id hoặc quantity)." });
                 }
                 categoryIds.push(item.category_id.toString());
            }
    
            if (new Set(categoryIds).size !== categoryIds.length) {
                await session.abortTransaction();
                return res.status(400).json({ success: false, message: "Danh sách loại thiết bị bị trùng." });
            }
    
            // Lấy danh sách thiết bị đang trong phiếu lắp đặt khác để loại trừ
            const activeInstallTickets = await this.InstallTicket.find({
                status: { $in: ["pending", "assigned", "waiting_confirm"] },
                _id: { $ne: install_ticket._id } // Loại trừ phiếu hiện tại
            }).select("_id").session(session);
            
            const activeInstallTicketIds = activeInstallTickets.map(t => t._id);
            const busyEquipmentIds = [];
            
            if (activeInstallTicketIds.length > 0) {
                const busyDetails = await InstallDetail.find({
                    install_id: { $in: activeInstallTicketIds }
                }).select("equipment_id").session(session);
                
                busyEquipmentIds.push(...busyDetails.map(d => d.equipment_id));
            }
    
            // Chỉ lấy thiết bị từ kho với điều kiện chặt chẽ (giống createInstallTicket)
            const equipments = await Equipment.find({
                category_id: { $in: categoryIds },
                status: "in-stock",
                condition: { $in: ["new", "good"] }, // Chỉ thiết bị mới hoặc đã sửa chữa thành công
                room_id: null, // Không thuộc phòng nào
                _id: { $nin: busyEquipmentIds } // Loại trừ thiết bị đang trong phiếu khác
            }).sort({ createdAt: 1 }).session(session);
    
            const equipmentMap = new Map();
            for (const eq of equipments) {
                const key = eq.category_id.toString();
                if (!equipmentMap.has(key)) equipmentMap.set(key, []);
                equipmentMap.get(key).push(eq);
            }
    
            const selectedEquipments = [];
            for (const item of items) {
                const available = equipmentMap.get(item.category_id.toString()) || [];
    
                if (available.length < item.quantity) {
                    await session.abortTransaction();
                    return res.status(400).json({ success: false, message: `Tồn kho thiết bị của danh mục ${item.category_id} không đủ để lắp đặt.` });
                }
    
                selectedEquipments.push(...available.slice(0, item.quantity));
            }
    
            const selectedEquipmentIds = selectedEquipments.map(e => e._id);
    
            const existedDetail = await InstallDetail.findOne({
                equipment_id: { $in: selectedEquipmentIds },
            }).session(session);
    
            if (existedDetail) {
                await session.abortTransaction();
                return res.status(400).json({ success: false, message: "Có thiết bị đang thuộc phiếu lắp đặt khác." });
            }
    
            const now = new Date();
    
            const oldDetails = await InstallDetail.find({ install_id: install_ticket._id }).session(session);
            const oldEquipmentIds = oldDetails.map(d => d.equipment_id);
    
            // update condition và status của các equipment cũ
            await Equipment.updateMany(
                { _id: { $in: oldEquipmentIds } },
                { 
                    status: "in-stock", 
                    condition: "new",
                    room_id: null // Xóa room_id khi trả về kho
                },
                { session }
            );
    
            // Lưu ý: Không cộng lại storage_quantity vì chưa trừ kho (chỉ trừ khi xác nhận lắp đặt thành công)
    
            // xóa chi tiết cũ
            await InstallDetail.deleteMany(
                { install_id: install_ticket._id },
                { session }
            );
    
            // đóng log cũ
            await EquipmentLog.updateMany(
                {
                    equipment_id: { $in: oldEquipmentIds },
                    end_time: null,
                },
                { $set: { end_time: now } },
                { session }
            );
            // tạo log cho condition "new" và status "in-stock" của thiết bị cũ
            const oldEquipmentLogs = oldEquipmentIds.map((equipmentId) => ({
                equipment_id: equipmentId,
                room_id: null, // room_id = null khi về kho
                status: "in-stock",
                condition: "new",
                start_time: now,
                end_time: null,
                note: "Thiết bị đang ở kho",
                handled_by: install_ticket.employee_id || null,
            }));
    
            await EquipmentLog.insertMany(oldEquipmentLogs, { session });
    
            // insert chi tiết mới
            const details = selectedEquipmentIds.map((eid) => ({
                install_id: install_ticket._id,
                equipment_id: eid,
            }));
            await InstallDetail.insertMany(details, { session });
    
            // Cập nhật status và room_id của thiết bị mới khi đang trong phiếu lắp đặt
            await Equipment.updateMany(
                { _id: { $in: selectedEquipmentIds } },
                { 
                    status: "installing",
                    room_id: install_ticket.room_id // Cập nhật room_id ngay khi tạo phiếu lắp đặt
                },
                { session }
            );
            
            // Lưu ý: Không trừ storage_quantity ở đây, chỉ trừ khi xác nhận lắp đặt thành công (confirmEquipmentInstall)
    
            // đóng log cũ
            await EquipmentLog.updateMany(
                {
                    equipment_id: { $in: selectedEquipmentIds },
                    end_time: null,
                },
                { $set: { end_time: now } },
                { session }
            );
            // thêm log mới
            const logs = selectedEquipmentIds.map((equipmentId) => ({
                equipment_id: equipmentId,
                room_id: install_ticket.room_id,
                status: "installing",
                condition: "new",
                start_time: now,
                end_time: null,
                note: "Thiết bị đang chờ lắp đặt",
                handled_by: install_ticket.employee_id || null,
            }));
    
            await EquipmentLog.insertMany(logs, { session });
    
            await session.commitTransaction();
    
            // Gửi thông báo nếu thay đổi nhân viên được gán
            try {
                if (handled_by !== undefined && install_ticket.handled_by) {
                    const updatedTicket = await this.InstallTicket.findById(install_ticket._id)
                        .populate("room_id", "room_number")
                        .populate("handled_by", "user_id full_name");
                    
                    if (updatedTicket.handled_by && updatedTicket.handled_by.user_id) {
                        const roomText = updatedTicket.room_id ? ` phòng ${updatedTicket.room_id.room_number}` : "";
                        const typeText = install_ticket.type === 'uninstall' ? 'tháo dỡ' : 'lắp đặt';
                        
                        await pushNotificationToUsers(
                            [updatedTicket.handled_by.user_id],
                            "Công việc mới được gán",
                            `Bạn được gán phiếu ${typeText} thiết bị${roomText} #${install_ticket._id.toString().slice(-6)}`,
                            "equipment",
                            "EquipmentInstall",
                            install_ticket._id,
                            "unread"
                        );
                    }
                }
            } catch (notifError) {
                console.error("Error sending notification:", notifError);
            }
    
            return res.status(200).json({
            success: true,
            message: "Cập nhật phiếu lắp đặt thiết bị thành công.",
            data: {
                install_ticket,
                equipment_count: details.length,
            },
            });
    
        } catch (error) {
            await session.abortTransaction();
            res.status(500).json({ success: false, message: "SERVER ERROR: " + error.message });
        } finally {
            session.endSession();
        }
    };
    
    deleteEquipmentInstall = async (ticketId) => {
        try {
            if (!mongoose.Types.ObjectId.isValid(ticketId)) {
                throw new Error("ID phiếu lắp đặt không hợp lệ.");
            }
        
            const installTicket = await this.InstallTicket.findById(ticketId).lean();
                // .populate("room_id", "room_number")
                // .populate("handled_by", "user_id full_name")
                // .populate("employee_id", "full_name")
        
            if (!installTicket) {
                throw new Error("Không tìm thấy phiếu lắp đặt thiết bị.");
            }
        
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
        
            const roomText = installTicket.room_id ? ` phòng ${installTicket.room_id.room_number}` : "";
            const typeText = installTicket.type === 'uninstall' ? 'tháo dỡ' : 'lắp đặt';
            const ticketId = installTicket._id.toString().slice(-6);
            const technicianName = installTicket.handled_by?.full_name || null;
            const technicianUserId = installTicket.handled_by?.user_id || null;
                
            // // Gửi thông báo cho admin và nhân viên (nếu đã gán) sau khi commit transaction
            // try {
            // // Gửi thông báo cho nhân viên được gán (nếu có)
            // if (technicianUserId) {
            //     await pushNotificationToUsers(
            //     [technicianUserId],
            //     "Phiếu đã bị hủy",
            //     `Phiếu ${typeText} thiết bị${roomText} #${ticketId} đã bị hủy.`,
            //     "equipment",
            //     "EquipmentInstall",
            //     installTicket._id,
            //     "unread"
            //     );
            // }
        
            // // Gửi thông báo cho admin
            // const adminUsers = await User.find({ 
            //     isBanned: { $ne: true },
            //     system_role: "manager"
            // }).select("_id");
            // const adminUserIds = adminUsers.map(u => u._id);
            
            // if (adminUserIds.length > 0) {
            //     await pushNotificationToUsers(
            //     adminUserIds,
            //     "Phiếu đã bị hủy",
            //     `Phiếu ${typeText} thiết bị${roomText} #${ticketId} đã bị hủy${technicianName ? ` (đã gán cho ${technicianName})` : ''}.`,
            //     "system",
            //     "EquipmentInstall",
            //     installTicket._id,
            //     "unread"
            //     );
            // }
            // } catch (notifError) {
            // console.error("Error sending notification:", notifError);
            // // Không throw error để không ảnh hưởng đến response chính
            // }
        
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
                throw new Error("Không tìm thấy phiếu lắp đặt thiết bị.");
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
                    await EquipmentCategory.updateOne(
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
                
            // Gửi thông báo cho nhân viên được gán và admin sau khi commit transaction
            // try {
            // // Populate để lấy thông tin phòng và nhân viên
            // const populatedTicket = await EquipmentInstall.findById(ticket._id)
            //     .populate("room_id", "room_number")
            //     .populate("handled_by", "user_id full_name")
            //     .populate("employee_id", "full_name");
        
            // const roomText = populatedTicket.room_id ? ` phòng ${populatedTicket.room_id.room_number}` : "";
            // const typeText = ticket.type === 'uninstall' ? 'tháo dỡ' : 'lắp đặt';
        
            // // Gửi thông báo cho nhân viên được gán
            // if (populatedTicket.handled_by && populatedTicket.handled_by.user_id) {
            //     await pushNotificationToUsers(
            //     [populatedTicket.handled_by.user_id],
            //     "Công việc đã được xác nhận",
            //     `Phiếu ${typeText} thiết bị${roomText} #${ticket._id.toString().slice(-6)} đã được admin xác nhận hoàn thành.`,
            //     "equipment",
            //     "EquipmentInstall",
            //     ticket._id,
            //     "unread"
            //     );
            // }
        
            // // Gửi thông báo cho admin (thông báo xác nhận thành công)
            // const adminUsers = await User.find({ 
            //     isBanned: { $ne: true },
            //     system_role: "manager"
            // }).select("_id");
            // const adminUserIds = adminUsers.map(u => u._id);
            
            // if (adminUserIds.length > 0) {
            //     const technicianName = populatedTicket.handled_by?.full_name || "Nhân viên";
            //     await pushNotificationToUsers(
            //     adminUserIds,
            //     "Đã xác nhận công việc",
            //     `Đã xác nhận hoàn thành phiếu ${typeText} thiết bị${roomText} #${ticket._id.toString().slice(-6)} của ${technicianName}.`,
            //     "equipment",
            //     "EquipmentInstall",
            //     ticket._id,
            //     "unread"
            //     );
            // }
            // } catch (notifError) {
            // console.error("Error sending notification:", notifError);
            // // Không throw error để không ảnh hưởng đến response chính
            // }

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

            const reply = await this.eventBus.request(
                EMPLOYEE_EVENTS.CHECK_EXISTS_USERID,
                { employee_user_id: userId }
            );
            if (!reply.found)
                throw new Error("Không tìm thấy nhân viên.");
            const employee = reply.employee;
        
            const ticket = await this.InstallTicket.findById(ticketId);
        
            if (!ticket) {
                throw new Error("Không tìm thấy phiếu lắp đặt thiết bị.");
            }
        
            if (!ticket.handled_by || ticket.handled_by.toString() !== employee._id.toString()) {
                throw new Error("Bạn không được gán phiếu này.");
            }
        
            if (ticket.status !== "assigned" && ticket.status !== "waiting_confirm") {
                throw new Error("Chỉ có thể bắt đầu phiếu ở trạng thái assigned hoặc waiting_confirm.");
            }
        
            if (ticket.started_at) {
                throw new Error("Phiếu này đã được bắt đầu rồi.");
            }
        
            ticket.status = "waiting_confirm";
            ticket.started_at = new Date();
            await ticket.save();
        
            // Gửi thông báo cho admin và nhân viên được gán
            // try {
            // // Populate để lấy thông tin phòng và nhân viên
            // const populatedTicket = await EquipmentInstall.findById(ticket._id)
            //     .populate("room_id", "room_number")
            //     .populate("handled_by", "user_id full_name")
            //     .populate("employee_id", "full_name");
        
            // const roomText = populatedTicket.room_id ? ` phòng ${populatedTicket.room_id.room_number}` : "";
            // const typeText = ticket.type === 'uninstall' ? 'tháo dỡ' : 'lắp đặt';
        
            // // Gửi thông báo cho nhân viên được gán
            // if (populatedTicket.handled_by && populatedTicket.handled_by.user_id) {
            //     await pushNotificationToUsers(
            //     [populatedTicket.handled_by.user_id],
            //     "Đã bắt đầu công việc",
            //     `Bạn đã bắt đầu phiếu ${typeText} thiết bị${roomText} #${ticket._id.toString().slice(-6)}`,
            //     "equipment",
            //     "EquipmentInstall",
            //     ticket._id,
            //     "unread"
            //     );
            // }
        
            // // Gửi thông báo cho admin
            // const adminUsers = await User.find({ 
            //     isBanned: { $ne: true },
            //     system_role: "manager"
            // }).select("_id");
            // const adminUserIds = adminUsers.map(u => u._id);
            
            // if (adminUserIds.length > 0) {
            //     const technicianName = populatedTicket.handled_by?.full_name || "Nhân viên";
            //     await pushNotificationToUsers(
            //     adminUserIds,
            //     "Nhân viên bắt đầu công việc",
            //     `${technicianName} đã bắt đầu phiếu ${typeText} thiết bị${roomText} #${ticket._id.toString().slice(-6)}`,
            //     "equipment",
            //     "EquipmentInstall",
            //     ticket._id,
            //     "unread"
            //     );
            // }
            // } catch (notifError) {
            // console.error("Error sending notification:", notifError);
            // // Không throw error để không ảnh hưởng đến response chính
            // }
        
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

            const reply = await this.eventBus.request(
                EMPLOYEE_EVENTS.CHECK_EXISTS_USERID,
                { employee_user_id: userId }
            );
            if (!reply.found)
                throw new Error("Không tìm thấy nhân viên.");
            const employee = reply.employee;
        
            const ticket = await this.InstallTicket.findById(ticketId);
        
            if (!ticket) {
                throw new Error("Không tìm thấy phiếu lắp đặt thiết bị.");
            }
        
            if (!ticket.handled_by || ticket.handled_by.toString() !== employee._id.toString()) {
                throw new Error("Bạn không được gán phiếu này.");
            }
        
            if (ticket.started_at) {
                throw new Error("Phiếu này đã được bắt đầu rồi.");
            }

            if (!ticket.started_at) {
                throw new Error("Bạn cần bắt đầu công việc trước khi hoàn thành.");
            }
        
            if (ticket.completed_at) {
                throw new Error("Phiếu này đã được hoàn thành rồi.");
            }
        
            //ticket.status = "completed";
            ticket.completed_at = new Date();
            await ticket.save();
        
            // // Gửi thông báo cho nhân viên được gán và admin
            // try {
            // const roomText = ticket.room_id ? ` phòng ${ticket.room_id.room_number}` : "";
            // const typeText = ticket.type === 'uninstall' ? 'tháo dỡ' : 'lắp đặt';
        
            // // Gửi thông báo cho nhân viên được gán
            // if (ticket.handled_by) {
            //     const technician = await Employee.findById(ticket.handled_by).populate("user_id", "_id");
            //     if (technician && technician.user_id) {
            //     await pushNotificationToUsers(
            //         [technician.user_id._id],
            //         "Công việc đã hoàn thành",
            //         `Bạn đã hoàn thành phiếu ${typeText} thiết bị${roomText} #${ticket._id.toString().slice(-6)}. Đang chờ admin xác nhận.`,
            //         "equipment",
            //         "EquipmentInstall",
            //         ticket._id,
            //         "unread"
            //     );
            //     }
            // }
        
            // // Gửi thông báo cho admin
            // const adminUsers = await User.find({ 
            //     isBanned: { $ne: true },
            //     system_role: "manager"
            // }).select("_id");
            // const adminUserIds = adminUsers.map(u => u._id);
            
            // if (adminUserIds.length > 0) {
            //     await pushNotificationToUsers(
            //     adminUserIds,
            //     "Công việc hoàn thành",
            //     `Nhân viên ${employee.full_name} đã hoàn thành phiếu ${typeText} thiết bị${roomText} #${ticket._id.toString().slice(-6)}. Vui lòng xác nhận.`,
            //     "equipment",
            //     "EquipmentInstall",
            //     ticket._id,
            //     "unread"
            //     );
            // }
            // } catch (notifError) {
            // console.error("Error sending notification:", notifError);
            // }

            return { data: 
                {
                    install_id: ticket._id,
                    completed_at: ticket.completed_at
                } 
            };
        
        } catch (error) {
            console.log("Error in employee mark complete install ticket: ", error.message);
            throw error;
        }
    };
}