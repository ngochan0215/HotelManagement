import { container } from "../containers/container.js";

export class CompensationController {
    constructor() {
        this.compensationService = container.compensationService;
    }

    createCompensateTicket = async (req, res) => {
        try {
            const ticket = await this.compensationService.createCompensateTicket(req.user.userId, req.params.incident_id, req.body);
            
            return res.status(201).json({ message: "Tạo phiếu đền bù thành công.", data: ticket });

        } catch (err) {
            return res.status(err.status || 400).json({ message: err.message });
        }
    };

    createCompensateTicketOther = async (req, res) => {
        try {
            const ticket = await this.compensationService.createCompensateTicketOther(req.user.userId, req.params.incident_id, req.body);
        
            return res.status(201).json({ message: "Tạo phiếu đền bù thành công.", data: ticket });
            
        } catch (err) {
            return res.status(err.status || 400).json({ message: err.message });
        }
    };

    getAllCompensateTickets = async (req, res) => {
        try {
            const result = await this.compensationService.getAllCompensateTickets(req.query);

            return res.status(200).json({ total: result.length, data: result });

        } catch (err) { 
            return res.status(err.status || 400).json({ message: err.message }); 
        }
    };

    getCompensateTicketById = async (req, res) => {
        try {
            const result = await this.compensationService.getCompensateTicketById(req.params.id);
            return res.status(200).json(result);
        } catch (err) {
            return res.status(err.status || 400).json({ message: err.message });
        }
    };

    updateCompensateTicket = async (req, res) => {
        try {
            const ticket = await this.compensationService.updateCompensateTicket(req.params.id, req.body);

            return res.status(200).json({ message: "Cập nhật phiếu đền bù thành công.", data: ticket });

        } catch (err) {
            return res.status(err.status || 400).json({ message: err.message });
        }
    };

    confirmCompensationPaid = async (req, res) => {
        try {
            await this.compensationService.confirmCompensationPaid( req.user.userId, req.params.id, req.body.note);
            
            return res.status(200).json({ message: "Xác nhận bồi thường thành công." });

        } catch (err) {
            return res.status(err.status || 400).json({ message: err.message });
        }
    };
}