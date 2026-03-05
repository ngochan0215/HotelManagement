import { User, Employee, Shift, Schedule, Attendance, Discount, Customer, Booking, 
  Room, RoomLog, BookingDetail, Equipment, Incident, CompensateTicket, IncidentLog,
  CompensateDetail, Receipt, EquipmentCategory, EquipmentLog,  
} from "../models/index.js";
import { defaultAvatars } from "../config/avatars.js";
import { EmployeeService }  from "../services/employeeService.js";
import { DiscountService } from "../services/discountService.js";
import { ManagerService } from "../services/managerService.js";
import { IncidentService } from "../services/incidentService.js";
import { CompensateService } from "../services/compensateService.js";

import { timeToMinutes } from "../utils/time.js";
import { resolveUserFullName } from "../helper/index.js";

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

    this.discountService = new DiscountService({
      Discount,
      Customer,
      Booking
    });

    this.managerService = new ManagerService({
      User,
      Room, 
      RoomLog,
      Booking,
      BookingDetail
    });

    this.incidentService = new IncidentService({
      Incident,
      Room,
      Equipment,
      User,
      Employee, 
      CompensateTicket, 
      IncidentLog,
      resolveUserFullName
    });

    this.compensateService = new CompensateService({
      CompensateTicket,
      CompensateDetail,
      Incident,
      IncidentLog,
      Employee,
      User,
      Receipt,
      Equipment,
      EquipmentCategory,
      EquipmentLog,
      resolveUserFullName
    });
  }
}

export const container = new Container();