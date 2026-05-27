import { Router } from "express";
import { v4 as uuidv4 } from "uuid";
import { authGuard } from "../middleware/auth.js";
import { Room } from "../models/Room.js";
import { CodeFile } from "../models/CodeFile.js";

const router = Router();

router.post("/", authGuard, async (req, res) => {
  const { fileId } = req.body;
  const file = await CodeFile.findOne({ _id: fileId, ownerId: req.user.userId });
  if (!file) return res.status(404).json({ message: "File not found" });

  const room = await Room.create({ roomId: uuidv4(), fileId, ownerId: req.user.userId, isActive: true });
  res.status(201).json(room);
});

router.get("/:roomId", async (req, res) => {
  const room = await Room.findOne({ roomId: req.params.roomId }).populate("fileId");
  if (!room || !room.isActive) return res.status(404).json({ message: "Room not found" });
  res.json(room);
});

router.post("/:roomId/close", authGuard, async (req, res) => {
  const room = await Room.findOne({ roomId: req.params.roomId });
  if (!room) return res.status(404).json({ message: "Room not found" });
  if (String(room.ownerId) !== req.user.userId) return res.status(403).json({ message: "Not owner" });

  room.isActive = false;
  await room.save();
  res.json({ ok: true });
});

export default router;
