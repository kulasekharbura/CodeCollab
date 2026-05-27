import jwt from "jsonwebtoken";
import { v4 as uuidv4 } from "uuid";
import { config } from "../config/env.js";

const localSessions = new Map();

const buildPayload = (user, sid) => ({
  userId: String(user._id),
  email: user.email,
  displayName: user.displayName,
  sid
});

export const createAccessToken = (user, sid) => jwt.sign(buildPayload(user, sid), config.jwtSecret, { expiresIn: "24h" });

export const issueTokens = async (redis, user) => {
  const sid = uuidv4();
  const payload = buildPayload(user, sid);

  const accessToken = jwt.sign(payload, config.jwtSecret, { expiresIn: "24h" });
  const refreshToken = jwt.sign({ ...payload, type: "refresh" }, config.jwtSecret, { expiresIn: "7d" });

  const value = JSON.stringify({ userId: payload.userId, email: payload.email, displayName: payload.displayName });
  if (redis) {
    await redis.set(`session:${sid}`, value, "EX", 7 * 24 * 60 * 60);
  } else {
    localSessions.set(sid, value);
  }

  return { accessToken, refreshToken, sid };
};

export const verifyToken = (token) => jwt.verify(token, config.jwtSecret);

export const sessionExists = async (redis, sid) => {
  if (!sid) return false;
  if (redis) return Boolean(await redis.get(`session:${sid}`));
  return localSessions.has(sid);
};

export const revokeSession = async (redis, sid) => {
  if (!sid) return;
  if (redis) {
    await redis.del(`session:${sid}`);
  } else {
    localSessions.delete(sid);
  }
};
