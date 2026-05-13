import { EMPLOYEE_EVENTS } from "../../../shared/events/employeeEvents.js";

export class EmployeeEventHandler {
    constructor(employeeService, eventBus) {
        this.employeeService = employeeService;
        this.eventBus = eventBus;
    }

    handlers() {
        return {
            [EMPLOYEE_EVENTS.REGISTERED]: this.employeeRegistered.bind(this),
            [EMPLOYEE_EVENTS.CHECK_EXISTS]: this.employeeCheckExists.bind(this),
            [EMPLOYEE_EVENTS.CHECK_EXISTS_USERID]: this.employeeCheckExistsByUserId.bind(this),
            [EMPLOYEE_EVENTS.GET_INFO]: this.employeeGetInfo.bind(this),
            [EMPLOYEE_EVENTS.GET_INFOS_USERIDS]: this.employeeGetInfosByUserIds.bind(this),
            [EMPLOYEE_EVENTS.CHECK_TECHINICIAN_AVAILABLE]: this.checkTechnicianAvailable.bind(this),
            [EMPLOYEE_EVENTS.GET_RECEPTIONISTS]: this.getAllReceptionists.bind(this),
            [EMPLOYEE_EVENTS.GET_AVAILABLE_HOUSEKEEPERS]: this.getAvailableHousekeepers.bind(this)
        }
    }

    async employeeRegistered(data, msg) {
        console.log("Handling EMPLOYEE_REGISTERED");
        try {
            const { userId, employee } = data;
            const result = await this.employeeService.createEmployee(userId, employee);

            this.eventBus.channel.sendToQueue(
                msg.properties.replyTo,
                Buffer.from(JSON.stringify({ success: true, employee: result })),
                {
                    correlationId: msg.properties.correlationId,
                    persistent: false
                }
            );
        } catch (error) {
            this.eventBus.channel.sendToQueue(
                msg.properties.replyTo,
                Buffer.from(JSON.stringify({ success: false, message: error.message })),
                { 
                    correlationId: msg.properties.correlationId, 
                    persistent: false 
                }
            );
        }
    }

    // check exists / get employee information by employee_id
    async employeeCheckExists(data, msg) {
        try {
            console.log("Handling EMPLOYEE_CHECK_EXISTS");
            const { employee_id } = data;
            const employee = await this.employeeService.getEmployeeById(employee_id);

            this.eventBus.channel.sendToQueue(
                msg.properties.replyTo,
                Buffer.from(JSON.stringify({ success: true, found: !!employee, employee })),
                {
                    correlationId: msg.properties.correlationId,
                    persistent: false
                }
            )
        } catch (error) {
            this.eventBus.channel.sendToQueue(
                msg.properties.replyTo,
                Buffer.from(JSON.stringify({ success: false, message: error.message })),
                {
                    correlationId: msg.properties.correlationId,
                    persistent: false
                }
            )
        }
    }

    // check exists / get employee information by user_id
    async employeeCheckExistsByUserId(data, msg) {
        try {
            console.log("Handling EMPLOYEE_CHECK_EXISTS_USERID");
            const { employee_user_id } = data;
            const employee = await this.employeeService.getEmployeeByUserId(employee_user_id);

            this.eventBus.channel.sendToQueue(
                msg.properties.replyTo,
                Buffer.from(JSON.stringify({ success: true, found: !!employee, employee })),
                {
                    correlationId: msg.properties.correlationId,
                    persistent: false
                }
            )
        } catch (error) {
            this.eventBus.channel.sendToQueue(
                msg.properties.replyTo,
                Buffer.from(JSON.stringify({ success: false, message: error.message })),
                {
                    correlationId: msg.properties.correlationId,
                    persistent: false
                }
            )
        }
    }

    // get many employees information by employee_id
    async employeeGetInfo(data, msg) {
        try {
            console.log("Handling EMPLOYEE_GET_INFO");
            const { employee_ids } = data;
            const employees = await this.employeeService.getEmployeesByIds(employee_ids);

            this.eventBus.channel.sendToQueue(
                msg.properties.replyTo,
                Buffer.from(JSON.stringify({ success: true, found: !!employees, employees })),
                {
                    correlationId: msg.properties.correlationId,
                    persistent: false
                }
            );
        } catch (error) {
            this.eventBus.channel.sendToQueue(
                msg.properties.replyTo,
                Buffer.from(JSON.stringify({ success: false, message: error.message })),
                {
                    correlationId: msg.properties.correlationId,
                    persistent: false
                }
            );
        }
    }

    // get many employees information by user_id
    async employeeGetInfosByUserIds(data, msg) {
        try {
            console.log("Handling EMPLOYEE_GET_INFOS_USERIDS");
            const { employee_user_ids } = data;
            const employees = await this.employeeService.getEmployeesByUserIds(employee_user_ids);

            this.eventBus.channel.sendToQueue(
                msg.properties.replyTo,
                Buffer.from(JSON.stringify({ success: true, found: !!employees, employees })),
                {
                    correlationId: msg.properties.correlationId,
                    persistent: false
                }
            );
        } catch (err) {
            this.eventBus.channel.sendToQueue(
                msg.properties.replyTo,
                Buffer.from(JSON.stringify({ success: false, message: err.message })),
                {
                    correlationId: msg.properties.correlationId,
                    persistent: false
                }
            );
        }
    }

    async checkTechnicianAvailable(data, msg) {
        try {
            console.log("Handling CHECK_TECHINICIAN_AVAILABLE");
            const { employee_id } = data;
            const employee = await this.employeeService.checkIfTechnicianIsAvailable(employee_id);
            
            this.eventBus.channel.sendToQueue(
                msg.properties.replyTo,
                Buffer.from(JSON.stringify({ success: true, found: !!employee, employee })),
                {
                    correlationId: msg.properties.correlationId,
                    persistent: false
                }
            );
        } catch (error) {
            this.eventBus.channel.sendToQueue(
                msg.properties.replyTo,
                Buffer.from(JSON.stringify({ success: false, message: error.message })),
                {
                    correlationId: msg.properties.correlationId,
                    persistent: false
                }
            );
        }
    }

    async getAllReceptionists(data, msg) {
        try {   
            console.log("Handling EMPLOYEE_GET_RECEPTIONISTS");
            const receptionists = await this.employeeService.getAllEmployees({ position: "receptionist" });
            
            this.eventBus.channel.sendToQueue(
                msg.properties.replyTo,
                Buffer.from(JSON.stringify({ success: true, found: !!receptionists, receptionists })),
                {
                    correlationId: msg.properties.correlationId,
                    persistent: false
                }
            );
        } catch (error) {
            this.eventBus.channel.sendToQueue(
                msg.properties.replyTo,
                Buffer.from(JSON.stringify({ success: false, message: error.message })),
                {
                    correlationId: msg.properties.correlationId,
                    persistent: false
                }
            );
        }
    }

    async getAvailableHousekeepers(data, msg) {
        try {   
            console.log("Handling EMPLOYEE.GET_AVAILABLE_HOUSEKEEPERS");
            const housekeepers = await this.employeeService.getAvailableHousekeepers();
            
            this.eventBus.channel.sendToQueue(
                msg.properties.replyTo,
                Buffer.from(JSON.stringify({ success: true, found: !!housekeepers, housekeepers })),
                {
                    correlationId: msg.properties.correlationId,
                    persistent: false
                }
            );
        } catch (error) {
            this.eventBus.channel.sendToQueue(
                msg.properties.replyTo,
                Buffer.from(JSON.stringify({ success: false, message: error.message })),
                {
                    correlationId: msg.properties.correlationId,
                    persistent: false
                }
            );
        }
    }
}