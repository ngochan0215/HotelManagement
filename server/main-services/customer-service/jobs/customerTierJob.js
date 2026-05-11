import cron from "node-cron";
import Customer from "../models/Customer.js";
import { container } from "../containers/container.js";

const startCronJob = ({ name, schedule, handler }) => {
  cron.schedule(schedule, async () => {
    try {
      console.log(`[CRON][customer] Checking ${name}...`);
      await handler();
      console.log(`[CRON][customer] DONE ${name}`);
    } catch (err) {
      console.error(`[CRON][customer] ${name} job error:`, err);
    }
  });
};

const updateAllCustomerTiers = async () => {
  const customers = await Customer.find({}).select("_id booking_count points loyalty");
  if (!customers.length) return;

  const bulkOps = [];
  for (const customer of customers) {
    const newTier = container.customerService.calculateMembershipTier({
      booking_count: customer.booking_count || 0,
      points: customer.points || 0,
    });

    if (newTier !== customer.loyalty) {
      bulkOps.push({
        updateOne: {
          filter: { _id: customer._id },
          update: { $set: { loyalty: newTier } },
        },
      });
    }
  }

  if (bulkOps.length) {
    await Customer.bulkWrite(bulkOps);
  }
};

export const startCustomerTierJob = () =>
  startCronJob({
    name: "customer tier update",
    schedule: "*/5 * * * *",
    handler: updateAllCustomerTiers,
  });
