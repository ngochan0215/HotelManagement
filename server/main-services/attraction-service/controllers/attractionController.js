import { container } from "../containers/container.js";

export class AttractionController {
    constructor() {
        this.attractionService = container.attractionService;
    }

    getAllAttractions = async (req, res) => {
        try {
            const result = await this.attractionService.getAllAttractions(req.query);
            return res.status(200).json(result);
        } catch (err) {
            return res.status(err.status || 400).json({ message: err.message });
        }
    };

    getAttractionById = async (req, res) => {
        try {
            const attraction = await this.attractionService.getAttractionById(req.params.id);
            return res.status(200).json(attraction);
        } catch (err) {
            return res.status(err.status || 400).json({ message: err.message });
        }
    };

    getAllAttractionsAdmin = async (req, res) => {
        try {
            const result = await this.attractionService.getAllAttractionsAdmin(req.query);
            return res.status(200).json(result);
        } catch (err) {
            return res.status(err.status || 400).json({ message: err.message });
        }
    };

    updateAttraction = async (req, res) => {
        try {
            const attraction = await this.attractionService.updateAttraction(req.params.id, req.body);
            return res.status(200).json({
                success: true,
                message: "Cập nhật địa điểm thành công.",
                data: attraction,
            });
        } catch (err) {
            return res.status(err.status || 400).json({ message: err.message });
        }
    };

    triggerSync = async (req, res) => {
        try {
            const result = await this.attractionService.triggerSync();
            return res.status(200).json({
                success: true,
                message: "Đồng bộ địa điểm thành công.",
                ...result,
            });
        } catch (err) {
            return res.status(err.status || 500).json({ message: err.message });
        }
    };
}
