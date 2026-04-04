import { container } from "../containers/container.js";

export class IncidentController {
    constructor() {
        this.incidentService = container.incidentService;
    }

    createIncident = async (req, res) => {
        try {
            const incident = await this.incidentService.createIncident(req.user.userId, req.body);
            
            return res.status(201).json({ message: "Thêm sự cố thành công.", data: incident });

        } catch (err) {
            return res.status(500).json({ message: "SERVER ERROR: " + err.message });
        }
    };

    updateIncident = async (req, res) => {
        try {
            const incident = await this.incidentService.updateIncident(req.params.id, req.body, req.user.userId);

            return res.status(200).json({ message: "Cập nhật sự cố thành công.", data: incident });

        } catch (error) {
            return res.status(500).json({ message: "SERVER ERROR: " + error.message });
        }
    };

    assignIncident = async (req, res) => {
        try {
            const incident = await this.incidentService.assignIncident(req.user.userId, req.params.id, req.body.assignee_id, req.body.note);
            
            return res.json({ success: true, message: "Phân công xử lý sự cố thành công", data: incident });

        } catch (error) {
            return res.status(500).json({ message: "SERVER ERROR: " + error.message });
        }
    };

    resolveIncident = async (req, res) => {
        try {
            const incident = await this.incidentService.resolveIncident(req.user.userId, req.params.id, req.body);

            res.json({ success: true, message: "Đã xác nhận xử lý xong.", data: incident });

        } catch (err) {
            res.status(500).json({ message: "SERVER ERROR: " + err.message });
        }
    };

    closedIncident = async (req, res) => {
        try {
            await this.incidentService.closedIncident(req.user.userId, req.params.id, req.body);
        
            res.status(200).json({ success: true, message: "Đã đóng sự cố thành công." });

        } catch (err) {
            res.status(500).json({ message: "SERVER ERROR: " + err.message });
        }
    };

    getAllIncidents = async (req, res) => {
        try {
            const result = await this.incidentService.getAllIncidents(req.user.userId, req.query);

            return res.status(200).json({ data: result });
            
        } catch (error) {
            return res.status(500).json({ message: "SERVER ERROR: " + error.message });
        }
    };

    getIncidentById = async (req, res) => {
        try {
            const incident = await this.incidentService.getIncidentById(req.params.id);

            return res.status(200).json({ incident });

        } catch (error) {
            return res.status(500).json({ message: "SERVER ERROR: " + error.message });
        }
    };

    deleteIncident = async (req, res) => {
        try {
            await this.incidentService.deleteIncident(req.params.id);
            
            return res.status(200).json({ message: "Xóa sự cố thành công." });

        } catch (error) {
            return res.status(500).json({ message: "SERVER ERROR: " + error.message });
        }
    };
}