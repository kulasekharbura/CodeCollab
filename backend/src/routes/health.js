import { Router } from "express";
import { mongoStatus } from "../config/mongo.js";
import { redisStatus } from "../config/redis.js";

const router = Router();
const startedAt = Date.now();

router.get("/", (_req, res) => {
  res.json({
    service: "codecollab-backend",
    uptime: Math.floor((Date.now() - startedAt) / 1000),
    mongo: mongoStatus() ? "up" : "down",
    redis: redisStatus() ? "up" : "degraded"
  });
});

export default router;
