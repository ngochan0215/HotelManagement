import Room from "../models/Room.js";
import RoomCategory from "../models/RoomCategory.js";
import RoomLog from "../models/RoomLog.js";
import DefaultEquipment from "../models/DefaultEquipment.js";

import { RoomService } from "../services/roomService.js";
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

        this.roomEventHandler = new RoomEventHandler(this.roomService, this.eventBus);
    }

    async init() {
        await this.eventBus.connect({
            queueName: "room-service-queue",
            bindEvents: [
                ROOM_EVENTS.CHECK_EXISTS,
                ROOM_EVENTS.GET_ROOMS_INFO,
            ]
        });
        const handlers = this.roomEventHandler.handlers();
        
        const consumer = new EventConsumer(this.eventBus, handlers);
        await consumer.start();
    }
}

export const container = new Container();