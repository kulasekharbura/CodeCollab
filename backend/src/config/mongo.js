import mongoose from "mongoose";
import { config } from "./env.js";

export const connectMongo = async () => {
  await mongoose.connect(config.mongoUri);
};

export const mongoStatus = () => mongoose.connection.readyState === 1;
