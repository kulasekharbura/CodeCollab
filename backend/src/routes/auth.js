import { Router } from "express";
import bcrypt from "bcrypt";
import { User } from "../models/User.js";
import { config } from "../config/env.js";
import { getRedis } from "../config/redis.js";
import { createAccessToken, issueTokens, revokeSession, sessionExists, verifyToken } from "../services/tokens.js";

const router = Router();

const sanitize = (value = "") => String(value).trim();

router.post("/register", async (req, res) => {
  const email = sanitize(req.body.email).toLowerCase();
  const password = sanitize(req.body.password);
  const displayName = sanitize(req.body.displayName);

  if (!email || !password || !displayName) return res.status(400).json({ message: "Missing fields" });
  if (password.length < 8) return res.status(400).json({ message: "Password too short" });

  const existing = await User.findOne({ email });
  if (existing) return res.status(409).json({ message: "Email already exists" });

  const passwordHash = await bcrypt.hash(password, 12);
  const user = await User.create({ email, passwordHash, displayName, provider: "local" });
  const { accessToken, refreshToken } = await issueTokens(getRedis(), user);

  res.status(201).json({
    accessToken,
    refreshToken,
    user: { id: user._id, email: user.email, displayName: user.displayName }
  });
});

router.post("/login", async (req, res) => {
  const email = sanitize(req.body.email).toLowerCase();
  const password = sanitize(req.body.password);

  const user = await User.findOne({ email });
  if (!user || !user.passwordHash) return res.status(401).json({ message: "Invalid credentials" });

  const match = await bcrypt.compare(password, user.passwordHash);
  if (!match) return res.status(401).json({ message: "Invalid credentials" });

  const { accessToken, refreshToken } = await issueTokens(getRedis(), user);
  res.json({ accessToken, refreshToken, user: { id: user._id, email: user.email, displayName: user.displayName } });
});

router.post("/refresh", async (req, res) => {
  const refreshToken = sanitize(req.body.refreshToken);
  if (!refreshToken) return res.status(400).json({ message: "Missing refresh token" });

  try {
    const payload = verifyToken(refreshToken);
    if (payload.type !== "refresh") return res.status(401).json({ message: "Invalid refresh token" });

    const active = await sessionExists(getRedis(), payload.sid);
    if (!active) return res.status(401).json({ message: "Session expired" });

    const user = await User.findById(payload.userId);
    if (!user) return res.status(404).json({ message: "User not found" });

    const accessToken = createAccessToken(user, payload.sid);
    res.json({ accessToken });
  } catch {
    res.status(401).json({ message: "Invalid refresh token" });
  }
});

router.post("/logout", async (req, res) => {
  const token = sanitize(req.body.refreshToken || req.body.accessToken);
  if (!token) return res.json({ ok: true });

  try {
    const payload = verifyToken(token);
    await revokeSession(getRedis(), payload.sid);
    return res.json({ ok: true });
  } catch {
    return res.json({ ok: true });
  }
});

router.get("/google", (_req, res) => {
  if (!config.googleClientId || !config.googleClientSecret) {
    return res.status(503).json({ message: "Google OAuth is not configured" });
  }

  const redirectUri = `${config.backendUrl}/auth/google/callback`;
  const params = new URLSearchParams({
    client_id: config.googleClientId,
    redirect_uri: redirectUri,
    response_type: "code",
    scope: "openid email profile",
    access_type: "offline",
    prompt: "consent"
  });

  return res.redirect(`https://accounts.google.com/o/oauth2/v2/auth?${params.toString()}`);
});

router.get("/google/callback", async (req, res) => {
  const code = sanitize(req.query.code);
  if (!code) return res.status(400).json({ message: "Missing code" });

  if (!config.googleClientId || !config.googleClientSecret) {
    return res.status(503).json({ message: "Google OAuth is not configured" });
  }

  const redirectUri = `${config.backendUrl}/auth/google/callback`;

  try {
    const tokenResponse = await fetch("https://oauth2.googleapis.com/token", {
      method: "POST",
      headers: { "Content-Type": "application/x-www-form-urlencoded" },
      body: new URLSearchParams({
        code,
        client_id: config.googleClientId,
        client_secret: config.googleClientSecret,
        redirect_uri: redirectUri,
        grant_type: "authorization_code"
      })
    });

    const tokenData = await tokenResponse.json();
    const googleAccessToken = tokenData.access_token;
    if (!googleAccessToken) return res.status(401).json({ message: "Google token exchange failed" });

    const profileResponse = await fetch("https://www.googleapis.com/oauth2/v2/userinfo", {
      headers: { Authorization: `Bearer ${googleAccessToken}` }
    });
    const profile = await profileResponse.json();

    if (!profile.email) return res.status(401).json({ message: "Google profile missing email" });

    const user = await User.findOneAndUpdate(
      { email: profile.email.toLowerCase() },
      { $setOnInsert: { email: profile.email.toLowerCase(), displayName: profile.name || "Google User", provider: "google" } },
      { upsert: true, new: true }
    );

    const { accessToken, refreshToken } = await issueTokens(getRedis(), user);
    const redirectTo = `${config.frontendUrl}/oauth/callback?accessToken=${encodeURIComponent(accessToken)}&refreshToken=${encodeURIComponent(refreshToken)}`;
    return res.redirect(redirectTo);
  } catch {
    return res.status(500).json({ message: "Google OAuth failed" });
  }
});

export default router;
