import { NotificationService } from "../services/notificationService.js";
import Notification from "../models/Notification.js";
import { getSocketInstance } from "../socket/instance.js";

class Container {
    constructor() {
        this.notificationService = new NotificationService({
            Notification, 
            getSocketInstance
        });
    }

    async init() {}
}

export const container = new Container();