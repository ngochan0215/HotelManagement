import { container } from "../containers/container.js";

export class EquipmentInstallController {
    constructor() {
        this.equipmentInstallService = container.equipmentInstallService;
    }

    createInstallTicket = async (req, res) => {
        try {
            const install = await this.equipmentInstallService.createInstallTicket(req.user.userId, req.body);
            
            return res.status(201).json({ success: true, message: "Tạo phiếu lắp đặt thành công.", data: { install } });
    
        } catch (error) {
            res.status(500).json({ success: false, message: "SERVER ERROR: " + error.message });
        }
    };
    
    createUninstallTicket = async (req, res) => {
        try {
            const install = await this.equipmentInstallService.createUninstallTicket(req.user.userId, req.body);
            
            return res.status(201).json({ success: true, message: "Tạo phiếu tháo dỡ thành công.", data: { install } });
    
        } catch (error) {
            res.status(500).json({ success: false, message: "SERVER ERROR: " + error.message });
        }
    };
    
    getAllEquipmentInstalls = async (req, res) => {
      try {
        const { counts, installs } = await this.equipmentInstallService.getAllEquipmentInstalls(req.query);
    
        res.status(200).json({ success: true, counts, installs });
    
      } catch (error) {
        res.status(500).json({ success: false, message: error.message });
      }
    };
    
    // getSmartInstallSuggestions = async (req, res) => {
    //   try {
    //     const { room_id } = req.query;
    
    //     if (!room_id) {
    //       return res.status(400).json({
    //         success: false,
    //         message: "Vui lòng cung cấp room_id"
    //       });
    //     }
    
    //     // Lấy thông tin phòng
    //     const room = await Room.findById(room_id).populate("category_id", "_id category_name");
    //     if (!room) {
    //       return res.status(404).json({
    //         success: false,
    //         message: "Không tìm thấy phòng"
    //       });
    //     }
    
    //     if (!room.category_id) {
    //       return res.status(400).json({
    //         success: false,
    //         message: "Phòng này chưa có loại phòng"
    //       });
    //     }
    
    //     // Lấy danh sách thiết bị mặc định của loại phòng này
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
    
    getMyInstallTickets = async (req, res) => {
      try {
        const { count, installs } = await this.equipmentInstallService.getMyInstallTickets(req.user.userId, req.query);
    
        res.status(200).json({ 
          success: true, 
          count, installs 
        });

      } catch (error) {
        res.status(500).json({ 
          success: false, 
          message: "Lỗi server", 
          error: error.message 
        });
      }
    };
    
    getEquipmentInstallById = async (req, res) => {
      try {
        const { id } = req.params;
        const install = await EquipmentInstall.findById(id)
          .select("-created_at -updated_at -__v")
          .populate("room_id", "room_number")
          .populate("employee_id", "full_name")
          .populate("handled_by", "full_name phone_number");
    
        if (!install)
          return res.status(404).json({ success: false, message: "Không tìm thấy phiếu lắp đặt." });
    
        // Lấy chi tiết thiết bị
        const installDetails = await InstallDetail.find({ install_id: id })
          .populate({
            path: "equipment_id",
            populate: {
              path: "category_id",
              select: "name description"
            },
            select: "category_id condition status code"
          });
    
        res.status(200).json({ 
          success: true, 
          install: {
            ...install.toObject(),
            install_details: installDetails
          }
        });
    
      } catch (error) {
        res.status(500).json({ success: false, message: error.message });
      }
    };
    
    updateEquipmentInstall = async (req, res) => {
        const session = await mongoose.startSession();
        session.startTransaction();
        try {
            const { room_id, install_date, items, handled_by } = req.body;
            const { id } = req.params;
    
            const install_ticket = await EquipmentInstall.findById(id).session(session);
            if (!install_ticket) {
                await session.abortTransaction();
                return res.status(404).json({ success: false, message: "Không tìm thấy phiếu lắp đặt thiết bị." });
            }
    
            // Chỉ cho phép cập nhật khi status = pending, assigned hoặc waiting_confirm (chưa bắt đầu)
            if (install_ticket.status === "completed" || install_ticket.status === "expired") {
                await session.abortTransaction();
                return res.status(400).json({ success: false, message: "Không thể chỉnh sửa phiếu đã hoàn tất hoặc quá hạn." });
            }
    
            // Nếu đã có nhân viên bắt đầu làm (started_at), không cho phép thay đổi
            if (install_ticket.started_at) {
                await session.abortTransaction();
                return res.status(400).json({ success: false, message: "Không thể chỉnh sửa phiếu khi nhân viên đã bắt đầu công việc." });
            }
    
            // Chỉ cho phép cập nhật khi chưa đến ngày lắp đặt hoặc chưa gán nhân viên
            const today = new Date();
            today.setHours(0, 0, 0, 0);
    
            const ticketDate = new Date(install_ticket.install_date);
            ticketDate.setHours(0, 0, 0, 0);
    
            const hasArrived = ticketDate <= today;
            const hasAssignedTechnician = install_ticket.handled_by !== null && install_ticket.handled_by !== undefined;
    
            if (hasArrived && hasAssignedTechnician) {
                await session.abortTransaction();
                return res.status(400).json({
                    success: false,
                    message: "Không thể cập nhật phiếu vì đã đến ngày lắp đặt và đã gán nhân viên.",
                });
            }
    
            if (room_id) {
                const room = await Room.findById(room_id).session(session);
                if (!room) {
                    await session.abortTransaction();
                    return res.status(400).json({ success: false, message: "Không tìm thấy phòng." });
                }
                install_ticket.room_id = room_id;
            }
    
            // Chỉ kiểm tra ngày nếu đang cập nhật install_date
            if (install_date) {
                const installDate = new Date(install_date);
                installDate.setHours(0, 0, 0, 0);
    
                if (installDate < today) {
                    await session.abortTransaction();
                    return res.status(400).json({
                        success: false,
                        message: "Ngày lắp đặt không hợp lệ! Không thể nhỏ hơn ngày hiện tại."
                    });
                }
    
                // Nếu đổi ngày về quá khứ hoặc hôm nay, không cho phép nếu đã qua ngày cũ
                if (ticketDate <= today && installDate.getTime() !== ticketDate.getTime()) {
                    await session.abortTransaction();
                    return res.status(400).json({
                        success: false,
                        message: "Không thể thay đổi ngày khi đã đến hoặc qua ngày lắp đặt thiết bị"
                    });
                }
            } else if (ticketDate <= today) {
                // Nếu không đổi ngày nhưng đã đến/qua ngày, chỉ cho phép cập nhật handled_by
                if (handled_by === undefined) {
                    await session.abortTransaction();
                    return res.status(400).json({
                        success: false,
                        message: "Không thể sửa khi đã đến hoặc qua ngày lắp đặt thiết bị"
                    });
                }
            }
    
            // Xử lý cập nhật handled_by
            if (handled_by !== undefined) {
                if (handled_by === null || handled_by === "") {
                    // Cho phép xóa phân công
                    install_ticket.handled_by = null;
                } else {
                    // Validate nhân viên kỹ thuật
                    const technician = await Employee.findOne({ 
                        _id: handled_by,
                        position: "technician",
                        status: "working"
                    }).session(session);
    
                    if (!technician) {
                        await session.abortTransaction();
                        return res.status(400).json({ 
                            success: false, 
                            message: "Nhân viên kỹ thuật không hợp lệ hoặc không tồn tại." 
                        });
                    }
    
                    // Nếu thay đổi nhân viên, kiểm tra nhân viên mới có rảnh không
                    if (!install_ticket.handled_by || install_ticket.handled_by.toString() !== handled_by) {
                        const activeTicket = await EquipmentInstall.findOne({
                            handled_by: handled_by,
                            status: { $in: ["pending", "assigned", "waiting_confirm"] },
                            _id: { $ne: install_ticket._id }
                        }).session(session);
    
                        if (activeTicket) {
                            await session.abortTransaction();
                            return res.status(400).json({ 
                                success: false, 
                                message: "Nhân viên này đang có phiếu đang xử lý, không thể gán thêm." 
                            });
                        }
                    }
    
                    install_ticket.handled_by = technician._id;
                }
            }
    
            if (install_date) {
                 install_ticket.install_date = install_date;
                 
                 const installDate = new Date(install_date);
                 installDate.setHours(0, 0, 0, 0);
                 const isToday = installDate.getTime() === today.getTime();
                 
                 // Cập nhật status khi thay đổi install_date (chỉ nếu chưa bắt đầu)
                 if (installDate.getTime() >= today.getTime()) {
                     if (install_ticket.handled_by) {
                         install_ticket.status = "assigned"; // Đã gán nhân viên
                     } else if (isToday) {
                         install_ticket.status = "waiting_confirm"; // Đến ngày nhưng chưa gán
                     } else {
                         install_ticket.status = "pending"; // Chưa đến ngày và chưa gán
                     }
                 }
                 // Nếu install_date < today, giữ nguyên status (có thể là expired hoặc completed)
            }
            
            // Cập nhật status khi thay đổi handled_by (nếu chưa được xử lý ở trên)
            if (handled_by !== undefined && !install_date) {
                const installDate = new Date(install_ticket.install_date);
                installDate.setHours(0, 0, 0, 0);
                const isToday = installDate.getTime() === today.getTime();
                
                if (install_ticket.handled_by) {
                    // Đã gán nhân viên → "assigned"
                    install_ticket.status = "assigned";
                } else if (isToday) {
                    // Chưa gán nhân viên nhưng đến ngày → "waiting_confirm"
                    install_ticket.status = "waiting_confirm";
                } else {
                    // Chưa gán nhân viên và chưa đến ngày → "pending"
                    install_ticket.status = "pending";
                }
            }
    
            await install_ticket.save({ session });
    
            // Chỉ cập nhật thiết bị nếu có items trong request
            if (!items || !Array.isArray(items) || items.length === 0) {
                // Không cập nhật thiết bị, chỉ cập nhật thông tin khác
                await session.commitTransaction();
                
                // Gửi thông báo nếu thay đổi nhân viên
                try {
                    if (handled_by !== undefined && install_ticket.handled_by) {
                        const updatedTicket = await EquipmentInstall.findById(install_ticket._id)
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
            const activeInstallTickets = await EquipmentInstall.find({
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
                    const updatedTicket = await EquipmentInstall.findById(install_ticket._id)
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
    
    deleteEquipmentInstall = async (req, res) => {
      const session = await mongoose.startSession();
      session.startTransaction();
    
      try {
        const { id } = req.params;
        const force = req.query?.force === "true";
    
        if (!mongoose.Types.ObjectId.isValid(id)) {
          await session.abortTransaction();
          return res.status(400).json({
            success: false,
            message: "ID phiếu lắp đặt không hợp lệ.",
          });
        }
    
        const installTicket = await EquipmentInstall
          .findById(id)
          .populate("room_id", "room_number")
          .populate("handled_by", "user_id full_name")
          .populate("employee_id", "full_name")
          .session(session);
    
        if (!installTicket) {
          await session.abortTransaction();
          return res.status(404).json({
            success: false,
            message: "Không tìm thấy phiếu lắp đặt thiết bị.",
          });
        }
    
        if (!["pending", "assigned", "waiting_confirm"].includes(installTicket.status)) {
          await session.abortTransaction();
          return res.status(400).json({
            success: false,
            message: "Chỉ được xóa phiếu lắp đặt ở trạng thái pending, assigned hoặc waiting_confirm.",
          });
        }
    
        // Logic hủy phiếu:
        // - Nếu phiếu không phải hôm nay (dù có gán nhân viên hay không) → cho hủy
        // - Nếu phiếu hôm nay → chỉ cho hủy nếu chưa started_at (nhân viên chưa nhận việc)
        const today = new Date();
        today.setHours(0, 0, 0, 0);
    
        const installDate = new Date(installTicket.install_date);
        installDate.setHours(0, 0, 0, 0);
    
        const isToday = installDate.getTime() === today.getTime();
        
        // Nếu là phiếu hôm nay và đã started_at (nhân viên đã nhận việc) → không cho hủy
        if (isToday && installTicket.started_at) {
          await session.abortTransaction();
          return res.status(400).json({
            success: false,
            message: "Không thể hủy phiếu vì nhân viên đã bắt đầu thực hiện.",
          });
        }
    
        // Lấy chi tiết lắp đặt
        const details = await InstallDetail
          .find({ install_id: id })
          .session(session);
    
        // if (details.length > 0 && !force) {
        //   await session.abortTransaction();
        //   return res.status(400).json({
        //     success: false,
        //     message: `Phiếu có ${details.length} thiết bị. Dùng ?force=true để xóa.`,
        //   });
        // }
    
        const equipmentIds = details.map(d => d.equipment_id);
    
        // Xóa chi tiết
        await InstallDetail.deleteMany(
          { install_id: id },
          { session }
        );
    
        // Xử lý thiết bị khi hủy phiếu - logic khác nhau cho install và uninstall
        if (equipmentIds.length > 0) {
          const now = new Date();
          
          // Lấy thông tin thiết bị để đếm theo category
          const equipments = await Equipment.find({ _id: { $in: equipmentIds } }).session(session);
          
          // Đóng log cũ
          await EquipmentLog.updateMany(
            {
              equipment_id: { $in: equipmentIds },
              end_time: null,
            },
            { $set: { end_time: now } },
            { session }
          );
          
          if (installTicket.type === 'uninstall') {
            // Hủy phiếu tháo dỡ: Trả thiết bị về phòng gốc (room_id từ ticket)
            await Equipment.updateMany(
              { _id: { $in: equipmentIds } },
              { 
                status: "in-use",
                condition: "good",
                room_id: installTicket.room_id // Trả về phòng gốc
              },
              { session }
            );
            
            // Tạo log mới
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
            
            await EquipmentLog.insertMany(logs, { session });
          } else {
            // Hủy phiếu lắp đặt: Trả thiết bị về kho
            await Equipment.updateMany(
              { _id: { $in: equipmentIds } },
              { 
                status: "in-stock",
                condition: "new",
                room_id: null // Xóa room_id khi hủy phiếu
              },
              { session }
            );
            
            // Lưu ý: Không cộng lại storage_quantity vì chưa trừ kho (chỉ trừ khi xác nhận lắp đặt thành công)
            
            // Tạo log mới
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
            
            await EquipmentLog.insertMany(logs, { session });
          }
        }
    
        // Xóa phiếu
        await EquipmentInstall.deleteOne(
          { _id: id },
          { session }
        );
    
        // Lưu thông tin ticket trước khi xóa để gửi thông báo
        const roomText = installTicket.room_id ? ` phòng ${installTicket.room_id.room_number}` : "";
        const typeText = installTicket.type === 'uninstall' ? 'tháo dỡ' : 'lắp đặt';
        const ticketId = installTicket._id.toString().slice(-6);
        const technicianName = installTicket.handled_by?.full_name || null;
        const technicianUserId = installTicket.handled_by?.user_id || null;
    
        await session.commitTransaction();
    
        // Gửi thông báo cho admin và nhân viên (nếu đã gán) sau khi commit transaction
        try {
          // Gửi thông báo cho nhân viên được gán (nếu có)
          if (technicianUserId) {
            await pushNotificationToUsers(
              [technicianUserId],
              "Phiếu đã bị hủy",
              `Phiếu ${typeText} thiết bị${roomText} #${ticketId} đã bị hủy.`,
              "equipment",
              "EquipmentInstall",
              installTicket._id,
              "unread"
            );
          }
    
          // Gửi thông báo cho admin
          const adminUsers = await User.find({ 
            isBanned: { $ne: true },
            system_role: "manager"
          }).select("_id");
          const adminUserIds = adminUsers.map(u => u._id);
          
          if (adminUserIds.length > 0) {
            await pushNotificationToUsers(
              adminUserIds,
              "Phiếu đã bị hủy",
              `Phiếu ${typeText} thiết bị${roomText} #${ticketId} đã bị hủy${technicianName ? ` (đã gán cho ${technicianName})` : ''}.`,
              "system",
              "EquipmentInstall",
              installTicket._id,
              "unread"
            );
          }
        } catch (notifError) {
          console.error("Error sending notification:", notifError);
          // Không throw error để không ảnh hưởng đến response chính
        }
    
        return res.status(200).json({
          success: true,
          message: "Đã xóa phiếu lắp đặt thiết bị thành công.",
        });
    
      } catch (error) {
        await session.abortTransaction();
        return res.status(500).json({
          success: false,
          message: "SERVER ERROR: " + error.message,
        });
      } finally {
        session.endSession();
      }
    };
    
    confirmEquipmentImportTicket = async (req, res) => {
        const { id } = req.params;
        const adminId = req.user.userId;
        const now = new Date();
    
        const ticket = await EquipmentTicket.findById(id);
        if (!ticket)
            return res.status(404).json({ success: false, message: "Không tìm thấy phiếu nhập thiết bị." });
    
        if (ticket.status !== "waiting_confirm")
            return res.status(400).json({ success: false, message: "Phiếu chưa đến ngày nhập kho." });
    
        const imports = await EquipmentImport.find({ ticket_id: ticket._id });
    
        for (const item of imports) {
            const equipments = Array.from(
                { length: item.import_quantity },
                () => ({
                    category_id: item.category_id,
                    status: "in-stock",
                    condition: "new",
                    import_ticket_id: ticket._id
                })
            );
    
            const createdEquipments = await Equipment.insertMany(equipments);
    
            const logs = createdEquipments.map((eq) => ({
                equipment_id: eq._id,
                room_id: null,
                condition: "new",
                status: "in-stock",
                start_time: now,
                end_time: null,
                note: "Thiết bị mới nhập kho",
                handled_by: adminId
            }));
    
            await EquipmentLog.insertMany(logs);
    
            await EquipmentCategory.updateOne(
                { _id: item.category_id },
                { $inc: { storage_quantity: item.import_quantity } }
            );
        }
    
        ticket.status = "completed";
        ticket.confirmed_by = adminId;
        ticket.confirmed_at = now;
        await ticket.save();
    
        return res.json({
            success: true,
            message: "Xác nhận nhập kho thành công",
        });
    };
    
    confirmEquipmentInstall = async (req, res) => {
      const session = await mongoose.startSession();
      session.startTransaction();
    
      try {
        const { id } = req.params;
    
        if (!mongoose.Types.ObjectId.isValid(id)) {
          await session.abortTransaction();
          return res.status(400).json({
            success: false,
            message: "ID phiếu lắp đặt không hợp lệ.",
          });
        }
    
        const ticket = await EquipmentInstall.findById(id).session(session);
    
        if (!ticket) {
          await session.abortTransaction();
          return res.status(404).json({
            success: false,
            message: "Không tìm thấy phiếu lắp đặt thiết bị.",
          });
        }
    
        if (ticket.status !== "waiting_confirm") {
          await session.abortTransaction();
          return res.status(400).json({
            success: false,
            message: "Chỉ có thể xác nhận phiếu ở trạng thái chờ xác nhận.",
          });
        }
    
        // Kiểm tra nhân viên đã hoàn thành chưa
        if (!ticket.completed_at) {
          await session.abortTransaction();
          return res.status(400).json({
            success: false,
            message: "Nhân viên chưa hoàn thành công việc. Không thể xác nhận.",
          });
        }
    
        // check ngày lắp đặt
        const today = new Date();
        today.setHours(0, 0, 0, 0);
    
        const installDate = new Date(ticket.install_date);
        installDate.setHours(0, 0, 0, 0);
    
        if (installDate > today) {
          await session.abortTransaction();
          return res.status(400).json({
            success: false,
            message: "Chưa đến ngày thực hiện, không thể xác nhận.",
          });
        }
    
        const details = await InstallDetail
          .find({ install_id: id })
          .session(session);
    
        if (details.length === 0) {
          await session.abortTransaction();
          return res.status(400).json({
            success: false,
            message: "Phiếu không có thiết bị nào.",
          });
        }
    
        const equipmentIds = details.map(d => d.equipment_id);
    
        // validate thiết bị - xử lý riêng cho install và uninstall
        let expectedStatus = "installing";
        if (ticket.type === 'uninstall') {
          expectedStatus = "removing";
        }
        
        // Query tất cả thiết bị (không filter status) để kiểm tra status thực tế
        const allEquipments = await Equipment.find({
          _id: { $in: equipmentIds }
        })
        .populate("category_id", "_id name")
        .session(session);
    
        // Kiểm tra từng thiết bị có đúng status không
        const invalidEquipments = allEquipments.filter(eq => eq.status !== expectedStatus);
        if (invalidEquipments.length > 0) {
          const invalidStatuses = invalidEquipments.map(eq => `${eq._id}: ${eq.status}`).join(", ");
          await session.abortTransaction();
          return res.status(400).json({
            success: false,
            message: `Có ${invalidEquipments.length} thiết bị không có status="${expectedStatus}". Các thiết bị: ${invalidStatuses}`,
          });
        }
    
        // Kiểm tra số lượng
        if (allEquipments.length !== equipmentIds.length) {
          const foundEquipmentIds = allEquipments.map(eq => eq._id.toString());
          const missingEquipmentIds = equipmentIds.filter(id => !foundEquipmentIds.includes(id.toString()));
          
          await session.abortTransaction();
          return res.status(400).json({
            success: false,
            message: `Không tìm thấy ${missingEquipmentIds.length} thiết bị trong hệ thống. Yêu cầu: ${equipmentIds.length}, Tìm thấy: ${allEquipments.length}.`,
          });
        }
    
        const equipments = allEquipments;
    
        // Kiểm tra tất cả thiết bị đều có category_id
        const equipmentsWithoutCategory = equipments.filter(eq => !eq.category_id);
        if (equipmentsWithoutCategory.length > 0) {
          await session.abortTransaction();
          return res.status(400).json({
            success: false,
            message: `Có ${equipmentsWithoutCategory.length} thiết bị không có danh mục (category_id). Vui lòng kiểm tra lại.`,
          });
        }
    
        // đóng log cũ
        await EquipmentLog.updateMany(
            {
                equipment_id: { $in: equipmentIds },
                end_time: null,
            },
            {
                $set: { end_time: new Date() },
            },
            { session }
        );
    
        let newStatus = "in-use";
        let newRoomId = ticket.room_id;
        let logNote = "Hoàn tất lắp đặt vào phòng";
    
        if (ticket.type === 'uninstall') {
            newStatus = "in-stock";
            newRoomId = null;
            logNote = `Đã thu hồi về kho`;
        }
    
        else if (!ticket.room_id) {
            newStatus = "in-stock";
            newRoomId = null;
            logNote = "Đã thu hồi về kho";
        }
    
        await Equipment.updateMany(
              { _id: { $in: equipmentIds } },
              {
                status: newStatus,
                condition: "good",
                room_id: newRoomId,
                install_ticket_id: ticket._id
              },
              { session }
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
    
        await EquipmentLog.insertMany(logs, { session });
    
        // Cập nhật storage_quantity của EquipmentCategory
        // Đếm số lượng thiết bị theo từng category_id
        const categoryCountMap = new Map();
        
        equipments.forEach(eq => {
          // Lấy category_id - có thể là ObjectId hoặc object đã populate
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
              { $inc: { storage_quantity: -count } }, // Trừ đi số lượng đã lắp đặt
              { session }
            );
          }
        }
        // Cộng lại storage_quantity khi tháo dỡ về kho
        else if (ticket.type === 'uninstall' && newStatus === 'in-stock') {
          // Cập nhật storage_quantity cho từng category (cộng lại số lượng đã tháo dỡ)
          for (const [categoryId, count] of categoryCountMap.entries()) {
            await EquipmentCategory.updateOne(
              { _id: categoryId },
              { $inc: { storage_quantity: count } }, // Cộng lại số lượng đã tháo dỡ
              { session }
            );
          }
        }
    
        ticket.status = "completed";
        await ticket.save({ session });
    
        await session.commitTransaction();
    
        // Gửi thông báo cho nhân viên được gán và admin sau khi commit transaction
        try {
          // Populate để lấy thông tin phòng và nhân viên
          const populatedTicket = await EquipmentInstall.findById(ticket._id)
            .populate("room_id", "room_number")
            .populate("handled_by", "user_id full_name")
            .populate("employee_id", "full_name");
    
          const roomText = populatedTicket.room_id ? ` phòng ${populatedTicket.room_id.room_number}` : "";
          const typeText = ticket.type === 'uninstall' ? 'tháo dỡ' : 'lắp đặt';
    
          // Gửi thông báo cho nhân viên được gán
          if (populatedTicket.handled_by && populatedTicket.handled_by.user_id) {
            await pushNotificationToUsers(
              [populatedTicket.handled_by.user_id],
              "Công việc đã được xác nhận",
              `Phiếu ${typeText} thiết bị${roomText} #${ticket._id.toString().slice(-6)} đã được admin xác nhận hoàn thành.`,
              "equipment",
              "EquipmentInstall",
              ticket._id,
              "unread"
            );
          }
    
          // Gửi thông báo cho admin (thông báo xác nhận thành công)
          const adminUsers = await User.find({ 
            isBanned: { $ne: true },
            system_role: "manager"
          }).select("_id");
          const adminUserIds = adminUsers.map(u => u._id);
          
          if (adminUserIds.length > 0) {
            const technicianName = populatedTicket.handled_by?.full_name || "Nhân viên";
            await pushNotificationToUsers(
              adminUserIds,
              "Đã xác nhận công việc",
              `Đã xác nhận hoàn thành phiếu ${typeText} thiết bị${roomText} #${ticket._id.toString().slice(-6)} của ${technicianName}.`,
              "equipment",
              "EquipmentInstall",
              ticket._id,
              "unread"
            );
          }
        } catch (notifError) {
          console.error("Error sending notification:", notifError);
          // Không throw error để không ảnh hưởng đến response chính
        }
    
        return res.status(200).json({
          success: true,
          message: "Xác nhận lắp đặt thiết bị thành công.",
          data: {
            install_id: ticket._id,
            equipment_count: equipmentIds.length,
          },
        });
    
      } catch (error) {
        await session.abortTransaction();
        return res.status(500).json({
          success: false,
          message: "SERVER ERROR: " + error.message,
        });
      } finally {
        session.endSession();
      }
    };
    
    // Lấy danh sách thiết bị hết tồn kho để preview
    getOutOfStockCategories = async (req, res) => {
        try {
            // Tìm tất cả thiết bị có storage_quantity <= 10
            const outOfStockCategories = await EquipmentCategory.find({
                storage_quantity: { $lte: 10 }
            }).select("_id name description unit price storage_quantity");
    
            return res.status(200).json({
                success: true,
                categories: outOfStockCategories,
                count: outOfStockCategories.length
            });
        } catch (err) {
            return res.status(500).json({ success: false, message: "ERROR: " + err.message });
        }
    };
    
    // Tự động tạo phiếu nhập cho thiết bị có số lượng tồn = 0
    autoCreateImportTicket = async (req, res) => {
        const session = await mongoose.startSession();
        session.startTransaction();
    
        try {
            const employee_id = req.user.userId;
            const { import_date, default_quantity = 10, default_price_percent = 0.8 } = req.body;
    
            if (!employee_id) {
                await session.abortTransaction();
                session.endSession();
                return res.status(400).json({ success: false, message: "Yêu cầu nhập thông tin đầy đủ." });
            }
    
            const employee = await Employee.findOne({ user_id: employee_id }).session(session);
            if (!employee) {
                await session.abortTransaction();
                session.endSession();
                return res.status(400).json({ success: false, message: "Không tìm thấy nhân viên." });
            }
    
            // Nếu có items từ frontend, sử dụng items đó (đã được chỉnh sửa)
            // Nếu không, tự động tìm thiết bị hết tồn kho
            let items = req.body.items;
            let outOfStockCategories = [];
    
            if (items && Array.isArray(items) && items.length > 0) {
                // Validate items từ frontend
                await validateImportItems(items);
                // Lấy thông tin category để tính tổng tiền
                const categoryIds = items.map(item => item.category_id);
                outOfStockCategories = await EquipmentCategory.find({
                    _id: { $in: categoryIds }
                }).session(session);
            } else {
                // Tự động tìm thiết bị hết tồn kho
                outOfStockCategories = await EquipmentCategory.find({
                    storage_quantity: 0
                }).session(session);
    
                if (outOfStockCategories.length === 0) {
                    await session.abortTransaction();
                    session.endSession();
                    return res.status(200).json({
                        success: true,
                        message: "Không có thiết bị nào hết tồn kho.",
                        ticket_id: null,
                        items_count: 0
                    });
                }
    
                // Tạo items mặc định
                items = outOfStockCategories.map(category => ({
                    category_id: category._id,
                    import_quantity: default_quantity,
                    import_price: Math.round(category.price * default_price_percent)
                }));
            }
    
            if (!items || items.length === 0) {
                await session.abortTransaction();
                session.endSession();
                return res.status(400).json({
                    success: false,
                    message: "Không có thiết bị nào để tạo phiếu nhập."
                });
            }
    
            // Kiểm tra ngày nhập
            const today = new Date();
            today.setHours(0, 0, 0, 0);
            let importDate;
            
            if (import_date) {
                importDate = new Date(import_date);
                importDate.setHours(0, 0, 0, 0);
                if (importDate < today) {
                    await session.abortTransaction();
                    session.endSession();
                    return res.status(400).json({
                        success: false,
                        message: "Ngày nhập không hợp lệ! Không thể nhỏ hơn ngày hiện tại."
                    });
                }
            } else {
                // Mặc định là hôm nay
                importDate = new Date(today);
                //importDate.setDate(importDate.getDate() + 1);
            }
    
            // Kiểm tra xem đã có phiếu nhập cho ngày này chưa
            const existing = await EquipmentTicket.findOne({ import_date: importDate }).session(session);
            if (existing) {
                await session.abortTransaction();
                session.endSession();
                return res.status(400).json({
                    success: false,
                    message: `Đã có phiếu nhập cho ngày ${importDate.toISOString().split('T')[0]}. Vui lòng cập nhật phiếu đó hoặc chọn ngày khác.`
                });
            }
    
            const status = importDate.getTime() === today.getTime() ? "waiting_confirm" : "pending";
    
            // Tính tổng tiền
            const total_fee = items.reduce((sum, item) => sum + (item.import_price * item.import_quantity), 0);
    
            // Tạo phiếu nhập thiết bị
            const employeeId = employee._id;
            const ticket = await EquipmentTicket.create(
                [{ employee_id: employeeId, import_date: importDate, status, total_fee }],
                { session }
            );
    
            const ticketId = ticket[0]._id;
    
            // Tạo từng chi tiết phiếu nhập
            const importDetails = items.map((item) => ({
                ticket_id: ticketId,
                category_id: item.category_id,
                import_price: item.import_price,
                import_quantity: item.import_quantity,
            }));
    
            await EquipmentImport.insertMany(importDetails, { session });
    
            await session.commitTransaction();
            session.endSession();
    
            return res.status(201).json({
                success: true,
                message: `Tự động tạo phiếu nhập thành công cho ${items.length} loại thiết bị hết tồn kho!`,
                ticket_id: ticketId,
                items_count: items.length,
                import_date: importDate
            });
    
        } catch (err) {
            await session.abortTransaction();
            session.endSession();
            return res.status(500).json({ success: false, message: "ERROR: " + err.message });
        }
    };
    
    // Nhân viên bắt đầu công việc
    startInstallTicket = async (req, res) => {
      try {
        const { id } = req.params;
        const userId = req.user.userId;
    
        if (!mongoose.Types.ObjectId.isValid(id)) {
          return res.status(400).json({
            success: false,
            message: "ID phiếu lắp đặt không hợp lệ.",
          });
        }
    
        const employee = await Employee.findOne({ user_id: userId });
        if (!employee) {
          return res.status(404).json({
            success: false,
            message: "Không tìm thấy nhân viên.",
          });
        }
    
        const ticket = await EquipmentInstall.findById(id);
    
        if (!ticket) {
          return res.status(404).json({
            success: false,
            message: "Không tìm thấy phiếu lắp đặt thiết bị.",
          });
        }
    
        // Kiểm tra nhân viên có được gán phiếu này không
        if (!ticket.handled_by || ticket.handled_by.toString() !== employee._id.toString()) {
          return res.status(403).json({
            success: false,
            message: "Bạn không được gán phiếu này.",
          });
        }
    
        // Kiểm tra trạng thái
        if (ticket.status !== "assigned" && ticket.status !== "waiting_confirm") {
          return res.status(400).json({
            success: false,
            message: "Chỉ có thể bắt đầu phiếu ở trạng thái assigned hoặc waiting_confirm.",
          });
        }
    
        // Kiểm tra đã bắt đầu chưa
        if (ticket.started_at) {
          return res.status(400).json({
            success: false,
            message: "Phiếu này đã được bắt đầu rồi.",
          });
        }
    
        ticket.status = "waiting_confirm";
        ticket.started_at = new Date();
        await ticket.save();
    
        // Gửi thông báo cho admin và nhân viên được gán
        try {
          // Populate để lấy thông tin phòng và nhân viên
          const populatedTicket = await EquipmentInstall.findById(ticket._id)
            .populate("room_id", "room_number")
            .populate("handled_by", "user_id full_name")
            .populate("employee_id", "full_name");
    
          const roomText = populatedTicket.room_id ? ` phòng ${populatedTicket.room_id.room_number}` : "";
          const typeText = ticket.type === 'uninstall' ? 'tháo dỡ' : 'lắp đặt';
    
          // Gửi thông báo cho nhân viên được gán
          if (populatedTicket.handled_by && populatedTicket.handled_by.user_id) {
            await pushNotificationToUsers(
              [populatedTicket.handled_by.user_id],
              "Đã bắt đầu công việc",
              `Bạn đã bắt đầu phiếu ${typeText} thiết bị${roomText} #${ticket._id.toString().slice(-6)}`,
              "equipment",
              "EquipmentInstall",
              ticket._id,
              "unread"
            );
          }
    
          // Gửi thông báo cho admin
          const adminUsers = await User.find({ 
            isBanned: { $ne: true },
            system_role: "manager"
          }).select("_id");
          const adminUserIds = adminUsers.map(u => u._id);
          
          if (adminUserIds.length > 0) {
            const technicianName = populatedTicket.handled_by?.full_name || "Nhân viên";
            await pushNotificationToUsers(
              adminUserIds,
              "Nhân viên bắt đầu công việc",
              `${technicianName} đã bắt đầu phiếu ${typeText} thiết bị${roomText} #${ticket._id.toString().slice(-6)}`,
              "equipment",
              "EquipmentInstall",
              ticket._id,
              "unread"
            );
          }
        } catch (notifError) {
          console.error("Error sending notification:", notifError);
          // Không throw error để không ảnh hưởng đến response chính
        }
    
        res.status(200).json({
          success: true,
          message: "Đã bắt đầu công việc.",
          data: {
            install_id: ticket._id,
            started_at: ticket.started_at
          }
        });
      } catch (error) {
        res.status(500).json({
          success: false,
          message: "SERVER ERROR: " + error.message,
        });
      }
    };
    
    // Nhân viên hoàn thành công việc
    completeInstallTicket = async (req, res) => {
      try {
        const { id } = req.params;
        const userId = req.user.userId;
    
        if (!mongoose.Types.ObjectId.isValid(id)) {
          return res.status(400).json({
            success: false,
            message: "ID phiếu lắp đặt không hợp lệ.",
          });
        }
    
        const employee = await Employee.findOne({ user_id: userId });
        if (!employee) {
          return res.status(404).json({
            success: false,
            message: "Không tìm thấy nhân viên.",
          });
        }
    
        const ticket = await EquipmentInstall.findById(id)
          .populate("room_id", "room_number")
          .populate("employee_id", "full_name");
    
        if (!ticket) {
          return res.status(404).json({
            success: false,
            message: "Không tìm thấy phiếu lắp đặt thiết bị.",
          });
        }
    
        // Kiểm tra nhân viên có được gán phiếu này không
        if (!ticket.handled_by || ticket.handled_by.toString() !== employee._id.toString()) {
          return res.status(403).json({
            success: false,
            message: "Bạn không được gán phiếu này.",
          });
        }
    
        // Kiểm tra đã bắt đầu chưa
        if (!ticket.started_at) {
          return res.status(400).json({
            success: false,
            message: "Bạn cần bắt đầu công việc trước khi hoàn thành.",
          });
        }
    
        // Kiểm tra đã hoàn thành chưa
        if (ticket.completed_at) {
          return res.status(400).json({
            success: false,
            message: "Phiếu này đã được hoàn thành rồi.",
          });
        }
    
        //ticket.status = "completed";
        ticket.completed_at = new Date();
        await ticket.save();
    
        // Gửi thông báo cho nhân viên được gán và admin
        try {
          const roomText = ticket.room_id ? ` phòng ${ticket.room_id.room_number}` : "";
          const typeText = ticket.type === 'uninstall' ? 'tháo dỡ' : 'lắp đặt';
    
          // Gửi thông báo cho nhân viên được gán
          if (ticket.handled_by) {
            const technician = await Employee.findById(ticket.handled_by).populate("user_id", "_id");
            if (technician && technician.user_id) {
              await pushNotificationToUsers(
                [technician.user_id._id],
                "Công việc đã hoàn thành",
                `Bạn đã hoàn thành phiếu ${typeText} thiết bị${roomText} #${ticket._id.toString().slice(-6)}. Đang chờ admin xác nhận.`,
                "equipment",
                "EquipmentInstall",
                ticket._id,
                "unread"
              );
            }
          }
    
          // Gửi thông báo cho admin
          const adminUsers = await User.find({ 
            isBanned: { $ne: true },
            system_role: "manager"
          }).select("_id");
          const adminUserIds = adminUsers.map(u => u._id);
          
          if (adminUserIds.length > 0) {
            await pushNotificationToUsers(
              adminUserIds,
              "Công việc hoàn thành",
              `Nhân viên ${employee.full_name} đã hoàn thành phiếu ${typeText} thiết bị${roomText} #${ticket._id.toString().slice(-6)}. Vui lòng xác nhận.`,
              "equipment",
              "EquipmentInstall",
              ticket._id,
              "unread"
            );
          }
        } catch (notifError) {
          console.error("Error sending notification:", notifError);
        }
    
        res.status(200).json({
          success: true,
          message: "Đã hoàn thành công việc. Đang chờ admin xác nhận.",
          data: {
            install_id: ticket._id,
            completed_at: ticket.completed_at
          }
        });
      } catch (error) {
        res.status(500).json({
          success: false,
          message: "SERVER ERROR: " + error.message,
        });
      }
    };
}