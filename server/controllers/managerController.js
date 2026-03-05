import { container } from "../container/index.js";

export class ManagerController {
  constructor() {
    this.managerService = container.managerService;
  }

  setRole = async (req, res) => {
    try {
      await this.managerService.setRole(req.body);

      return res.status(200).json({
        message: `Đã nâng quyền user thành ${newRole}.`,
      });

    } catch (err) {
      console.log(err);
      return res.status(500).json({ message: "SERVER ERROR: " + err.message });
    }
  };

  getAllUsers = async (req, res) => {
    try {
      const users = await this.managerService.getAllUsers(req.query);
  
      res.status(200).json({
        success: true,
        count: users.length,
        users
      });

    } catch (error) {
      console.log(error);
      return res.status(500).json({ message: "SERVER ERROR: " + err.message });
    }
  };

  setRule = async (req, res) => {
    try {
      await this.managerService.setRule();

      return res.status(200).json({
        message: `Đã cập nhật rule cho tất cả phòng.`,
      });

    } catch (err) {
      console.log(err);
      return res.status(500).json({ message: "SERVER ERROR: " + err.message });
    }
  };

  getCalendarRooms = async (req, res) => {
    try {
      const { rooms, events } = await this.managerService.getCalendarRooms(req.query);

      return res.status(200).json({
        rooms,
        events
      });

    } catch (error) {
      console.log("getRoomCalendar error:", error);
      return res.status(500).json({ message: "SERVER ERROR: " + err.message });
    }
  };
}

