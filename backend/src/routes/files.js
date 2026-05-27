import { Router } from "express";
import { authGuard } from "../middleware/auth.js";
import { CodeFile } from "../models/CodeFile.js";

const router = Router();

router.use(authGuard);

router.post("/", async (req, res) => {
  const { filename, language, content = "" } = req.body;
  if (!filename || !language) return res.status(400).json({ message: "Missing fields" });

  const file = await CodeFile.create({ ownerId: req.user.userId, filename, language, content });
  res.status(201).json(file);
});

router.get("/", async (req, res) => {
  const files = await CodeFile.find({ ownerId: req.user.userId }).sort({ updatedAt: -1 });
  res.json(files);
});

router.get("/:id", async (req, res) => {
  const file = await CodeFile.findOne({ _id: req.params.id, ownerId: req.user.userId });
  if (!file) return res.status(404).json({ message: "Not found" });
  res.json(file);
});

router.put("/:id", async (req, res) => {
  const { content, filename, language } = req.body;
  const file = await CodeFile.findOneAndUpdate(
    { _id: req.params.id, ownerId: req.user.userId },
    { $set: { ...(content !== undefined && { content }), ...(filename && { filename }), ...(language && { language }) } },
    { new: true }
  );
  if (!file) return res.status(404).json({ message: "Not found" });
  res.json(file);
});

router.delete("/:id", async (req, res) => {
  const removed = await CodeFile.findOneAndDelete({ _id: req.params.id, ownerId: req.user.userId });
  if (!removed) return res.status(404).json({ message: "Not found" });
  res.status(204).send();
});

export default router;
