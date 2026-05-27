import { getRedis } from "../config/redis.js";
import { sessionExists, verifyToken } from "../services/tokens.js";

export const authGuard = async (req, res, next) => {
  const header = req.headers.authorization || "";
  const token = header.startsWith("Bearer ") ? header.slice(7) : null;
  if (!token) return res.status(401).json({ message: "Missing token" });

  try {
    const payload = verifyToken(token);
    if (payload.type === "refresh") return res.status(401).json({ message: "Invalid token type" });

    const active = await sessionExists(getRedis(), payload.sid);
    if (!active) return res.status(401).json({ message: "Session expired" });

    req.user = payload;
    return next();
  } catch {
    return res.status(401).json({ message: "Invalid token" });
  }
};
