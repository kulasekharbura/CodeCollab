import mongoose from "mongoose";

const codeFileSchema = new mongoose.Schema(
  {
    ownerId: { type: mongoose.Schema.Types.ObjectId, ref: "User", required: true },
    filename: { type: String, required: true },
    language: { type: String, required: true },
    content: { type: String, default: "" }
  },
  { timestamps: true }
);

export const CodeFile = mongoose.model("CodeFile", codeFileSchema);
