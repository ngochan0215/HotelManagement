import { BOOKING_EVENTS } from "../../../shared/events/bookingEvents.js";
import { CUSTOMER_EVENTS } from "../../../shared/events/customerEvents.js";
import { EMPLOYEE_EVENTS } from "../../../shared/events/employeeEvents.js";
import { ROOM_EVENTS } from "../../../shared/events/roomEvents.js";

export async function findCustomerById(eventBus, customerId) {
    const reply = await eventBus.safeRequest(CUSTOMER_EVENTS.CHECK_EXISTS, { customerId });
    if (!reply.success) throw new Error(reply.message || "Không tìm thấy khách hàng.");
    return reply.customer;
}

export async function findEmployeeByUserId(eventBus, employeeUserId) {
    const reply = await eventBus.safeRequest(EMPLOYEE_EVENTS.CHECK_EXISTS_USERID, {
        employee_user_id: employeeUserId,
    });
    if (!reply.found) throw new Error("Không tìm thấy nhân viên.");
    return reply.employee;
}

export async function findBookingById(eventBus, bookingId) {
    const reply = await eventBus.safeRequest(BOOKING_EVENTS.CHECK_EXISTS_ID, { bookingId });
    if (!reply.success) throw new Error(reply.message || "Không tìm thấy booking.");
    return reply.booking;
}

export async function findBookingDetailsByBookingIds(eventBus, bookingIds) {
    if (!bookingIds?.length) return [];
    const results = await Promise.all(
        bookingIds.map((id) => findBookingDetailsByBookingId(eventBus, id))
    );
    return results.flat();
}

export async function findBookingDetailsByBookingId(eventBus, bookingId) {
    const reply = await eventBus.safeRequest(BOOKING_EVENTS.GET_DETAILS_BOOKING_ID, { bookingId });
    if (!reply.success) return [];
    return reply.details || [];
}

export async function enrichServiceUsages(eventBus, serviceUsages) {
    const list = serviceUsages.map((su) => ({ ...su }));
    const bookingIds = [...new Set(list.map((su) => {
        const id = su.booking_id?._id || su.booking_id;
        return id?.toString?.() || id;
    }).filter(Boolean))];

    const customerIds = [...new Set(list.map((su) => {
        const id = su.customer_id?._id || su.customer_id;
        return id?.toString?.() || id;
    }).filter(Boolean))];

    const employeeUserIds = [...new Set(list.map((su) => {
        const id = su.employee_id?._id || su.employee_id;
        return id?.toString?.() || id;
    }).filter(Boolean))];

    const [bookingMap, customerMap, employeeMap, allDetails] = await Promise.all([
        (async () => {
            const map = {};
            await Promise.all(bookingIds.map(async (id) => {
                try {
                    const b = await findBookingById(eventBus, id);
                    map[id] = { _id: b._id, status: b.status };
                } catch { /* skip */ }
            }));
            return map;
        })(),
        (async () => {
            const map = {};
            if (!customerIds.length) return map;
            const reply = await eventBus.safeRequest(CUSTOMER_EVENTS.GET_INFOS_IDS, { customerIds });
            for (const c of reply.customers || []) {
                map[c._id.toString()] = { _id: c._id, full_name: c.full_name, phone: c.phone_number || c.phone };
            }
            return map;
        })(),
        (async () => {
            const map = {};
            await Promise.all(employeeUserIds.map(async (uid) => {
                try {
                    const e = await findEmployeeByUserId(eventBus, uid);
                    map[uid] = { _id: e._id, full_name: e.full_name };
                } catch {
                    map[uid] = { full_name: "N/A" };
                }
            }));
            return map;
        })(),
        findBookingDetailsByBookingIds(eventBus, bookingIds),
    ]);

    const bookingRoomsMap = {};
    for (const bd of allDetails) {
        const bookingId = bd.booking_id?.toString?.() || bd.booking_id?.toString() || String(bd.booking_id);
        if (!bookingRoomsMap[bookingId]) bookingRoomsMap[bookingId] = [];
        const roomNum = bd.room_id?.room_number ?? bd.room_number;
        if (roomNum) bookingRoomsMap[bookingId].push(roomNum);
    }

    return list.map((su) => {
        const bookingId = (su.booking_id?._id || su.booking_id)?.toString?.() || String(su.booking_id || "");
        const customerId = (su.customer_id?._id || su.customer_id)?.toString?.() || String(su.customer_id || "");
        const employeeId = (su.employee_id?._id || su.employee_id)?.toString?.() || String(su.employee_id || "");
        const rooms = bookingRoomsMap[bookingId] || [];
        return {
            ...su,
            booking_id: {
                ...(bookingMap[bookingId] || { _id: bookingId }),
                rooms,
                booking_code: bookingId ? bookingId.slice(-6).toUpperCase() : null,
            },
            customer_id: customerMap[customerId] || su.customer_id,
            employee_id: employeeMap[employeeId] || su.employee_id,
        };
    });
}

export async function findEmployeesByIds(eventBus, employeeIds) {
    if (!employeeIds?.length) return {};
    const reply = await eventBus.safeRequest(EMPLOYEE_EVENTS.GET_INFO, { employee_ids: employeeIds });
    const map = {};
    for (const emp of reply.employees || []) {
        map[emp._id.toString()] = { _id: emp._id, full_name: emp.full_name };
    }
    return map;
}

export async function enrichSingleServiceUsage(eventBus, serviceUsage) {
    const bookingId = serviceUsage.booking_id?.toString?.() || serviceUsage.booking_id;
    const customerId = serviceUsage.customer_id?.toString?.() || serviceUsage.customer_id;
    const employeeUserId = serviceUsage.employee_id?.toString?.() || serviceUsage.employee_id;

    const [booking, customer, employee, details] = await Promise.all([
        findBookingById(eventBus, bookingId).catch(() => null),
        findCustomerById(eventBus, customerId).catch(() => null),
        findEmployeeByUserId(eventBus, employeeUserId).catch(() => null),
        findBookingDetailsByBookingId(eventBus, bookingId),
    ]);

    const roomIds = [...new Set(details.map((bd) => (bd.room_id?._id || bd.room_id)?.toString?.()).filter(Boolean))];

    let roomMap = {};
    if (roomIds.length > 0) {
        const roomReply = await eventBus.safeRequest(ROOM_EVENTS.GET_ROOMS_INFO, { room_ids: roomIds }).catch(() => ({ success: false }));
        for (const room of roomReply.rooms || []) {
            roomMap[room._id.toString()] = room;
        }
    }

    const rooms = details.map((bd) => {
        const roomId = (bd.room_id?._id || bd.room_id)?.toString?.();
        const roomInfo = roomMap[roomId];
        return {
            room_id: roomId,
            room_number: roomInfo?.room_number ?? "N/A",
            status: bd.status,
        };
    });

    return {
        service_usage: {
            ...serviceUsage.toObject?.() ?? serviceUsage,
            booking_id: booking
                ? { _id: booking._id, status: booking.status, expected_checkin: booking.expected_checkin, expected_checkout: booking.expected_checkout }
                : serviceUsage.booking_id,
            customer_id: customer
                ? { _id: customer._id, full_name: customer.full_name, phone: customer.phone_number || customer.phone }
                : serviceUsage.customer_id,
            employee_id: employee ? { _id: employee._id, full_name: employee.full_name } : serviceUsage.employee_id,
        },
        rooms,
    };
}
