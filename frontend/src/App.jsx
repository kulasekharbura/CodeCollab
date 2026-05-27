import { useEffect, useMemo, useRef, useState } from "react";
import Editor from "@monaco-editor/react";
import { io } from "socket.io-client";

const API_URL = import.meta.env.VITE_API_URL || "http://localhost:5000";
const SOCKET_URL = import.meta.env.VITE_SOCKET_URL || "http://localhost:5000";

const languages = ["javascript", "typescript", "python", "java", "cpp", "html", "css", "json"];

export default function App() {
  const [accessToken, setAccessToken] = useState(localStorage.getItem("accessToken") || "");
  const [refreshToken, setRefreshToken] = useState(localStorage.getItem("refreshToken") || "");
  const [email, setEmail] = useState("demo@codecollab.dev");
  const [password, setPassword] = useState("password123");
  const [displayName, setDisplayName] = useState("Demo User");
  const [roomId, setRoomId] = useState("");
  const [fileId, setFileId] = useState("");
  const [language, setLanguage] = useState("javascript");
  const [content, setContent] = useState("// Start collaborating\n");
  const [participants, setParticipants] = useState([]);
  const [status, setStatus] = useState("Disconnected");
  const [version, setVersion] = useState(0);

  const editorRef = useRef(null);
  const socket = useMemo(() => io(SOCKET_URL, { autoConnect: false, auth: { token: accessToken } }), [accessToken]);

  const persistTokens = (nextAccessToken, nextRefreshToken) => {
    if (nextAccessToken) {
      localStorage.setItem("accessToken", nextAccessToken);
      setAccessToken(nextAccessToken);
    }
    if (nextRefreshToken) {
      localStorage.setItem("refreshToken", nextRefreshToken);
      setRefreshToken(nextRefreshToken);
    }
  };

  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const oauthAccessToken = params.get("accessToken");
    const oauthRefreshToken = params.get("refreshToken");
    if (window.location.pathname === "/oauth/callback" && oauthAccessToken && oauthRefreshToken) {
      persistTokens(oauthAccessToken, oauthRefreshToken);
      window.history.replaceState({}, "", "/");
    }
  }, []);

  useEffect(() => {
    socket.auth = { token: accessToken };
    socket.connect();

    socket.on("connect", () => setStatus("Connected"));
    socket.on("disconnect", () => setStatus("Disconnected"));
    socket.on("room:state", (payload) => {
      setContent(payload.text || "");
      setLanguage(payload.language || "javascript");
      setParticipants(payload.users || []);
      setVersion(payload.version || 0);
    });
    socket.on("room:participants", (users) => setParticipants(users));
    socket.on("room:op", ({ op, sender, version: nextVersion }) => {
      if (sender === socket.id) {
        setVersion(nextVersion);
        return;
      }
      setContent((prev) => {
        if (op.type === "insert") return `${prev.slice(0, op.position)}${op.content}${prev.slice(op.position)}`;
        if (op.type === "delete") return `${prev.slice(0, op.position)}${prev.slice(op.position + op.length)}`;
        return prev;
      });
      setVersion(nextVersion);
    });
    socket.on("room:resync", ({ text, version: nextVersion }) => {
      setContent(text);
      setVersion(nextVersion);
    });
    socket.on("room:language", ({ language: nextLanguage }) => setLanguage(nextLanguage));

    return () => {
      socket.disconnect();
    };
  }, [socket, accessToken]);

  const auth = async (mode) => {
    const response = await fetch(`${API_URL}/auth/${mode}`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ email, password, displayName })
    });
    const data = await response.json();
    if (data.accessToken) persistTokens(data.accessToken, data.refreshToken);
  };

  const refreshAccessToken = async () => {
    if (!refreshToken) return;
    const response = await fetch(`${API_URL}/auth/refresh`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ refreshToken })
    });
    if (!response.ok) return;
    const data = await response.json();
    if (data.accessToken) persistTokens(data.accessToken);
  };

  const logout = async () => {
    await fetch(`${API_URL}/auth/logout`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ refreshToken })
    });
    localStorage.removeItem("accessToken");
    localStorage.removeItem("refreshToken");
    setAccessToken("");
    setRefreshToken("");
  };

  const createFileAndRoom = async () => {
    const fileResponse = await fetch(`${API_URL}/files`, {
      method: "POST",
      headers: { "Content-Type": "application/json", Authorization: `Bearer ${accessToken}` },
      body: JSON.stringify({ filename: "main.js", language, content })
    });
    const file = await fileResponse.json();
    setFileId(file._id);

    const roomResponse = await fetch(`${API_URL}/rooms`, {
      method: "POST",
      headers: { "Content-Type": "application/json", Authorization: `Bearer ${accessToken}` },
      body: JSON.stringify({ fileId: file._id })
    });
    const room = await roomResponse.json();
    setRoomId(room.roomId);
  };

  useEffect(() => {
    if (roomId) socket.emit("room:join", { roomId });
  }, [roomId, socket]);

  useEffect(() => {
    const autosave = setInterval(async () => {
      if (!fileId || !accessToken) return;
      await fetch(`${API_URL}/files/${fileId}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json", Authorization: `Bearer ${accessToken}` },
        body: JSON.stringify({ content, language })
      });
    }, 30000);

    const refreshInterval = setInterval(refreshAccessToken, 20 * 60 * 1000);

    return () => {
      clearInterval(autosave);
      clearInterval(refreshInterval);
    };
  }, [fileId, accessToken, content, language, refreshToken]);

  const onChange = (next = "") => {
    if (!editorRef.current || !roomId) return;
    const prev = content;
    setContent(next);

    const pos = editorRef.current.getPosition();
    const offset = editorRef.current.getModel().getOffsetAt(pos);

    if (next.length >= prev.length) {
      const inserted = next.slice(offset - (next.length - prev.length), offset);
      socket.emit("room:op", { roomId, baseVersion: version, op: { type: "insert", position: offset - inserted.length, content: inserted } });
    } else {
      socket.emit("room:op", { roomId, baseVersion: version, op: { type: "delete", position: offset, length: prev.length - next.length } });
    }
  };

  const onMount = (editor) => {
    editorRef.current = editor;
    editor.onDidChangeCursorPosition((e) => {
      socket.emit("room:cursor", {
        roomId,
        cursor: { lineNumber: e.position.lineNumber, column: e.position.column }
      });
    });
  };

  const onLanguageChange = (nextLanguage) => {
    setLanguage(nextLanguage);
    socket.emit("room:language", { roomId, language: nextLanguage });
  };

  return (
    <div className="app">
      <header>
        <h1>CodeCollab</h1>
        <span>{status}</span>
      </header>

      <section className="auth">
        <input value={email} onChange={(e) => setEmail(e.target.value)} placeholder="Email" />
        <input value={password} onChange={(e) => setPassword(e.target.value)} placeholder="Password" type="password" />
        <input value={displayName} onChange={(e) => setDisplayName(e.target.value)} placeholder="Display name" />
        <button onClick={() => auth("register")}>Sign Up</button>
        <button onClick={() => auth("login")}>Login</button>
        <button onClick={() => (window.location.href = `${API_URL}/auth/google`)}>Google Login</button>
        <button onClick={logout}>Logout</button>
      </section>

      <section className="toolbar">
        <select value={language} onChange={(e) => onLanguageChange(e.target.value)}>
          {languages.map((lang) => (
            <option key={lang} value={lang}>{lang}</option>
          ))}
        </select>
        <button onClick={createFileAndRoom}>New Room</button>
        <input value={roomId} onChange={(e) => setRoomId(e.target.value)} placeholder="Room ID" />
      </section>

      <section className="layout">
        <aside>
          <h3>Participants</h3>
          {participants.map((p) => (
            <div key={p.socketId}>
              <span style={{ color: p.color }}>{p.displayName}</span>
              {p.readOnly ? " (read-only)" : ""}
            </div>
          ))}
        </aside>
        <Editor height="70vh" language={language} value={content} onChange={onChange} onMount={onMount} theme="vs-dark" />
      </section>
    </div>
  );
}
