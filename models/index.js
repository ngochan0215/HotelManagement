import User from "./User/Users.js";
import Customer from "./User/Customers.js";
import Employee from "./User/Employees.js";
import Shift from "./User/Shifts.js";
import Schedule from "./User/Schedules.js";

import Equipment from "./Equipment/Equipment.js";
import EquipmentCategory from "./Equipment/EquipmentCategory.js";
import EquipmentTicket from "./Equipment/EquipmentTicket.js";
import EquipmentImport from "./Equipment/EquipmentImport.js";
import EquipmentInstall from "./Equipment/EquipmentInstall.js";
import InstallDetail from "./Equipment/EquipmentDetail.js";

import ServiceCategory from "./Service/ServiceCategory.js";
import Service from "./Service/Service.js";
import GoodImport from "./Service/GoodImport.js";
import GoodTicket from "./Service/GoodTicket.js";

import Discount from "./Discount.js";

import RoomCategory from "./Room/RoomCategory.js";
import Room from "./Room/Rooms.js";

export {
    User, Customer, Employee, Shift, Schedule,
    Equipment, EquipmentCategory, EquipmentTicket, EquipmentImport, EquipmentInstall, InstallDetail,
    Service, ServiceCategory, GoodImport, GoodTicket,
    Discount,
    Room, RoomCategory,
};