import express from "express";
import cors from "cors";
import helmet from "helmet";
import morgan from "morgan";
import http from "http";

import { config } from "./config/env.js";
import { connectMongo } from "./config/mongo.js";
import { initRedis } from "./config/redis.js";
import { logger } from "./services/logger.js";
import { rateLimiter } from "./middleware/rateLimit.js";
import authRoutes from "./routes/auth.js";
import fileRoutes from "./routes/files.js";
import roomRoutes from "./routes/rooms.js";
import healthRoutes from "./routes/health.js";
import { attachSocket } from "./socket/collaboration.js";

const app = express();

app.use(helmet());
app.use(cors({ origin: config.frontendUrl }));
app.use(express.json());
app.use(rateLimiter);
app.use(morgan("combined", { stream: { write: (msg) => logger.info(msg.trim()) } }));

app.use("/auth", authRoutes);
app.use("/files", fileRoutes);
app.use("/rooms", roomRoutes);
app.use("/health", healthRoutes);

app.get("/", (_req, res) => res.json({ message: "CodeCollab API" }));

const start = async () => {
  await connectMongo();
  initRedis();
  const server = http.createServer(app);
  attachSocket(server);

  server.listen(config.port, () => {
    logger.info(`Server listening on ${config.port}`);
  });
};

start().catch((error) => {
  logger.error(error.message);
  process.exit(1);
});
