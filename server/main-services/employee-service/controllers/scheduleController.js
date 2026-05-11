import { container } from "../containers/container.js";

export class ScheduleController {
    constructor() {
        this.scheduleService = container.scheduleService;
    }

    // manager management

    getAllSchedules = async (req, res) => {
        try {
            const { count, employees } = await this.scheduleService.getAllSchedules(req.query);
           
            res.status(200).json({
                success: true,
                count, employees
            });
        
        } catch (error) {
            return res.status(err.status || 400).json({ message: err.message });
        }
    };
    
    getScheduleById = async (req, res) => {
        try {
            const schedule = await this.scheduleService.getScheduleById(req.params.id);
        
            res.status(200).json({ success: true, data: schedule });
        
        } catch (error) {
            return res.status(err.status || 400).json({ message: err.message });
        }
    };

    getContractById = async (req, res) => {
        try {
            const { contract, employee, recurring_shifts, total_weeks, total_schedules, by_week } = await this.scheduleService.getContractById(req.params.id);
        
            res.status(200).json({ success: true, data: { contract, employee, recurring_shifts, total_weeks, total_schedules, by_week } });
        
        } catch (error) {
            return res.status(err.status || 400).json({ message: err.message });
        }
    };

    updateScheduleContractStatus = async (req, res) => {
        try {
            const { update_count, contract, schedules } = await this.scheduleService.updateScheduleContractStatus(req.params.id, req.body);
        
            res.status(200).json({ 
                success: true,
                message: "Update schedule contract status successfully.", 
                data: { schedules, update_count, contract } 
            });
        
        } catch (error) {
            return res.status(err.status || 400).json({ message: err.message });
        }
    };

    // shifts

    createShift = async (req, res) => {
        try {
            const shift = await this.scheduleService.createShift(req.body);
            
            res.status(200).json({ success: true, message: "Created shift successfully.", data: shift });
        
        } catch (error) {
            return res.status(err.status || 400).json({ message: err.message });
        }
    };

    getAllShifts = async (req, res) => {
        try {
            const result = await this.scheduleService.getAllShifts(req.query);
            
            res.status(200).json({ success: true, message: "Fetched all shifts successfully.", data: result });
        
        } catch (error) {
            return res.status(err.status || 400).json({ message: err.message });
        }
    };

    getShiftById = async (req, res) => {
        try {
            const shift = await this.scheduleService.getShiftById(req.params.id);
            
            res.status(200).json({ success: true, message: "Fetched shift successfully.", data: shift });
        
        } catch (error) {
            return res.status(err.status || 400).json({ message: err.message });
        }
    };

    updateShift = async (req, res) => {
        try {
            const shift = await this.scheduleService.updateShift(req.params.id, req.body);
            
            res.status(200).json({ success: true, message: "Updated shift successfully.", data: shift });
        
        } catch (error) {
            return res.status(err.status || 400).json({ message: err.message });
        }
    };

    deleteShift = async (req, res) => {
        try {
            const result = await this.scheduleService.deleteShift(req.params.id);
            
            res.status(200).json({ success: true, message: "Deleted shift successfully.", data: result });
        
        } catch (error) {
            return res.status(err.status || 400).json({ message: err.message });
        }
    };
    
    // employee management

    registerSchedule = async (req, res) => {
        try {
            const schedules = await this.scheduleService.registerSchedule(req.user.userId, req.body);
            
            return res.status(200).json({ success: true, message: "Register schedule(s) successfully.", data: schedules });
        
        } catch (err) {
            return res.status(err.status || 400).json({ message: err.message });
        }
    };
    
    viewMySchedule = async (req, res) => {
        try {
            const { contract, total_weeks, total_schedules, by_week } = await this.scheduleService.viewMySchedule(req.user.userId);
            
            res.status(200).json({
                success: true,
                contract,
                total_weeks,
                total_schedules,
                by_week,
            });

        } catch (error) {
            return res.status(err.status || 400).json({ message: err.message });
        }
    };
    
    updateSchedule = async (req, res) => {
        try {
            const schedule = await this.scheduleService.updateSchedule(req.params.id, req.user.userId, req.body);
            
            res.status(200).json({ success: true, message: "Update schedule successfully.", data: schedule });

        } catch (error) {
            return res.status(err.status || 400).json({ message: err.message });
        }
    };
    
    deleteSchedule = async (req, res) => {
        try {
            await this.scheduleService.deleteSchedule(req.user.userId, req.params.id);
            
            return res.status(200).json({
                success: true,
                message: "Delete schedule successfully."
            });
        
        } catch (err) {
            return res.status(err.status || 400).json({ message: err.message });
        }
    };

    cancelContract = async (req, res) => {
        try {
            const { cancelled_schedules_count, keep_approved_schedules } = await this.scheduleService.cancelContract(req.user.userId, req.params.id, req.body);
            
            return res.status(200).json({
                success: true,
                message: "Contract cancelled successfully.",
                cancelled_schedules_count, keep_approved_schedules
            });
        
        } catch (err) {
            return res.status(err.status || 400).json({ message: err.message });
        }
    };

    getAvailableShifts = async (req, res) => {
        try {
            const result = await this.scheduleService.getAvailableShifts(req.user.userId, req.query);

            return res.status(200).json({ success: true, data: result });

        } catch (error) {
            return res.status(err.status || 400).json({ message: err.message });
        }
    };

    getPendingScheduleRequests = async (req, res) => {
        try {
            const { count, requests } = await this.scheduleService.getPendingScheduleRequests(req.query);

            return res.status(200).json({ success: true, count, requests });

        } catch (error) {
            return res.status(err.status || 400).json({ message: err.message });
        }
    };
}