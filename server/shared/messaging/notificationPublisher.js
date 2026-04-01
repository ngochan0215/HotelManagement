import { createClient } from "redis";

let publisher = null;

async function getPublisher() {
    if (!publisher) {
        publisher = createClient({ url: process.env.REDIS_URL });
        publisher.on("error", (err) => console.error("Redis publisher error: ", err));
        await publisher.connect();
    }
    return publisher;
}

export async function sendNotification({ userId, title, content, type, kind, refId }) {
    const pub = await getPublisher();
    await pub.publish(
        "notifications",
        JSON.stringify({ userId, title, content, type, kind, refId })
    );
}

export async function sendNotificationsToUsers({ userIds, title, content, type, kind, refId }) {
    const pub = await getPublisher();
    await pub.publish(
        "notifications",
        JSON.stringify({ userIds, title, content, type, kind, refId })
    );
}