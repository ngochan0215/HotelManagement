import { EMPLOYEE_EVENTS } from "../../shared/events/employeeEvents.js";

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
            [EMPLOYEE_EVENTS.GET_INFO_USERID]: this.employeeGetInfoByUserId.bind(this),
        }
    }

    async employeeRegistered(data) {
        console.log("Handling EMPLOYEE_REGISTERED");
        await this.employeeService.createEmployee(data);
    }

    // check employee existence as well as his information (using employee_id)
    async employeeCheckExists(data, msg) {
        console.log("Handling EMPLOYEE_CHECK_EXISTS");
        const { employee_id } = data;
        const employee = await this.employeeService.findEmployeeById(employee_id);

        this.eventBus.channel.sendToQueue(
            msg.properties.replyTo,
            Buffer.from(JSON.stringify({ found: !!employee, employee })),
            {
                correlationId: msg.properties.correlationId,
                persistent: false
            }
        )
    }

    // check employee existence as well as his information (using employee_user_id)
    async employeeCheckExistsByUserId(data, msg) {
        console.log("Handling EMPLOYEE_CHECK_EXISTS_USERID");
        const { employee_user_id } = data;
        const employee = await this.employeeService.findEmployeeByUserId(employee_user_id);

        this.eventBus.channel.sendToQueue(
            msg.properties.replyTo,
            Buffer.from(JSON.stringify({ found: !!employee, employee })),
            {
                correlationId: msg.properties.correlationId,
                persistent: false
            }
        )
    }

    // get many employees information by employee_id
    async employeeGetInfo(data, msg) {
        console.log("Handling EMPLOYEE_GET_INFO");
        const { employee_ids } = data;
        const employees = await this.employeeService.getEmployeesById(employee_ids);

        this.eventBus.channel.sendToQueue(
            msg.properties.replyTo,
            Buffer.from(JSON.stringify({ found: !!employees, employees })),
            {
                correlationId: msg.properties.correlationId,
                persistent: false
            }
        );
    }

    // get one employee information by user_id
    async employeeGetInfoByUserId(data, msg) {
        console.log("Handling EMPLOYEE_GET_INFO_USERID");
        const { employee_user_id } = data;
        const employee = await this.employeeService.getEmployeeByUserId(employee_user_id);

        this.eventBus.channel.sendToQueue(
            msg.properties.replyTo,
            Buffer.from(JSON.stringify({ found: !!employee, employee })),
            {
                correlationId: msg.properties.correlationId,
                persistent: false
            }
        );
    }
}