import amqp from "amqplib";

let channel;

export const connectRabbitMQ = async () => {
    const url = process.env.RABBITMQ_URL || "amqp://guest:guest@rabbitmq:5672";
    const connection = await amqp.connect(url);
    channel = await connection.createChannel();
    return channel;
};

export const getChannel = () => {
    if (!channel) {
        throw new Error("RabbitMQ channel not initialized");
    }
    return channel;
};