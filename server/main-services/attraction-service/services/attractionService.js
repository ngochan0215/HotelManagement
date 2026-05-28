import mongoose from "../../../shared/config/mongoose.js";
import { cache, makeCacheKey } from "../../../shared/utils/cache.js";

export class AttractionService {
    constructor({ Attraction, syncService }) {
        this.Attraction = Attraction;
        this.syncService = syncService;
    }

    async getAllAttractions(query = {}) {
        const { category, max_distance, search, page = 1, limit = 20 } = query;

        const cacheKey = makeCacheKey("attraction:list", {
            category: category || null,
            max_distance: max_distance || null,
            search: search || null,
            page: Number(page),
            limit: Number(limit),
        });

        const cached = await cache.get(cacheKey);
        if (cached) return cached;

        const filter = { is_active: true };
        if (category) filter.category = category;
        if (max_distance) filter.distance_m = { $lte: Number(max_distance) };
        if (search) filter.name = { $regex: search, $options: "i" };

        const skip = (Number(page) - 1) * Number(limit);

        const [total, attractions] = await Promise.all([
            this.Attraction.countDocuments(filter),
            this.Attraction.find(filter)
                .sort({ rating: -1, distance_m: 1 })
                .skip(skip)
                .limit(Number(limit))
                .select("-__v -created_at -updated_at")
                .lean(),
        ]);

        const result = {
            total,
            page: Number(page),
            limit: Number(limit),
            attractions: attractions.map(a => this.formatAttraction(a)),
        };

        if (attractions.length > 0) {
            await cache.set(cacheKey, result, 3600);
        }
        return result;
    }

    async getAttractionById(id) {
        if (!mongoose.Types.ObjectId.isValid(id)) {
            throw Object.assign(new Error("ID không hợp lệ."), { status: 400 });
        }

        const cacheKey = `attraction:one:${id}`;
        const cached = await cache.get(cacheKey);
        if (cached) return cached;

        const attraction = await this.Attraction.findById(id)
            .select("-__v -created_at -updated_at")
            .lean();

        if (!attraction) {
            throw Object.assign(new Error("Không tìm thấy địa điểm."), { status: 404 });
        }

        const result = this.formatAttraction(attraction);
        await cache.set(cacheKey, result, 3600);
        return result;
    }

    async getAllAttractionsAdmin(query = {}) {
        const { category, is_active, page = 1, limit = 20 } = query;

        const filter = {};
        if (category) filter.category = category;
        if (is_active !== undefined) filter.is_active = is_active === "true";

        const skip = (Number(page) - 1) * Number(limit);

        const [total, attractions] = await Promise.all([
            this.Attraction.countDocuments(filter),
            this.Attraction.find(filter)
                .sort({ distance_m: 1 })
                .skip(skip)
                .limit(Number(limit))
                .select("-__v")
                .lean(),
        ]);

        return {
            total,
            page: Number(page),
            limit: Number(limit),
            attractions,
        };
    }

    async updateAttraction(id, payload) {
        if (!mongoose.Types.ObjectId.isValid(id)) {
            throw Object.assign(new Error("ID không hợp lệ."), { status: 400 });
        }

        const allowed = ["custom_description", "custom_image_url", "is_active", "name", "category"];
        const update = {};
        for (const key of allowed) {
            if (payload[key] !== undefined) update[key] = payload[key];
        }

        const attraction = await this.Attraction.findByIdAndUpdate(
            id,
            { $set: update },
            { new: true }
        );

        if (!attraction) {
            throw Object.assign(new Error("Không tìm thấy địa điểm."), { status: 404 });
        }

        await Promise.all([
            cache.del(`attraction:one:${id}`),
            cache.delByPattern("attraction:list:*"),
        ]);

        return attraction;
    }

    async triggerSync() {
        const result = await this.syncService.runFullSync();
        await cache.delByPattern("attraction:list:*");
        return result;
    }


    formatAttraction(a) {
        return {
            _id: a._id,
            xid: a.xid,
            name: a.name,
            category: a.category,
            kinds: a.kinds,
            description: a.custom_description || a.description,
            coordinates: a.coordinates,
            distance_km: Math.round(a.distance_m / 100) / 10,
            image_url: a.custom_image_url || a.image_url,
            wikipedia_url: a.wikipedia_url,
            rating: a.rating,
            last_synced: a.last_synced,
        };
    }
}
