import amqp from "amqplib";

export class EventBus {
    constructor() {
        this.channel = null;
        this.queue = "events";
    }

    async connect() {
        const url = process.env.RABBITMQ_URL || "amqp://guest:guest@localhost:5672";
        const maxAttempts = 5;
        const delayMs = 2000;
        let lastErr;
        for (let attempt = 1; attempt <= maxAttempts; attempt++) {
            try {
                const connection = await amqp.connect(url);
                this.channel = await connection.createChannel();
                await this.channel.assertQueue(this.queue, { durable: true });
                console.log("RabbitMQ connected");
                return;
            } catch (err) {
                lastErr = err;
                if (attempt === maxAttempts) break;
                await new Promise(r => setTimeout(r, delayMs));
            }
        }
        console.error("RabbitMQ connection failed:", lastErr?.message || lastErr);
        throw lastErr;
    }

    async publish(event, data) {
        if (!this.channel) 
            throw new Error("EventBus not connected");

        const message = {
            event,
            data,
            timestamp: new Date()
        };

        this.channel.sendToQueue(
            this.queue,
            Buffer.from(JSON.stringify(message)),
            { persistent: true }
        );

        console.log(`Event published: ${event}`);
    }

    async subscribe(handler) {
        if (!this.channel) 
            throw new Error("EventBus not connected");

        this.channel.consume(this.queue, async (msg) => {
            const message = JSON.parse(msg.content.toString());

            await handler(message);

            this.channel.ack(msg);
        });
    }
}