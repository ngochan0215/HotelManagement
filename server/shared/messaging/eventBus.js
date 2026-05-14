import amqp from "amqplib";

const EXCHANGE_NAME = "events";

export class EventBus {
    constructor() {
        this.channel = null;
        /** Queue name chỉ dùng khi subscribe (consumer). Mỗi service có queue riêng. */
        this.queueName = null;
        /** Danh sách event (routing keys) bind vào queue của service này. */
        this.bindEvents = null;
    }

    /**
     * @param {Object} [options]
     * @param {string} [options.queueName] - Tên queue riêng của service (bắt buộc nếu subscribe)
     * @param {string[]} [options.bindEvents] - Các event service này lắng nghe (routing keys)
     */
    async connect(options = {}) {
        const url = process.env.RABBITMQ_URL || "amqp://guest:guest@localhost:5672";
        const maxAttempts = 5;
        const delayMs = 2000;
        let lastErr;
        
        for (let attempt = 1; attempt <= maxAttempts; attempt++) {
            try {
                const connection = await amqp.connect(url);
                this.channel = await connection.createChannel();
                await this.channel.assertExchange(EXCHANGE_NAME, "direct", { durable: true });

                // if (options.queueName && options.bindEvents && options.bindEvents.length > 0) {
                //     this.queueName = options.queueName;
                //     this.bindEvents = options.bindEvents;
                //     await this.channel.assertQueue(this.queueName, { durable: true });
                //     for (const event of this.bindEvents) {
                //         await this.channel.bindQueue(this.queueName, EXCHANGE_NAME, event);
                //     }
                //     console.log(`RabbitMQ connected (consumer queue: ${this.queueName}, events: ${this.bindEvents.join(", ")})`);
                // } else {
                //     console.log("RabbitMQ connected (publisher only)");
                // }
                if (options.queueName) {
                    this.queueName = options.queueName;
                    await this.channel.assertQueue(this.queueName, { durable: true });
                    
                    if (options.bindEvents && options.bindEvents.length > 0) {
                        this.bindEvents = options.bindEvents;
                        for (const event of options.bindEvents) {
                            await this.channel.bindQueue(this.queueName, EXCHANGE_NAME, event);
                        }
                        console.log(`RabbitMQ connected (consumer queue: ${this.queueName})`);
                    } else {
                        console.log(`RabbitMQ connected (queue ready, no events bound)`);
                    }
                } else {
                    console.log("RabbitMQ connected (publisher only)");
                }
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

        this.channel.publish(
            EXCHANGE_NAME,
            event,
            Buffer.from(JSON.stringify(message)),
            { persistent: true }
        );

        console.log(`Event published: ${event}`);
    }

    async subscribe(handler) {
        if (!this.channel || !this.queueName)
            throw new Error("EventBus not connected as consumer (connect with queueName and bindEvents)");

        this.channel.consume(this.queueName, async (msg) => {
            const message = JSON.parse(msg.content.toString());

            await handler(message, msg);

            this.channel.ack(msg);
        });
    }

    async safeRequest(event, data, fallback = null) {
        try {
            const reply = await this.request(event, data);
            return reply;
        } catch (err) {
            console.warn(`[CIRCUIT BREAKER] ${event} failed: ${err.message}`);
            return fallback ?? { success: false, message: `Service unavailable: ${event}` };
        }
    }

    async request(event, data, timeout = 5000) {
        if (!this.channel) {
            throw new Error("EventBus not connected!");
        }

        const correlationId = Math.random().toString(36).slice(2);
        const replyQueue = `reply.${correlationId}`;

        console.log(`[REQUEST] event: ${event}, correlationId: ${correlationId}`);

        // create a temporary queue, automatically deleted if unused
        await this.channel.assertQueue(replyQueue, {
            durable: false,
            exclusive: true,
            autoDelete: true
        });

        return new Promise((resolve, reject) => {
            const timer = setTimeout(() => {
                console.log(`[REQUEST] TIMEOUT — no reply received for event: ${event}, correlationId: ${correlationId}`);
                reject(new Error(`Request timeout: ${event}`));
            }, timeout);

            this.channel.consume(replyQueue, (msg) => {
                if (!msg) {
                    console.log(`[REQUEST] consume cancelled for ${replyQueue}`);
                    return;
                }
                console.log(`[REQUEST] reply received, correlationId: ${msg.properties.correlationId}`);
                clearTimeout(timer);
                const response = JSON.parse(msg.content.toString());
                this.channel.ack(msg);
                resolve(response);
            }, { noAck: false });

            // publish request with replyTo and correlationId
            const message = { event, data, timestamp: new Date() };
            console.log(`[REQUEST] publishing event: ${event}`);
            this.channel.publish(
                EXCHANGE_NAME,
                event,
                Buffer.from(JSON.stringify(message)),
                {
                    persistent: false,
                    replyTo: replyQueue,
                    correlationId
                }
            );
            console.log(`[REQUEST] published, waiting for reply...`);
        });
    }
}