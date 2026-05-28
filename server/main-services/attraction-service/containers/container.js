import Attraction from "../models/Attraction.js";
import { SyncService } from "../services/syncService.js";
import { AttractionService } from "../services/attractionService.js";

class Container {
    constructor() {
        this.syncService = new SyncService();

        this.attractionService = new AttractionService({
            Attraction,
            syncService: this.syncService,
        });
    }

    async init() {
        // cold-start: seed from API if collection is empty
        const isEmpty = await this.syncService.isCollectionEmpty();
        if (isEmpty) {
            console.log("[INIT] Attraction collection is empty — running initial sync.");
            this.syncService.runFullSync().catch(err =>
                console.error("[INIT] Initial sync error:", err.message)
            );
        }
    }
}

export const container = new Container();
