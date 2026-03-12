import { getChannel } from "../../shared/messaging/rabbitmq.js";
import Customer from "../models/Customer.js";

const QUEUE = "user_events";

export const consumeUserEvents = async () => {
  const channel = getChannel();

  await channel.assertQueue(QUEUE, { durable: true });

  channel.consume(QUEUE, async (msg) => {
    const event = JSON.parse(msg.content.toString());

    if (event.event === "USER_CREATED") {
      const { userId, customer } = event.data;

      console.log("Received USER_CREATED event");

      await Customer.create({
        user_id: userId,
        ...customer
      });
    }

    channel.ack(msg);
  });
};