import { ROOM_EVENTS } from "../../../shared/events/roomEvents.js";

export class RoomEventHandler {
    constructor(roomService, eventBus) {
        this.roomService = roomService;
        this.eventBus = eventBus;
    }

    handlers() {
        return {
            [ROOM_EVENTS.CHECK_EXISTS]: this.roomCheckExists.bind(this),
            [ROOM_EVENTS.UPDATE_ROOM_INFO]: this.updateRoomInternal.bind(this),
            [ROOM_EVENTS.GET_ROOMS_INFO]: this.getRoomsInfo.bind(this),
 
            [ROOM_EVENTS.FIND_ROOM_LOGS]: this.findRoomLogs.bind(this),
            [ROOM_EVENTS.UPDATE_ROOM_LOG]: this.updateRoomLog.bind(this),
            [ROOM_EVENTS.INSERT_ROOM_LOG]: this.insertRoomLog.bind(this),

            [ROOM_EVENTS.GET_CATEGORY_IDS]: this.getCategoryIdsByRoomIds.bind(this),
            [ROOM_EVENTS.UPDATE_CATEGORY_RATING]: this.updateRoomCategoryRating.bind(this),
            [ROOM_EVENTS.GET_DEFAULT_EQUIPMENTS_ROOM_CATEGORY]: this.getDefaultEquipmentsByRoomCategory.bind(this)
        }
    }

    // check room existence using room_id
    async roomCheckExists(data, msg) {
        try {
            console.log("Handling ROOM_CHECK_EXISTS");
            const { room_id } = data;
            const room = await this.roomService.getRoomById(room_id);

            this.eventBus.channel.sendToQueue(
                msg.properties.replyTo,
                Buffer.from(JSON.stringify({ success: true, found: !!room, room })),
                {
                    correlationId: msg.properties.correlationId,
                    persistent: false
                }
            );

        } catch (error) {
            this.eventBus.channel.sendToQueue(
                msg.properties.replyTo,
                Buffer.from(JSON.stringify({ success: false, message: error.message })),
                {
                    correlationId: msg.properties.correlationId,
                    persistent: false
                }
            );
        }
    }

    // get various rooms info (for population)
    async getRoomsInfo(data, msg) {
        try {
            console.log("Handling GET_ROOMS_INFO");
            const { room_ids } = data;
            const rooms = await this.roomService.getRoomsByIds(room_ids);

            this.eventBus.channel.sendToQueue(
                msg.properties.replyTo,
                Buffer.from(JSON.stringify({ success: true, found: !!rooms, rooms })),
                {
                    correlationId: msg.properties.correlationId,
                    persistent: false
                }
            );

        } catch (error) {
            this.eventBus.channel.sendToQueue(
                msg.properties.replyTo,
                Buffer.from(JSON.stringify({ success: false, message: error.message })),
                {
                    correlationId: msg.properties.correlationId,
                    persistent: false
                }
            );
        }
    }

    async updateRoomLog(data, msg) {
        try {
            console.log("Handling UPDATE_ROOM_LOGS");
            const { filter, updateData, options } = data;
            const result = await this.roomService.updateRoomLog(filter, updateData, options);

            this.eventBus.channel.sendToQueue(
                msg.properties.replyTo,
                Buffer.from(JSON.stringify({ success: true, found: !!result, result })),
                {
                    correlationId: msg.properties.correlationId,
                    persistent: false
                }
            )
        } catch (error) {
            this.eventBus.channel.sendToQueue(
                msg.properties.replyTo,
                Buffer.from(JSON.stringify({ success: false, message: error.message })),
                {
                    correlationId: msg.properties.correlationId,
                    persistent: false
                }
            )
        }
    }

    async findRoomLogs(data, msg) {
        try {
            console.log("Handling FIND_ROOM_LOGS");
            const { filter, opts } = data;
            const roomLogs = await this.roomService.findRoomLogs(filter, opts);

            this.eventBus.channel.sendToQueue(
                msg.properties.replyTo,
                Buffer.from(JSON.stringify({ success: true, found: !!roomLogs, roomLogs })),
                {
                    correlationId: msg.properties.correlationId,
                    persistent: false
                }
            );

        } catch (error) {
            this.eventBus.channel.sendToQueue(
                msg.properties.replyTo,
                Buffer.from(JSON.stringify({ success: false, message: error.message })),
                {
                    correlationId: msg.properties.correlationId,
                    persistent: false
                }
            );
        }
    }

    async insertRoomLog(_data, msg) {
        try {
            console.log("Handling INSERT_ROOM_LOGS");
            const { data, options } = _data;
            const roomLogs = await this.roomService.insertRoomLog(data, options);

            this.eventBus.channel.sendToQueue(
                msg.properties.replyTo,
                Buffer.from(JSON.stringify({ success: true, found: !!roomLogs, roomLogs })),
                {
                    correlationId: msg.properties.correlationId,
                    persistent: false
                }
            );

        } catch (error) {
            this.eventBus.channel.sendToQueue(
                msg.properties.replyTo,
                Buffer.from(JSON.stringify({ success: false, message: error.message })),
                {
                    correlationId: msg.properties.correlationId,
                    persistent: false
                }
            );
        }
    }

    async updateRoomInternal(data, msg) {
        try {
            console.log("Handling UPDATE_ROOM_INFO");
            const room = await this.roomService.updateRoomInternal(data);

            this.eventBus.channel.sendToQueue(
                msg.properties.replyTo,
                Buffer.from(JSON.stringify({ success: true, found: !!room, room })),
                {
                    correlationId: msg.properties.correlationId,
                    persistent: false
                }
            )
        } catch (error) {
            this.eventBus.channel.sendToQueue(
                msg.properties.replyTo,
                Buffer.from(JSON.stringify({ success: false, message: error.message })),
                {
                    correlationId: msg.properties.correlationId,
                    persistent: false
                }
            )
        }
    }

    async updateRoomCategoryRating(data, msg) {
        try {
            console.log("Handling UPDATE_CATEGORY_RATING");
            const { categoryId, updateData } = data;
            const updatedReview = await this.roomService.updateRoomCategoryRating(categoryId, updateData);

            this.eventBus.channel.sendToQueue(
                msg.properties.replyTo,
                Buffer.from(JSON.stringify({ success: true, updatedReview })),
                {
                    correlationId: msg.properties.correlationId,
                    persistent: false
                }
            )
        } catch (error) {
            this.eventBus.channel.sendToQueue(
                msg.properties.replyTo,
                Buffer.from(JSON.stringify({ success: false, message: error.message })),
                {
                    correlationId: msg.properties.correlationId,
                    persistent: false
                }
            )
        }
    }

    async getCategoryIdsByRoomIds(data, msg) {
        try {
            console.log("Handling GET_CATEGORY_IDS");
            const { roomIds } = data;
            const categoryIds = await this.roomService.getCategoryIdsByRoomIds(roomIds);

            this.eventBus.channel.sendToQueue(
                msg.properties.replyTo,
                Buffer.from(JSON.stringify({ success: true, categoryIds })),
                {
                    correlationId: msg.properties.correlationId,
                    persistent: false
                }
            )
        } catch (error) {
            this.eventBus.channel.sendToQueue(
                msg.properties.replyTo,
                Buffer.from(JSON.stringify({ success: false, message: error.message })),
                {
                    correlationId: msg.properties.correlationId,
                    persistent: false
                }
            )
        }
    }

    async getDefaultEquipmentsByRoomCategory(data, msg) {
        try {
            console.log("Handling ROOM.GET_DEFAULT_EQUIPMENTS_ROOM_CATEGORY");
            const { categoryId } = data;
            
            const defaultEquipments = await this.roomService.getDefaultEquipmentsByRoomCategory(categoryId);

            this.eventBus.channel.sendToQueue(
                msg.properties.replyTo,
                Buffer.from(JSON.stringify({ success: true, defaultEquipments })),
                {
                    correlationId: msg.properties.correlationId,
                    persistent: false
                }
            )
        } catch (error) {
            this.eventBus.channel.sendToQueue(
                msg.properties.replyTo,
                Buffer.from(JSON.stringify({ success: false, message: error.message })),
                {
                    correlationId: msg.properties.correlationId,
                    persistent: false
                }
            )
        }
    }
}