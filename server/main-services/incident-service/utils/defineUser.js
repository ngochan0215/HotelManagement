import { EventBus } from "../../../shared/messaging/eventBus.js";
import { EMPLOYEE_EVENTS } from "../../../shared/events/employeeEvents.js";
import { CUSTOMER_EVENTS } from "../../../shared/events/customerEvents.js";

export const resolveUserFullName = async (user_id) => {
    if (!user_id) 
        return null;

    const replyUser = await this.eventBus.safeRequest(
        USER_EVENTS.GET_USER_INFO,
        { userId: user_id }
    );
    if (!replyUser.found) 
        throw new Error("Không tìm thấy người dùng.");
    const user = replyUser.user;

    if (user.system_role === "employee") {
        const replyEmployee = await this.eventBus.safeRequest(
            EMPLOYEE_EVENTS.CHECK_EXISTS_USERID,
            { employee_user_id: user_id }
        );
        if (!replyEmployee.found)
            throw new Error("Nhân viên không tồn tại.");

        return replyEmployee.employee;
    }

    if (user.system_role === "customer") {
        const replyCustomer = await this.eventBus.safeRequest(
            CUSTOMER_EVENTS.CHECK_EXISTS,
            { customerId: user_id }
        );
        if (!replyCustomer.found)
            throw new Error("Khách hàng không tồn tại.");

        return replyCustomer.customer;
    }

    return null;
};