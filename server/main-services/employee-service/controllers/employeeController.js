import { container } from "../containers/container.js";

export class EmployeeController {
    constructor () {
        this.employeeService = container.employeeService;
    }

    createEmployee = async (req, res) => {
        try {
            const employee = await this.employeeService.createEmployee(req.params.userId, req.body);

            return res.status(200).json({employee});
            
        } catch (err) {
            return res.status(err.status || 400).json({ message: err.message });
        }
    }

    getAllEmployees = async (req, res) => {
        try {
            const { count, employees } = await this.employeeService.getAllEmployees(req.query);
            return res.status(200).json({ count, employees });
        } catch (err) {
            return res.status(err.status || 400).json({ message: err.message });
        }
    };

    getEmployeeById = async (req, res) => {
        try {
            const employee = await this.employeeService.getEmployeeById(req.params.id);
            return res.status(200).json(employee);
        } catch (err) {
            return res.status(err.status || 400).json({ message: err.message });
        }
    };

    updateEmployee = async (req, res) => {
        try {
            const employee = await this.employeeService.updateEmployee(req.params.id, req.body);
            return res.status(200).json(employee);
        } catch (err) {
            return res.status(err.status || 400).json({ message: err.message });
        }
    };

    createAccountForExistingEmployee = async (req, res) => {
        try {
            const newUser = await this.employeeService.createAccountForExistingEmployee(req.params.id, req.body);
            return res.status(200).json(newUser);
        } catch (err) {
            return res.status(err.status || 400).json({ message: err.message });
        }
    };

    resetPasswordForEmployee = async (req, res) => {
        try {
            await this.employeeService.resetPasswordForEmployee(req.params.id, req.body.newPassword);
            return res.status(200).json({ message: "Mật khẩu đã được đặt lại thành công." });
        } catch (err) {
            return res.status(err.status || 400).json({ message: err.message });
        }
    };

    getAvailableTechnicians = async (req, res) => {
        try {
            const { count, technicians } = await this.employeeService.getAvailableTechnicians();
    
            res.status(200).json({
                success: true,
                count, technicians 
            });

        } catch (error) {
            return res.status(err.status || 400).json({ message: err.message });
        }
    };

    toggleBanUser = async (req, res) => {
        try {
            await this.employeeService.toggleBanUser(req.params.id, req.body.isBanned);
            return res.status(200).json({ message: "Tài khoản đã bị ban/mở ban thành công." });
        } catch (err) {
            return res.status(err.status || 400).json({ message: err.message });
        }
    };

    getMyProfile = async (req, res) => {
        try {
            const employee = await this.employeeService.getMyProfile(req.user.userId);
            return res.status(200).json(employee);
        } catch (err) {
            return res.status(err.status || 400).json({ message: err.message });
        }
    };

    checkInShift = async (req, res) => {
        try {
            const attendance = await this.employeeService.checkInShift(req.user.userId, req.params.scheduleId);

            return res.status(200).json({ message: "Check-in shift successfully.", attendance });

        } catch (err) {
            return res.status(err.status || 400).json({ message: err.message });
        }
    };

    checkOutShift = async (req, res) => {
        try {
            const { attendance, earning, next_shift } = await this.employeeService.checkOutShift(req.user.userId);

            return res.status(200).json({ message: "Check-out shift successfully.", attendance, earning, next_shift });

        } catch (err) {
            return res.status(err.status || 400).json({ message: err.message });
        }
    };

    // manager views employee earnings
    getEmployeeEarningById = async (req, res) => {
        try {
            const employeeId = req.params.employeeId;
            const result = await this.employeeService.getEmployeeEarningById(employeeId, req.query);

            return res.status(200).json({ success: true, data: result });

        } catch (error) {
            return res.status(err.status || 400).json({ message: err.message });
        }
    };

    getAllEmployeesEarnings = async (req, res) => {
        try {
            const result = await this.employeeService.getAllEmployeesEarnings(req.query);

            return res.status(200).json({ success: true, data: result });

        } catch (error) {
            return res.status(err.status || 400).json({ message: err.message });
        }
    };

    // employee views own earnings
    getMyEarnings = async (req, res) => {
        try {
            const result = await this.employeeService.getMyEarnings(req.user.userId, req.query);

            return res.status(200).json({ success: true, data: result });

        } catch (error) {
            return res.status(err.status || 400).json({ message: err.message });
        }
    };
}