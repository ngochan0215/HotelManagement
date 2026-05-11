import { CUSTOMER_EVENTS } from "../../../shared/events/customerEvents.js";
import { EMPLOYEE_EVENTS } from "../../../shared/events/employeeEvents.js";
import { USER_EVENTS } from "../../../shared/events/userEvents.js";
import { BOOKING_EVENTS } from "../../../shared/events/bookingEvents.js";
import { INCIDENT_EVENTS } from "../../../shared/events/incidentEvents.js";

export async function findCustomerById(eventBus, customerId) {
    const replyCustomer = await eventBus.request(
        CUSTOMER_EVENTS.CHECK_EXISTS,
        { customerId }
    );

    if (!replyCustomer.success)
        throw new Error(replyCustomer.message);

    return replyCustomer.customer;
}

export async function findEmployeeByUserId(eventBus, employeeUserId) {
    const replyEmployee = await eventBus.request(
        EMPLOYEE_EVENTS.CHECK_EXISTS_USERID,
        { employee_user_id: employeeUserId }
    );

    if (!replyEmployee.found) throw new Error("Không tìm thấy nhân viên thực hiện.");

    return replyEmployee.employee;
}

export async function findEmployeeById(eventBus, employeeId) {
    const replyEmployee = await eventBus.request(
        EMPLOYEE_EVENTS.CHECK_EXISTS,
        { employee_id: employeeId }
    );

    if (!replyEmployee.found) throw new Error("Không tìm thấy nhân viên thực hiện.");

    return replyEmployee.employee;
}

export async function findAdminsByIds(eventBus) {
    const replyAdmin = await eventBus.request(
        USER_EVENTS.GET_ADMINS,
        { system_role: "manager" }
    );

    let adminUsers;
    let adminUserIds;
    if (replyAdmin.success) {
        adminUsers = replyAdmin.admins;
        adminUserIds = adminUsers.map(u => u._id);
    }

    return { adminUsers, adminUserIds };
}

export async function findPendingCompensationTickets(eventBus, bookingId) {
    const replyTickets = await eventBus.request(
        INCIDENT_EVENTS.FIND_PENDING_COMPENSATION,
        { bookingId }
    );

    if (!replyTickets.success)
        throw new Error(replyTickets.message || "Không tìm thấy phiếu đền bù nào thuộc booking đang chờ xử lý.");

    return replyTickets.tickets;
}

export async function findBookingById(eventBus, bookingId) {
    const reply = await eventBus.request(
        BOOKING_EVENTS.CHECK_EXISTS_ID,
        { bookingId }
    );

    if (!reply.success)
        throw new Error(reply.message || "Không tìm thấy đơn đặt phòng.");

    return reply.booking;
}

export async function populateBookingPeople(eventBus, bookings) {
    const isArray = Array.isArray(bookings);
    const list = isArray ? bookings : [bookings];

    const customerIds = [...new Set(list.map(i => i.customer_id?.toString()).filter(Boolean))];
    const employeeIds = [...new Set(list.map(i => i.handled_by?.toString()).filter(Boolean))];

    if (customerIds.length === 0 && employeeIds.length === 0)
        return isArray ? list : list[0];

    const [employeeMap, customerMap] = await Promise.all([
        (async () => {
            const map = {};
            if (employeeIds.length === 0) return map;
            const reply = await eventBus.request(
                EMPLOYEE_EVENTS.GET_INFO,
                { employee_ids: employeeIds }
            );
            for (const emp of reply.employees || []) {
                const key = emp._id?.toString();
                map[key] = {
                    full_name: emp.full_name,
                    position: emp.position,
                    phone_number: emp.phone_number,
                    user_id: emp.user_id,
                };
            }
            return map;
        })(),

        (async () => {
            const map = {};
            if (customerIds.length === 0) return map;
            const reply = await eventBus.request(
                CUSTOMER_EVENTS.GET_INFOS_IDS,
                { customerIds: customerIds }
            );
            for (const cus of reply.customers || []) {
                const key = cus._id?.toString();
                map[key] = {
                    full_name: cus.full_name,
                    CCCD: cus.CCCD,
                    phone_number: cus.phone_number,
                    user_id: cus.user_id,
                };
            }
            return map;
        })(),
    ]);

    const results = list.map(booking => ({
        ...booking,
        customer_info: customerMap[booking.customer_id?.toString()] ?? null,
        handler_employee_info: employeeMap[booking.handled_by?.toString()] ?? null,
    }));

    return isArray ? results : results[0];
}

export async function enrichReceipts(eventBus, receipts) {
    const list = Array.isArray(receipts) ? receipts : [receipts];
    const plain = list.map(r => (typeof r.toObject === "function" ? r.toObject() : { ...r }));

    const bookingIds = [...new Set(plain.map(r => r.booking_id?.toString()).filter(Boolean))];
    let bookings = [];
    if (bookingIds.length) {
        const reply = await eventBus.request(
            BOOKING_EVENTS.GET_BOOKINGS_BY_IDS,
            { bookingIds }
        );
        bookings = reply.success ? (reply.bookings || []) : [];
    }

    const enrichedBookings = bookings.length ? await populateBookingPeople(eventBus, bookings) : [];
    const bookingById = {};
    for (const b of enrichedBookings) {
        bookingById[b._id.toString()] = b;
    }

    const employeeIds = [...new Set(plain.map(r => r.employee_id?.toString()).filter(Boolean))];
    let employees = [];
    if (employeeIds.length) {
        const replyEmp = await eventBus.request(
            EMPLOYEE_EVENTS.GET_INFO,
            { employee_ids: employeeIds }
        );
        employees = replyEmp.employees || [];
    }
    const empMap = {};
    for (const e of employees) {
        empMap[e._id.toString()] = e;
    }

    const userIds = [...new Set(
        Object.values(empMap).map(e => e.user_id?.toString()).filter(Boolean)
    )];
    let users = [];
    if (userIds.length) {
        const replyUsers = await eventBus.request(
            USER_EVENTS.GET_USERS_INFO,
            { userIds }
        );
        users = replyUsers.users || [];
    }
    const userMap = {};
    for (const u of users) {
        userMap[u._id.toString()] = u;
    }

    const ticketIds = [...new Set(
        plain.map(r => r.compensate_ticket_id?.toString()).filter(Boolean)
    )];
    const ticketEntries = await Promise.all(
        ticketIds.map(async (tid) => {
            const rep = await eventBus.request(
                INCIDENT_EVENTS.GET_COMPENSATION_BY_ID,
                { ticketId: tid }
            );
            return [tid, rep.success ? rep.ticket : null];
        })
    );
    const ticketMap = Object.fromEntries(ticketEntries);

    const merged = plain.map(r => {
        const emp = empMap[r.employee_id?.toString()];
        return {
            ...r,
            booking: bookingById[r.booking_id?.toString()] ?? null,
            employee: emp
                ? {
                    ...emp,
                    user: emp.user_id ? userMap[emp.user_id.toString()] ?? null : null,
                }
                : null,
            compensate_ticket: r.compensate_ticket_id
                ? ticketMap[r.compensate_ticket_id.toString()] ?? null
                : null,
            service_usage: null,
        };
    });

    return Array.isArray(receipts) ? merged : merged[0];
}
