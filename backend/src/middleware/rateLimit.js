import { getRedis } from "../config/redis.js";

const localCounters = new Map();

export const rateLimiter = async (req, res, next) => {
  const ip = req.ip;
  const key = `ratelimit:${ip}`;
  const redis = getRedis();

  try {
    if (redis) {
      const count = await redis.incr(key);
      if (count === 1) await redis.expire(key, 60);
      if (count > 100) return res.status(429).json({ message: "Too many requests" });
      return next();
    }
  } catch {
    // fall back to local
  }

  const now = Date.now();
  const current = localCounters.get(ip) || { count: 0, start: now };
  if (now - current.start > 60000) {
    current.count = 0;
    current.start = now;
  }
  current.count += 1;
  localCounters.set(ip, current);

  if (current.count > 100) return res.status(429).json({ message: "Too many requests" });
  return next();
};
