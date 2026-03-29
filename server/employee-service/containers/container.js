import Employee from "../models/Employee.js";
import { EmployeeService } from "../services/employeeService.js";
import { userClient } from "../clients/userClient.js";
import { EmployeeEventHandler } from "../events/employeeHandler.js";

import { EventBus } from "../../shared/messaging/eventBus.js";
import { EventConsumer } from "../../shared/messaging/eventConsumer.js";
import { EMPLOYEE_EVENTS } from "../../shared/events/employeeEvents.js";

class Container {
    constructor() {
        this.eventBus = new EventBus();

        this.employeeService = new EmployeeService({
            userClient,
            Employee,
            eventBus: this.eventBus
        });

        this.employeeEventHandler = new EmployeeEventHandler(this.employeeService, this.eventBus);
    }

    async init() {
        await this.eventBus.connect({
            queueName: "employee-service-events",
            bindEvents: [
                EMPLOYEE_EVENTS.REGISTERED,
                EMPLOYEE_EVENTS.GET_INFO,
                EMPLOYEE_EVENTS.GET_INFO_USERID,
                EMPLOYEE_EVENTS.CHECK_EXISTS,
                EMPLOYEE_EVENTS.CHECK_EXISTS_USERID,
                EMPLOYEE_EVENTS.CHECK_TECHINICIAN_AVAILABLE
            ]
        });

        // lấy handlers từ class
        const handlers = this.employeeEventHandler.handlers();

        const consumer = new EventConsumer(this.eventBus, handlers);
        await consumer.start();
    }
}

export const container = new Container();