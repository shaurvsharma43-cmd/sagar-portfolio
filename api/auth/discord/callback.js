import crypto from "crypto";
import { parse, serialize } from "cookie";
import admin from "firebase-admin";

// Initialize Firebase Admin SDK singleton with environment credentials
function getFirebaseAdmin() {
  if (admin.apps.length > 0) {
    return admin.app();
  }

  const projectId = process.env.FIREBASE_PROJECT_ID || "dashbord-fb096";
  const clientEmail = process.env.FIREBASE_CLIENT_EMAIL;
  let privateKey = process.env.FIREBASE_PRIVATE_KEY;

  if (!clientEmail || !privateKey) {
    throw new Error("Missing FIREBASE_CLIENT_EMAIL or FIREBASE_PRIVATE_KEY environment variables.");
  }

  // Normalize private key for various Vercel / environment formatting quirks
  privateKey = privateKey.trim();
  if (
    (privateKey.startsWith('"') && privateKey.endsWith('"')) ||
    (privateKey.startsWith("'") && privateKey.endsWith("'"))
  ) {
    privateKey = privateKey.slice(1, -1);
  }
  privateKey = privateKey.replace(/\\n/g, "\n").replace(/\r/g, "").trim();

  return admin.initializeApp({
    credential: admin.credential.cert({
      projectId,
      clientEmail,
      privateKey
    })
  });
}

function verifyState(signedState, secret) {
  if (!signedState || typeof signedState !== "string" || !signedState.includes(".")) {
    return null;
  }

  const [payload, signature] = signedState.split(".");
  const hmac = crypto.createHmac("sha256", secret);
  hmac.update(payload);
  const expectedSig = hmac.digest("hex");

  if (!crypto.timingSafeEqual(Buffer.from(signature, "hex"), Buffer.from(expectedSig, "hex"))) {
    return null;
  }

  try {
    const data = JSON.parse(Buffer.from(payload, "base64url").toString("utf8"));
    // State expires after 10 minutes (600,000 ms)
    if (Date.now() - data.timestamp > 600000) {
      return null;
    }
    return data;
  } catch {
    return null;
  }
}

function renderBridgeHtml(res, customToken, redirectTo, errorMsg = null) {
  const frontendOrigin = process.env.FRONTEND_URL || "https://notsagarthumbnailhub.bond";
  let cleanRedirect = redirectTo || "/";
  if (!cleanRedirect.startsWith("/")) cleanRedirect = "/" + cleanRedirect;

  if (errorMsg) {
    const targetUrl = new URL(cleanRedirect, frontendOrigin);
    targetUrl.hash = "__auth_err=" + encodeURIComponent(errorMsg);
    res.writeHead(302, { Location: targetUrl.toString() });
    return res.end();
  }

  // Success: Redirect back to frontend domain with custom token in URL hash fragment
  const targetUrl = new URL(cleanRedirect, frontendOrigin);
  targetUrl.hash = "__dt=" + encodeURIComponent(customToken);
  res.writeHead(302, { Location: targetUrl.toString() });
  return res.end();
}

export default async function handler(req, res) {
  if (req.method !== "GET") {
    res.setHeader("Allow", ["GET"]);
    return res.status(455).json({ error: "Method not allowed" });
  }

  const cookies = parse(req.headers.cookie || "");
  const stateCookie = cookies.nsg_discord_state;

  // Always clear the state cookie upon callback (single use)
  const isProd = process.env.NODE_ENV === "production" || process.env.DISCORD_REDIRECT_URI?.startsWith("https://");
  res.setHeader("Set-Cookie", serialize("nsg_discord_state", "", {
    httpOnly: true,
    secure: isProd,
    sameSite: "lax",
    path: "/",
    maxAge: 0
  }));

  const { code, state, error, error_description } = req.query;

  // Handle user cancellation in Discord OAuth window
  if (error) {
    const errorMsg = error === "access_denied"
      ? "Discord sign-in was cancelled by the user."
      : (error_description || "Discord authentication was declined.");
    return renderBridgeHtml(res, null, "/", errorMsg);
  }

  if (!code || !state || typeof code !== "string" || typeof state !== "string") {
    return renderBridgeHtml(res, null, "/", "Invalid or missing OAuth authorization parameters.");
  }

  const stateSecret = process.env.DISCORD_STATE_SECRET || process.env.DISCORD_CLIENT_SECRET;
  const stateData = verifyState(state, stateSecret);

  if (!stateData || state !== stateCookie) {
    return renderBridgeHtml(res, null, "/", "Invalid or expired session state (CSRF verification failed). Please try again.");
  }

  const redirectTo = stateData.redirectTo || "/";
  const clientId = process.env.DISCORD_CLIENT_ID;
  const clientSecret = process.env.DISCORD_CLIENT_SECRET;
  const redirectUri = process.env.DISCORD_REDIRECT_URI;

  if (!clientId || !clientSecret || !redirectUri) {
    return renderBridgeHtml(res, null, redirectTo, "Discord server environment is not configured.");
  }

  try {
    // 1. Exchange authorization code for Discord access token
    const tokenResponse = await fetch("https://discord.com/api/oauth2/token", {
      method: "POST",
      headers: { "Content-Type": "application/x-www-form-urlencoded" },
      body: new URLSearchParams({
        client_id: clientId,
        client_secret: clientSecret,
        grant_type: "authorization_code",
        code: code,
        redirect_uri: redirectUri
      })
    });

    if (!tokenResponse.ok) {
      const errText = await tokenResponse.text();
      console.error("Discord token exchange failed:", tokenResponse.status, errText);
      return renderBridgeHtml(res, null, redirectTo, "Failed to exchange Discord authorization code. Please try signing in again.");
    }

    const tokenData = await tokenResponse.json();
    const accessToken = tokenData.access_token;

    if (!accessToken) {
      return renderBridgeHtml(res, null, redirectTo, "Discord did not return an access token.");
    }

    // 2. Fetch Discord user profile
    const userResponse = await fetch("https://discord.com/api/users/@me", {
      headers: { Authorization: `Bearer ${accessToken}` }
    });

    if (!userResponse.ok) {
      console.error("Failed to fetch Discord user profile:", userResponse.status);
      return renderBridgeHtml(res, null, redirectTo, "Failed to retrieve Discord profile info.");
    }

    const discordUser = await userResponse.json();
    if (!discordUser || !discordUser.id) {
      return renderBridgeHtml(res, null, redirectTo, "Invalid Discord user response.");
    }

    // 3. Construct user metadata
    const discordUid = `discord:${discordUser.id}`;
    const displayName = discordUser.global_name || discordUser.username || "Discord Creator";
    const avatarUrl = discordUser.avatar
      ? `https://cdn.discordapp.com/avatars/${discordUser.id}/${discordUser.avatar}.png`
      : `https://cdn.discordapp.com/embed/avatars/${(parseInt(discordUser.id, 10) % 5) || 0}.png`;
    const email = discordUser.email || "";

    // 4. Initialize Firebase Admin and mint Firebase Custom Token
    const firebaseApp = getFirebaseAdmin();
    const customToken = await firebaseApp.auth().createCustomToken(discordUid, {
      provider: "discord",
      discordId: discordUser.id,
      email: email,
      name: displayName
    });

    // 5. Ensure/update user profile in Firestore (safe merge, preserve existing custom fields like youtubeChannel)
    try {
      const db = firebaseApp.firestore();
      const userDocRef = db.collection("users").doc(discordUid);
      const userDoc = await userDocRef.get();

      if (!userDoc.exists) {
        await userDocRef.set({
          uid: discordUid,
          name: displayName,
          email: email,
          photoURL: avatarUrl,
          youtubeChannel: "",
          role: "customer",
          createdAt: admin.firestore.FieldValue.serverTimestamp(),
          updatedAt: admin.firestore.FieldValue.serverTimestamp()
        });
      } else {
        // Update profile picture and name if changed, keeping role/createdAt/youtubeChannel intact
        await userDocRef.update({
          name: displayName,
          email: email || userDoc.data().email || "",
          photoURL: avatarUrl,
          updatedAt: admin.firestore.FieldValue.serverTimestamp()
        });
      }
    } catch (firestoreErr) {
      console.warn("Could not sync Firestore user profile on Discord login:", firestoreErr);
      // Non-fatal; client-side observer will also ensure profile
    }

    // 6. Return bridge HTML that signs into Firebase Auth and redirects
    return renderBridgeHtml(res, customToken, redirectTo);
  } catch (err) {
    console.error("Discord callback internal error:", err);
    return renderBridgeHtml(res, null, redirectTo, "An internal server error occurred while processing authentication.");
  }
}
