import { ROOM_EVENTS } from "../../../shared/events/roomEvents.js";

export class RoomEventHandler {
    constructor(roomService, eventBus) {
        this.roomService = roomService;
        this.eventBus = eventBus;
    }

    handlers() {
        return {
            [ROOM_EVENTS.CHECK_EXISTS]: this.roomCheckExists.bind(this),
            [ROOM_EVENTS.GET_ROOMS_INFO]: this.getRoomsInfo.bind(this),
        }
    }

    // check room existence using room_id
    async roomCheckExists(data, msg) {
        console.log("Handling ROOM_CHECK_EXISTS");
        const { room_id } = data;
        const room = await this.roomService.getRoomById(room_id);

        this.eventBus.channel.sendToQueue(
            msg.properties.replyTo,
            Buffer.from(JSON.stringify({ found: !!room, room })),
            {
                correlationId: msg.properties.correlationId,
                persistent: false
            }
        )
    }

    // get various rooms info (for population)
    async getRoomsInfo(data, msg) {
        console.log("Handling GET_ROOMS_INFO");
        const { room_ids } = data;
        const rooms = await this.roomService.getRoomsByIds(room_ids);

        this.eventBus.channel.sendToQueue(
            msg.properties.replyTo,
            Buffer.from(JSON.stringify({ found: !!rooms, rooms })),
            {
                correlationId: msg.properties.correlationId,
                persistent: false
            }
        )
    }
}