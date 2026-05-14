import { createClient } from "redis";

let client = null;

async function getClient() {
    if (!client) {
        client = createClient({ url: process.env.REDIS_URL });
        client.on("error", (err) => console.error("[CACHE] Redis error:", err));
        await client.connect();
    }
    return client;
}

export const cache = {
    async get(key) {
        try {
            const c = await getClient();
            const raw = await c.get(key);
            return raw ? JSON.parse(raw) : null;
        } catch (err) {
            console.warn("[CACHE] get error:", err.message);
            return null;
        }
    },

    async set(key, value, ttlSeconds = 300) {
        try {
            const c = await getClient();
            await c.set(key, JSON.stringify(value), { EX: ttlSeconds });
        } catch (err) {
            console.warn("[CACHE] set error:", err.message);
        }
    },

    async del(...keys) {
        try {
            const c = await getClient();
            if (keys.length) await c.del(keys);
        } catch (err) {
            console.warn("[CACHE] del error:", err.message);
        }
    },

    async delByPattern(pattern) {
        try {
            const c = await getClient();
            const keys = [];
            for await (const key of c.scanIterator({ MATCH: pattern, COUNT: 100 })) {
                keys.push(key);
            }
            if (keys.length) await c.del(keys);
        } catch (err) {
            console.warn("[CACHE] delByPattern error:", err.message);
        }
    },
};

export const makeCacheKey = (prefix, params) => {
    const sorted = Object.fromEntries(
        Object.entries(params)
            .filter(([, v]) => v !== undefined && v !== null && v !== "")
            .sort(([a], [b]) => a.localeCompare(b))
    );
    return `${prefix}:${JSON.stringify(sorted)}`;
};
