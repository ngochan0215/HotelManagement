import { User, Employee, Shift, Schedule, Attendance } from "../models/index.js";
import { defaultAvatars } from "../config/avatars.js";
import { EmployeeService }  from "../services/employeeService.js";
import { timeToMinutes } from "../utils/time.js";

class Container {
  constructor() {
    this.employeeService = new EmployeeService({
      User,
      Employee,
      Schedule,
      Attendance,
      defaultAvatars,
      timeToMinutes
    });
  }
}

export const container = new Container();