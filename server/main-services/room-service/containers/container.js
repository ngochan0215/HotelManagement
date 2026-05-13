import Room from "../models/Room.js";
import RoomCategory from "../models/RoomCategory.js";
import RoomLog from "../models/RoomLog.js";
import DefaultEquipment from "../models/DefaultEquipment.js";

import { RoomService } from "../services/roomService.js";
import { RoomStatisticService } from "../services/roomStatisticService.js";

import { RoomEventHandler } from "../events/roomHandler.js";
import { EventBus } from "../../../shared/messaging/eventBus.js";
import { EventConsumer } from "../../../shared/messaging/eventConsumer.js";

import { ROOM_EVENTS } from "../../../shared/events/roomEvents.js";

class Container {
    constructor() {
        this.eventBus = new EventBus();

        this.roomService = new RoomService({
            Room, RoomCategory,RoomLog, DefaultEquipment,
            eventBus: this.eventBus
        });

        this.roomStatisticService = new RoomStatisticService({
            Room, RoomCategory,RoomLog, DefaultEquipment,
            eventBus: this.eventBus
        });

        this.roomEventHandler = new RoomEventHandler(this.roomService, this.eventBus);
    }

    async init() {
        await this.eventBus.connect({
            queueName: "room-service-events",
            bindEvents: [
                ROOM_EVENTS.CHECK_EXISTS,
                ROOM_EVENTS.GET_ROOMS_INFO,
                ROOM_EVENTS.UPDATE_ROOM_INFO,
                
                ROOM_EVENTS.FIND_ROOM_LOGS,
                ROOM_EVENTS.UPDATE_ROOM_LOG,
                ROOM_EVENTS.INSERT_ROOM_LOG,

                ROOM_EVENTS.GET_CATEGORY_IDS,
                ROOM_EVENTS.UPDATE_CATEGORY_RATING,
                ROOM_EVENTS.GET_DEFAULT_EQUIPMENTS_ROOM_CATEGORY
            ]
        });

        const handlers = this.roomEventHandler.handlers();
        const consumer = new EventConsumer(this.eventBus, handlers);
        await consumer.start();
    }
}

export const container = new Container();