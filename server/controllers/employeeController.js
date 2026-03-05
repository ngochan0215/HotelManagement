import { container } from "../container/index.js";

export class EmployeeController {
  constructor() {
    this.employeeService = container.employeeService;
  }

  registerEmployee = async (req, res) => {
    try {
      const result = await this.employeeService.registerEmployee(req.body);
      return res.status(201).json(result);
    } catch (err) {
      return res.status(400).json({ message: err.message });
    }
  };

  getAllEmployees = async (req, res) => {
    try {
      const { count, employees } = await this.employeeService.getAllEmployees(req.query);
      return res.status(200).json({ count, employees });
    } catch (err) {
      return res.status(400).json({ message: err.message });
    }
  };

  getEmployeeById = async (req, res) => {
    try {
      const { employee } = await this.employeeService.getEmployeeById(req.params.id);
      return res.status(200).json({ employee });
    } catch (err) {
      return res.status(400).json({ message: err.message });
    }
  };

  updateEmployee = async (req, res) => {
    try {
      const { employee } = await this.employeeService.updateEmployee(req.params.id, req.body);
      return res.status(200).json({ employee });
    } catch (err) {
      return res.status(400).json({ message: err.message });
    }
  };

  createAccountForExistingEmployee = async (req, res) => {
    try {
      const { newUser } = await this.employeeService.createAccountForExistingEmployee(req.params.id, req.body);
      return res.status(200).json({ newUser });
    } catch (err) {
      return res.status(400).json({ message: err.message });
    }
  };

  resetPasswordForEmployee = async (req, res) => {
    try {
      console.log("Controller: Resetting password for employee ID:", req.params.id);
      console.log("Controller: New password:", req.body.newPassword);
      await this.employeeService.resetPasswordForEmployee(req.params.id, req.body.newPassword);
      return res.status(200).json({ message: "Mật khẩu đã được đặt lại thành công." });
    } catch (err) {
      return res.status(400).json({ message: err.message });
    }
  };

  toggleBanUser = async (req, res) => {
    try {
      await this.employeeService.toggleBanUser(req.params.id, req.body);
      return res.status(200).json({ message: "Tài khoản đã bị ban/mở ban thành công." });
    } catch (err) {
      return res.status(400).json({ message: err.message });
    }
  };

  getMyProfile = async (req, res) => {
    try {
      const { employee } = await this.employeeService.getMyProfile(req.user.userId);
      return res.status(200).json({ employee });
    } catch (err) {
      return res.status(400).json({ message: err.message });
    }
  };

  checkInShift = async (req, res) => {
    try {
      await this.employeeService.checkInShift(req.params.id);
      return res.status(200).json({ message: "Check-in chấm công thành công." });
    } catch (err) {
      return res.status(400).json({ message: err.message });
    }
  };

  checkOutShift = async (req, res) => {
    try {
      await this.employeeService.checkOutShift(req.params.id);
      return res.status(200).json({ message: "Check-out chấm công thành công." });
    } catch (err) {
      return res.status(400).json({ message: err.message });
    }
  };
}