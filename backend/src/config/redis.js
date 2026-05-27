import Redis from "ioredis";
import { config } from "./env.js";

let redis;
let degraded = false;

export const initRedis = () => {
  try {
    redis = new Redis(config.redisUrl, { maxRetriesPerRequest: 2 });
    redis.on("error", () => {
      degraded = true;
    });
    redis.on("ready", () => {
      degraded = false;
    });
  } catch {
    degraded = true;
  }
  return redis;
};

export const getRedis = () => redis;
export const redisStatus = () => Boolean(redis) && !degraded;
