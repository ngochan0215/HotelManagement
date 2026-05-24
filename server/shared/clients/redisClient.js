import { createClient } from "redis";

let client = null;

export const redisCache = {
    async connect(url) {
        client = createClient({ url: url || "redis://localhost:6379" });
        client.on("error", (err) => console.error("Redis error:", err));
        await client.connect();
        console.log("Redis connected.");
    },

    async get(key) {
        try {
            if (!client) return null;
            return await client.get(key);
        } catch (err) {
            console.error(`Redis get error [${key}]:`, err.message);
            return null;
        }
    },

    async set(key, value, ttlSeconds) {
        try {
            if (!client) return;
            await client.setEx(key, ttlSeconds, value);
        } catch (err) {
            console.error(`Redis set error [${key}]:`, err.message);
        }
    },

    async del(key) {
        try {
            if (!client) return;
            if (Array.isArray(key)) {
                if (key.length === 0) return;
                await client.del(key);
            } else {
                await client.del(key);
            }
        } catch (err) {
            console.error(`Redis del error:`, err.message);
        }
    },

    async delByPattern(pattern) {
        try {
            if (!client) return;
            let cursor = 0;
            do {
                const result = await client.scan(cursor, { MATCH: pattern, COUNT: 100 });
                cursor = result.cursor;
                if (result.keys.length > 0) {
                    await client.del(result.keys);
                }
            } while (cursor !== 0);
        } catch (err) {
            console.error(`Redis delByPattern error [${pattern}]:`, err.message);
        }
    },
};
