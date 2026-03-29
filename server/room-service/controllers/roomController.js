import { container } from "../containers/container.js";

export class RoomController {
    constructor() {
        this.roomService = container.roomService;
    }

    getRoomById = async (req, res) => {
        try {
            const room = await this.roomService.getRoomById(req.params.id);
            return res.status(200).json({ room });
        } catch (error) {
            return res.status(500).json({ message: "SERVER ERROR: " + error.message });
        }
    }
}