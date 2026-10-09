import crypto from "crypto";
import { serialize } from "cookie";

// Rate limiting in-memory map for basic DDoS/spam prevention
const IP_RATE_LIMIT = new Map();
const RATE_LIMIT_WINDOW_MS = 60 * 1000; // 1 minute
const MAX_REQUESTS_PER_WINDOW = 20;

function checkRateLimit(ip) {
  const now = Date.now();
  const entry = IP_RATE_LIMIT.get(ip) || { count: 0, startTime: now };
  if (now - entry.startTime > RATE_LIMIT_WINDOW_MS) {
    entry.count = 1;
    entry.startTime = now;
  } else {
    entry.count++;
  }
  IP_RATE_LIMIT.set(ip, entry);

  // Periodic cleanup
  if (IP_RATE_LIMIT.size > 1000) {
    for (const [k, v] of IP_RATE_LIMIT.entries()) {
      if (now - v.startTime > RATE_LIMIT_WINDOW_MS) IP_RATE_LIMIT.delete(k);
    }
  }

  return entry.count <= MAX_REQUESTS_PER_WINDOW;
}

function signState(payload, secret) {
  const hmac = crypto.createHmac("sha256", secret);
  hmac.update(payload);
  const signature = hmac.digest("hex");
  return `${payload}.${signature}`;
}

export default async function handler(req, res) {
  if (req.method !== "GET") {
    res.setHeader("Allow", ["GET"]);
    return res.status(455).json({ error: "Method not allowed" });
  }

  const clientIp = req.headers["x-forwarded-for"] || req.socket?.remoteAddress || "unknown";
  if (!checkRateLimit(clientIp)) {
    return res.status(429).json({ error: "Too many requests. Please try again in a minute." });
  }

  const clientId = process.env.DISCORD_CLIENT_ID;
  const redirectUri = process.env.DISCORD_REDIRECT_URI;
  const stateSecret = process.env.DISCORD_STATE_SECRET || process.env.DISCORD_CLIENT_SECRET;

  if (!clientId || !redirectUri || !stateSecret) {
    console.error("Missing Discord OAuth environment configuration.");
    return res.status(500).json({ error: "Discord OAuth is not configured on this server." });
  }

  // Validate redirect_to query param to prevent open redirect vulnerabilities
  let redirectTo = "/";
  if (req.query.redirect_to && typeof req.query.redirect_to === "string") {
    const rawRedirect = req.query.redirect_to.trim();
    // Only allow safe relative paths on this website
    if (rawRedirect.startsWith("/") && !rawRedirect.startsWith("//") && !rawRedirect.includes("\\")) {
      redirectTo = rawRedirect;
    }
  }

  // Generate cryptographically random nonce
  const nonce = crypto.randomBytes(24).toString("hex");
  const timestamp = Date.now();
  const rawPayload = Buffer.from(JSON.stringify({ nonce, timestamp, redirectTo })).toString("base64url");
  const signedState = signState(rawPayload, stateSecret);

  // Set secure cookie storing signed state (10 minute expiry)
  const isProd = process.env.NODE_ENV === "production" || redirectUri.startsWith("https://");
  const stateCookie = serialize("nsg_discord_state", signedState, {
    httpOnly: true,
    secure: isProd,
    sameSite: "lax",
    path: "/",
    maxAge: 600 // 10 minutes
  });

  res.setHeader("Set-Cookie", stateCookie);

  const discordAuthUrl = new URL("https://discord.com/oauth2/authorize");
  discordAuthUrl.searchParams.set("client_id", clientId);
  discordAuthUrl.searchParams.set("redirect_uri", redirectUri);
  discordAuthUrl.searchParams.set("response_type", "code");
  discordAuthUrl.searchParams.set("scope", "identify email");
  discordAuthUrl.searchParams.set("state", signedState);
  discordAuthUrl.searchParams.set("prompt", "consent");

  // Redirect to Discord OAuth authorize page
  res.writeHead(302, { Location: discordAuthUrl.toString() });
  res.end();
}
