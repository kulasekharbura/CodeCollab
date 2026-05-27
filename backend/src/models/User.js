import mongoose from "mongoose";

const userSchema = new mongoose.Schema(
  {
    email: { type: String, unique: true, required: true },
    passwordHash: { type: String, default: null },
    displayName: { type: String, required: true },
    provider: { type: String, enum: ["local", "google"], default: "local" }
  },
  { timestamps: true }
);

export const User = mongoose.model("User", userSchema);
