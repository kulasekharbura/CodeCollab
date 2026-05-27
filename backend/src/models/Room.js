import mongoose from "mongoose";

const roomSchema = new mongoose.Schema(
  {
    roomId: { type: String, unique: true, required: true },
    fileId: { type: mongoose.Schema.Types.ObjectId, ref: "CodeFile", required: true },
    ownerId: { type: mongoose.Schema.Types.ObjectId, ref: "User", required: true },
    participants: { type: [String], default: [] },
    isActive: { type: Boolean, default: true }
  },
  { timestamps: true }
);

export const Room = mongoose.model("Room", roomSchema);
