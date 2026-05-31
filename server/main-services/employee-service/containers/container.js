import Employee from "../models/Employee.js";
import Shift from "../models/Shifts.js";
import Schedule from "../models/Schedule.js";
import Attendance from "../models/Attendance.js";
import ScheduleContract from "../models/ScheduleContract.js";
import EmployeeEarning from "../models/EmployeeEarning.js";
import EmployeePayout from "../models/EmployeePayout.js";

import { EmployeeService } from "../services/employeeService.js";
import { ScheduleService } from "../services/scheduleService.js";
import { EmployeeEventHandler } from "../events/employeeHandler.js";

import { EventBus } from "../../../shared/messaging/eventBus.js";
import { EventConsumer } from "../../../shared/messaging/eventConsumer.js";
import { EMPLOYEE_EVENTS } from "../../../shared/events/employeeEvents.js";

import { sendNotification, sendNotificationsToUsers } from "../../../shared/messaging/notificationPublisher.js";

class Container {
    constructor() {
        this.eventBus = new EventBus();

        this.employeeService = new EmployeeService({
            Employee, Attendance, Shift, Schedule, ScheduleContract, EmployeeEarning, EmployeePayout,
            eventBus: this.eventBus
        });

        this.scheduleService = new ScheduleService({
            Schedule, Attendance, Shift, Employee, ScheduleContract,
            eventBus: this.eventBus,
            sendNotification, sendNotificationsToUsers
        });

        this.employeeEventHandler = new EmployeeEventHandler(this.employeeService, this.eventBus);
    }

    async init() {
        await this.eventBus.connect({
            queueName: "employee-service-events",
            bindEvents: [
                EMPLOYEE_EVENTS.REGISTERED,
                EMPLOYEE_EVENTS.GET_INFO,
                EMPLOYEE_EVENTS.GET_INFOS_USERIDS,
                EMPLOYEE_EVENTS.CHECK_EXISTS,
                EMPLOYEE_EVENTS.CHECK_EXISTS_USERID,
                
                EMPLOYEE_EVENTS.CHECK_TECHINICIAN_AVAILABLE,
                EMPLOYEE_EVENTS.GET_RECEPTIONISTS,
                EMPLOYEE_EVENTS.GET_AVAILABLE_HOUSEKEEPERS
            ]
        });

        // lấy handlers từ class
        const handlers = this.employeeEventHandler.handlers();

        const consumer = new EventConsumer(this.eventBus, handlers);
        await consumer.start();
    }
}

export const container = new Container();