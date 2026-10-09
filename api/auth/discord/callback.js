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

  // Handle escaped newlines in Vercel environment variables
  if (privateKey.includes("\\n")) {
    privateKey = privateKey.replace(/\\n/g, "\n");
  }

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
  res.setHeader("Content-Type", "text/html; charset=utf-8");

  if (errorMsg) {
    res.status(400).send(`<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <title>Discord Authentication Failed</title>
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <style>
    body { font-family: system-ui, sans-serif; background: #070914; color: #fff; display: flex; align-items: center; justify-content: center; min-height: 100vh; margin: 0; padding: 20px; }
    .box { background: #0e1124; border: 1px solid rgba(255,255,255,0.12); padding: 30px; border-radius: 16px; max-width: 400px; text-align: center; box-shadow: 0 10px 40px rgba(0,0,0,0.5); }
    h2 { color: #f43f5e; margin-top: 0; font-size: 20px; }
    p { color: #a9adc1; font-size: 14px; line-height: 1.5; }
    a { display: inline-block; margin-top: 20px; background: linear-gradient(90deg, #38bdf8, #f43f5e); color: #000; font-weight: 700; text-decoration: none; padding: 10px 24px; border-radius: 999px; }
  </style>
</head>
<body>
  <div class="box">
    <h2>Authentication Notice</h2>
    <p>${errorMsg.replace(/</g, "&lt;").replace(/>/g, "&gt;")}</p>
    <a href="${(redirectTo || "/").replace(/"/g, "&quot;")}">← Return to Site</a>
  </div>
</body>
</html>`);
    return;
  }

  // Success: Render client bridge that signs into Firebase Auth and redirects
  res.status(200).send(`<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <title>Completing Discord Sign-In...</title>
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <style>
    body { font-family: system-ui, sans-serif; background: #070914; color: #fff; display: flex; align-items: center; justify-content: center; min-height: 100vh; margin: 0; }
    .loader-box { text-align: center; }
    .spinner { width: 42px; height: 42px; border: 3px solid rgba(255,255,255,0.1); border-top-color: #5865F2; border-radius: 50%; animation: spin 0.8s linear infinite; margin: 0 auto 16px; }
    @keyframes spin { to { transform: rotate(360deg); } }
    h3 { font-size: 16px; font-weight: 600; margin: 0; }
    p { font-size: 13px; color: #888; margin-top: 6px; }
  </style>
</head>
<body>
  <div class="loader-box">
    <div class="spinner"></div>
    <h3>Signing into NotSagar Thumbnails…</h3>
    <p>Please wait a moment while your Discord session connects.</p>
  </div>

  <script type="module">
    import { auth } from "/dashboard/firebase-config.js";
    import { signInWithCustomToken } from "https://www.gstatic.com/firebasejs/10.12.2/firebase-auth.js";

    const customToken = ${JSON.stringify(customToken)};
    const targetUrl = ${JSON.stringify(redirectTo || "/")};

    try {
      await signInWithCustomToken(auth, customToken);
      window.location.replace(targetUrl);
    } catch (err) {
      console.error("Custom token sign-in error:", err);
      document.body.innerHTML = \`
        <div style="text-align:center;padding:20px;font-family:system-ui;color:#fff;background:#070914;">
          <h3 style="color:#ef4444;">Sign-in error</h3>
          <p style="color:#aaa;font-size:13px;">\${err.message || "Failed to complete authentication."}</p>
          <a href="\${targetUrl}" style="color:#27e0ff;font-size:13px;">← Return to site</a>
        </div>
      \`;
    }
  </script>
</body>
</html>`);
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
