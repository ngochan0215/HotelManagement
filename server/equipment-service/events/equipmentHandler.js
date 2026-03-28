//import { EMPLOYEE_EVENTS } from "../../shared/events/employeeEvents.js";

export class EquipmentEventHandler {
    constructor(equipmentService) {
        this.equipmentService = equipmentService;
    }

    handlers() {
        // return {
        //     [EMPLOYEE_EVENTS.REGISTERED]: this.employeeRegistered.bind(this)
        // }
    }

    // async employeeRegistered(data) {
    //     console.log("Handling EMPLOYEE_REGISTERED");
    //     await this.employeeService.createEmployee(data);
    // }
}