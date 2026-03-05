import { container } from "../container/index.js";

export class CompensateController {
    constructor() {
        this.compensateService = container.compensateService;
    }

    createCompensateTicket = async (req, res) => {
        try {
            const ticket = await this.compensateService.createCompensateTicket(req.user.userId, req.params.incident_id, req.body);
            
            return res.status(201).json({ message: "Tạo phiếu đền bù thành công.", data: ticket });

        } catch (err) {
            return res.status(500).json({ message: "SERVER ERROR: " + err.message });
        }
    };

    createCompensateTicketOther = async (req, res) => {
        try {
            const ticket = await this.compensateService.createCompensateTicketOther(req.user.userId, req.params.incident_id, req.body);
        
            return res.status(201).json({ message: "Tạo phiếu đền bù thành công.", data: ticket });
            
        } catch (err) {
            return res.status(500).json({ message: "SERVER ERROR: " + err.message });
        }
    };

    getAllCompensateTickets = async (req, res) => {
        try {
            const result = await this.compensateService.getAllCompensateTickets(req.query);

            return res.status(200).json({ total: result.length, data: result });

        } catch (error) { 
            return res.status(500).json({ message: "SERVER ERROR: " + error.message }); 
        }
    };

    getCompensateTicketById = async (req, res) => {
        try {
            const ticket = await this.compensateService.getCompensateTicketById(req.params.id);
            return res.status(200).json({ ticket });
        } catch (error) {
            return res.status(500).json({ message: "SERVER ERROR: " + error.message });
        }
    };

    updateCompensateTicket = async (req, res) => {
        try {
            const ticket = await this.compensateService.updateCompensateTicket(req.params.id, req.body);

            return res.status(200).json({ message: "Cập nhật phiếu đền bù thành công.", data: ticket });

        } catch (error) {
            return res.status(500).json({ message: "SERVER ERROR: " + error.message });
        }
    };

    confirmCompensationPaid = async (req, res) => {
        try {
            await this.compensateService.confirmCompensationPaid( req.user.userId, req.params.id, req.body.note);
            
            return res.status(200).json({ message: "Xác nhận bồi thường thành công." });

        } catch (error) {
            return res.status(500).json({ message: "SERVER ERROR: " + error.message });
        }
    };
}