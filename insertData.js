import { User } from "./models/index.js";
import mongoose from "mongoose";
import dotenv from "dotenv";
import bcrypt from "bcrypt";

dotenv.config();

await mongoose.connect(process.env.DB_URI);

// const hashedPassword = await bcrypt.hash("admin@01", 10);
// await User.create({ email: "admin@example.com", password: hashedPassword });
// const hashedPassword2 = await bcrypt.hash("employee@01", 10);
// await User.create({ email: "ngochan2005blislife@gmail.com", password: hashedPassword2});

console.log("Data inserted successfully!");

await mongoose.disconnect();
