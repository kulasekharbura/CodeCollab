import { Server } from "socket.io";
import jwt from "jsonwebtoken";
import { Room } from "../models/Room.js";
import { CodeFile } from "../models/CodeFile.js";
import { config } from "../config/env.js";
import { transformOperation } from "../services/ot.js";

const roomState = new Map();
const participants = new Map();

const palette = ["#ef4444", "#f59e0b", "#10b981", "#3b82f6", "#8b5cf6", "#ec4899"];

export const attachSocket = (httpServer) => {
  const io = new Server(httpServer, {
    cors: { origin: config.frontendUrl, credentials: true }
  });

  io.use((socket, next) => {
    const token = socket.handshake.auth?.token;
    if (!token) {
      socket.user = { userId: `guest-${socket.id}`, displayName: "Guest", isGuest: true };
      return next();
    }
    try {
      socket.user = jwt.verify(token, config.jwtSecret);
      return next();
    } catch {
      return next(new Error("Unauthorized"));
    }
  });

  io.on("connection", (socket) => {
    socket.on("room:join", async ({ roomId }) => {
      const room = await Room.findOne({ roomId, isActive: true });
      if (!room) return socket.emit("room:error", { message: "Room not found" });

      const file = await CodeFile.findById(room.fileId);
      if (!file) return socket.emit("room:error", { message: "File not found" });

      const userColor = palette[Math.floor(Math.random() * palette.length)];
      const userInfo = {
        socketId: socket.id,
        userId: socket.user.userId,
        displayName: socket.user.displayName || "Guest",
        color: userColor,
        readOnly: Boolean(socket.user.isGuest)
      };

      participants.set(socket.id, userInfo);
      socket.join(roomId);

      if (!roomState.has(roomId)) {
        roomState.set(roomId, { text: file.content || "", version: 0, fileId: String(file._id), language: file.language });
      }

      const users = [...participants.values()].filter((u) => io.sockets.adapter.rooms.get(roomId)?.has(u.socketId));
      socket.emit("room:state", { ...roomState.get(roomId), users });
      io.to(roomId).emit("room:participants", users);
    });

    socket.on("room:op", async ({ roomId, op, baseVersion }) => {
      const state = roomState.get(roomId);
      const user = participants.get(socket.id);
      if (!state || !user || user.readOnly) return;

      if (typeof baseVersion === "number" && baseVersion !== state.version) {
        socket.emit("room:resync", { text: state.text, version: state.version });
        return;
      }

      state.text = transformOperation(state.text, op);
      state.version += 1;
      roomState.set(roomId, state);

      io.to(roomId).emit("room:op", { op, version: state.version, sender: socket.id });

      if (state.version % 10 === 0) {
        await CodeFile.findByIdAndUpdate(state.fileId, { $set: { content: state.text, language: state.language } });
      }
    });

    socket.on("room:language", ({ roomId, language }) => {
      const state = roomState.get(roomId);
      if (!state || !language) return;
      state.language = language;
      roomState.set(roomId, state);
      io.to(roomId).emit("room:language", { language });
    });

    socket.on("room:cursor", ({ roomId, cursor }) => {
      const user = participants.get(socket.id);
      if (!user) return;
      socket.to(roomId).emit("room:cursor", { socketId: socket.id, cursor, user });
    });

    socket.on("room:set-readonly", ({ roomId, targetSocketId, readOnly }) => {
      const actor = participants.get(socket.id);
      if (!actor) return;
      const target = participants.get(targetSocketId);
      if (!target) return;
      target.readOnly = Boolean(readOnly);
      participants.set(targetSocketId, target);
      io.to(roomId).emit("room:participants", [...participants.values()].filter((u) => io.sockets.adapter.rooms.get(roomId)?.has(u.socketId)));
    });

    socket.on("disconnect", () => {
      participants.delete(socket.id);
    });
  });
};
