import Attraction from "../models/Attraction.js";

const OPENTRIPMAP_BASE = "https://api.opentripmap.com/0.1/en/places";

const KINDS_TO_CATEGORY = {
    museums: "cultural",
    historic: "cultural",
    cultural: "cultural",
    architecture: "cultural",
    religion: "cultural",
    monuments: "cultural",
    theatres_and_entertainments: "entertainment",
    amusements: "entertainment",
    adult: "entertainment",
    natural: "natural",
    beaches: "natural",
    parks: "natural",
    gardens: "natural",
    waterfront: "natural",
    foods: "food",
    restaurants: "food",
    cafes: "food",
    sport: "sport",
    stadiums: "sport",
};

function mapCategory(kinds = []) {
    for (const kind of kinds) {
        const cat = KINDS_TO_CATEGORY[kind];
        if (cat) return cat;
    }
    return "other";
}

async function fetchJson(url) {
    const res = await fetch(url);
    if (!res.ok)
        throw new Error(`OpenTripMap API error: ${res.status} ${res.statusText}`);

    return res.json();
}

function sleep(ms) {
    return new Promise(resolve => setTimeout(resolve, ms));
}

export class SyncService {
    constructor() {
        this.apiKey = process.env.OPENTRIPMAP_API_KEY;
        this.hotelLat = parseFloat(process.env.HOTEL_LAT);
        this.hotelLng = parseFloat(process.env.HOTEL_LNG);
        this.radiusM = parseInt(process.env.HOTEL_SEARCH_RADIUS_M || "10000");
    }

    async runFullSync() {
        try {
            if (!this.apiKey) {
                console.error("[SYNC] OPENTRIPMAP_API_KEY not set — skipping sync.");
                return { inserted: 0, updated: 0, skipped: 0 };
            }

            console.log("[SYNC] Starting attraction sync...");

            // Step 1: radius search
            const radiusUrl = `${OPENTRIPMAP_BASE}/radius?radius=${this.radiusM}&lon=${this.hotelLng}&lat=${this.hotelLat}&kinds=interesting_places&format=json&limit=500&apikey=${this.apiKey}`;
            let places;
            try {
                places = await fetchJson(radiusUrl);
            } catch (err) {
                console.error("[SYNC] Radius fetch failed:", err.message);
                return { inserted: 0, updated: 0, skipped: 0 };
            }

            if (!Array.isArray(places) || places.length === 0) {
                console.log("[SYNC] No places returned from API.");
                return { inserted: 0, updated: 0, skipped: 0 };
            }

            console.log(`[SYNC] ${places.length} places found, fetching details...`);

            let inserted = 0;
            let updated = 0;
            let skipped = 0;

            for (const place of places) {
                if (!place.xid || !place.name?.trim()) {
                    skipped++;
                    continue;
                }

                // Step 2: detail fetch
                let detail;
                try {
                    detail = await fetchJson(`${OPENTRIPMAP_BASE}/xid/${place.xid}?apikey=${this.apiKey}&lang=vi`);
                } catch (err) {
                    console.warn(`[SYNC] Detail fetch failed for ${place.xid}:`, err.message);
                    skipped++;
                    continue;
                }

                const kinds = detail.kinds ? detail.kinds.split(",").map(k => k.trim()) : [];
                const category = mapCategory(kinds);
                const description = detail.wikipedia_extracts?.text || detail.info?.descr || "";
                const imageUrl = detail.preview?.source || "";
                const wikiUrl = detail.wikipedia || "";
                const rating = detail.rate ? Math.min(parseInt(detail.rate) || 0, 3) : 0;

                const doc = {
                    xid: place.xid,
                    name: detail.name || place.name,
                    category,
                    kinds,
                    description,
                    coordinates: {
                        lat: detail.point?.lat || place.point?.lat,
                        lng: detail.point?.lon || place.point?.lon,
                    },
                    distance_m: Math.round(place.dist || 0),
                    image_url: imageUrl,
                    wikipedia_url: wikiUrl,
                    rating,
                    last_synced: new Date(),
                };

                if (!doc.coordinates.lat || !doc.coordinates.lng) {
                    skipped++;
                    continue;
                }

                // Step 3: upsert into DB
                try {
                    const existing = await Attraction.exists({ xid: place.xid });

                    await Attraction.findOneAndUpdate(
                        { xid: place.xid },
                        { $set: doc },
                        { upsert: true, setDefaultsOnInsert: true }
                    );

                    if (existing) {
                        updated++;
                    } else {
                        inserted++;
                    }
                } catch (err) {
                    console.warn(`[SYNC] DB upsert failed for ${place.xid}:`, err.message);
                    skipped++;
                }

                // rate limit safety: 100ms between detail calls
                await sleep(100);
            }

            console.log(`[SYNC] Done — inserted: ${inserted}, updated: ${updated}, skipped: ${skipped}`);
            return { inserted, updated, skipped };
        } catch (error) {
            console.error("[SYNC] Unexpected sync error:", error.message);
            throw error;
        }
    }

    async isCollectionEmpty() {
        try {
            const count = await Attraction.countDocuments();
            return count === 0;
        } catch (error) {
            console.log("[SYNC] Error checking collection emptiness:", error.message);
            throw error;
        }
    }
}
