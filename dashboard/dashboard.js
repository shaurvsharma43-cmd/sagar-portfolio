import {
  auth,
  db,
  googleProvider,
  onAuthStateChanged,
  signInWithPopup,
  signOut,
  collection,
  doc,
  getDoc,
  setDoc,
  updateDoc,
  query,
  where,
  onSnapshot,
  serverTimestamp
} from "./firebase-config.js";

// DOM Elements
const gateEl = document.getElementById("gate");
const dashWrapEl = document.getElementById("dashWrap");
const sbNameEl = document.getElementById("sb-name");
const sbPicEl = document.getElementById("sb-pic");
const pPicEl = document.getElementById("p-pic");
const pNameEl = document.getElementById("p-name");
const pEmailEl = document.getElementById("p-email");
const pYtEl = document.getElementById("p-yt");
const pSaveYtBtn = document.getElementById("p-save-yt");
const pYtStatus = document.getElementById("p-yt-status");

const sTotalEl = document.getElementById("s-total");
const sProgressEl = document.getElementById("s-progress");
const sDoneEl = document.getElementById("s-done");
const ordersListEl = document.getElementById("orders-list");
const notifListEl = document.getElementById("notif-list");

// Active unsubscribe references for realtime listeners
let unsubscribeOrders = null;
let unsubscribeNotifs = null;
let unsubscribeUser = null;
let currentUser = null;

// Tab Navigation
window.nav = function(el, sectionId) {
  document.querySelectorAll(".nav-item").forEach(item => item.classList.remove("active"));
  document.querySelectorAll(".section").forEach(sec => sec.classList.remove("active"));
  if (el) el.classList.add("active");
  const targetSection = document.getElementById(sectionId);
  if (targetSection) targetSection.classList.add("active");
};

// Sign in with Google (via Firebase Auth)
window.handleGoogleSignIn = async function() {
  try {
    const result = await signInWithPopup(auth, googleProvider);
    console.log("Signed in successfully:", result.user.email);
  } catch (error) {
    console.error("Sign-in error:", error);
    alert(error.message || "Could not sign in with Google.");
  }
};

// Sign in with Discord (Serverless OAuth Bridge)
window.handleDiscordSignIn = function(redirectTo = "/dashboard/index.html") {
  const target = encodeURIComponent(redirectTo || "/dashboard/index.html");
  window.location.href = `https://sagar-portfolio-tau-nine.vercel.app/api/auth/discord/login?redirect_to=${target}`;
};

// Logout
window.handleLogout = async function() {
  try {
    if (unsubscribeOrders) { unsubscribeOrders(); unsubscribeOrders = null; }
    if (unsubscribeNotifs) { unsubscribeNotifs(); unsubscribeNotifs = null; }
    if (unsubscribeUser) { unsubscribeUser(); unsubscribeUser = null; }
    await signOut(auth);
  } catch (error) {
    console.error("Sign-out error:", error);
  }
};

// Auth State Observer
onAuthStateChanged(auth, async (user) => {
  if (user) {
    currentUser = user;
    showDashboardUI();
    await initUserProfile(user);
    subscribeToOrders(user.uid);
    subscribeToNotifications(user.uid);
  } else {
    currentUser = null;
    if (unsubscribeOrders) { unsubscribeOrders(); unsubscribeOrders = null; }
    if (unsubscribeNotifs) { unsubscribeNotifs(); unsubscribeNotifs = null; }
    if (unsubscribeUser) { unsubscribeUser(); unsubscribeUser = null; }
    showGateUI();
  }
});

function showGateUI() {
  if (gateEl) gateEl.style.display = "block";
  if (dashWrapEl) dashWrapEl.style.display = "none";
}

function showDashboardUI() {
  if (gateEl) gateEl.style.display = "none";
  if (dashWrapEl) dashWrapEl.style.display = "grid";

  // Check URL hash for direct tab navigation (e.g. #orders, #profile, #notifs)
  const hash = (window.location.hash || "").replace("#", "");
  if (hash && document.getElementById(hash)) {
    const navBtn = document.querySelector(`.nav-item[onclick*="${hash}"]`);
    if (navBtn) window.nav(navBtn, hash);
  }
}

window.addEventListener("hashchange", () => {
  const hash = (window.location.hash || "").replace("#", "");
  if (hash && document.getElementById(hash)) {
    const navBtn = document.querySelector(`.nav-item[onclick*="${hash}"]`);
    if (navBtn) window.nav(navBtn, hash);
  }
});

// User Profile Management
async function initUserProfile(user) {
  const userRef = doc(db, "users", user.uid);
  const userSnap = await getDoc(userRef);

  if (!userSnap.exists()) {
    // Create new user profile document
    await setDoc(userRef, {
      uid: user.uid,
      name: user.displayName || "Customer",
      email: user.email,
      photoURL: user.photoURL || "",
      youtubeChannel: "",
      role: "customer",
      createdAt: serverTimestamp(),
      updatedAt: serverTimestamp()
    });
  }

  // Realtime listener for profile updates
  unsubscribeUser = onSnapshot(userRef, (docSnap) => {
    if (docSnap.exists()) {
      const data = docSnap.data();
      const displayName = data.name || user.displayName || "Customer";
      const photo = data.photoURL || user.photoURL || "https://www.gravatar.com/avatar/?d=mp";
      const email = data.email || user.email || "";

      if (sbNameEl) sbNameEl.textContent = displayName;
      if (sbPicEl) sbPicEl.src = photo;
      if (pNameEl) pNameEl.value = displayName;
      if (pEmailEl) pEmailEl.value = email;
      if (pPicEl) pPicEl.src = photo;
      if (pYtEl && document.activeElement !== pYtEl) {
        pYtEl.value = data.youtubeChannel || "";
      }
    }
  });
}

// Save YouTube Channel URL
if (pSaveYtBtn) {
  pSaveYtBtn.addEventListener("click", async () => {
    if (!currentUser) return;
    const url = pYtEl ? pYtEl.value.trim() : "";
    pSaveYtBtn.disabled = true;
    pSaveYtBtn.textContent = "Saving...";
    if (pYtStatus) pYtStatus.textContent = "";

    try {
      const userRef = doc(db, "users", currentUser.uid);
      await updateDoc(userRef, {
        youtubeChannel: url,
        updatedAt: serverTimestamp()
      });
      if (pYtStatus) {
        pYtStatus.style.color = "#22c55e";
        pYtStatus.textContent = "✓ YouTube channel saved!";
        setTimeout(() => { pYtStatus.textContent = ""; }, 3000);
      }
    } catch (err) {
      console.error("Failed to update YouTube channel:", err);
      if (pYtStatus) {
        pYtStatus.style.color = "#ef4444";
        pYtStatus.textContent = "Failed to save. Please try again.";
      }
    } finally {
      pSaveYtBtn.disabled = false;
      pSaveYtBtn.textContent = "Save Changes";
    }
  });
}

// Realtime Orders Subscription
function subscribeToOrders(userId) {
  if (unsubscribeOrders) unsubscribeOrders();

  const ordersQuery = query(
    collection(db, "orders"),
    where("userId", "==", userId)
  );

  unsubscribeOrders = onSnapshot(ordersQuery, (snapshot) => {
    const orders = snapshot.docs.map(d => ({ id: d.id, ...d.data() }));

    // Sort by createdAt descending
    orders.sort((a, b) => {
      const timeA = a.createdAt?.seconds ?? (a.date?.seconds ?? 0);
      const timeB = b.createdAt?.seconds ?? (b.date?.seconds ?? 0);
      return timeB - timeA;
    });

    // Update Statistics
    const totalCount = orders.length;
    const inProgressCount = orders.filter(o => o.status === "In Progress").length;
    const doneCount = orders.filter(o => o.status === "Done").length;

    if (sTotalEl) sTotalEl.textContent = totalCount;
    if (sProgressEl) sProgressEl.textContent = inProgressCount;
    if (sDoneEl) sDoneEl.textContent = doneCount;

    // Render Orders
    if (!ordersListEl) return;

    if (orders.length === 0) {
      ordersListEl.innerHTML = `
        <div class="empty-state-box">
          <span class="empty-state-icon">📦</span>
          <p style="font-weight:600;color:#fff;margin-bottom:4px;">No Orders Yet</p>
          <p>You haven't placed any thumbnail orders yet. Choose a package to get started.</p>
          <a href="/buy/buy.html" class="empty-state-btn">Browse Thumbnail Packs →</a>
        </div>
      `;
      return;
    }

    ordersListEl.innerHTML = orders.map(order => {
      const status = order.status || "Pending";
      const statusClass = status === "Done" ? "done" : status === "In Progress" ? "progress" : "pending";
      
      const paymentStatus = order.paymentStatus || "Verification Pending";
      const paymentClass = paymentStatus === "Paid" ? "done" : paymentStatus === "Rejected" ? "rejected" : "pending";
      const paymentLabel = paymentStatus === "Paid" ? "✓ Paid" : paymentStatus === "Rejected" ? "✕ Payment Rejected" : "⏳ Verification Pending";

      let dateString = "—";
      const ts = order.createdAt || order.date;
      if (ts && ts.seconds) {
        dateString = new Date(ts.seconds * 1000).toLocaleDateString(undefined, {
          year: "numeric",
          month: "short",
          day: "numeric"
        });
      }

      const priceDisplay = order.price ? `₹${order.price} ${order.currency || "INR"}` : "—";
      const downloadBtn = (status === "Done" && order.downloadUrl)
        ? `<a href="${order.downloadUrl}" target="_blank" download rel="noopener noreferrer" class="btn-download-thumb">
              ⬇ Download Thumbnail
           </a>`
        : "";

      return `
        <div class="order-card">
          <div class="order-main-info">
            <div class="order-name">${escapeHtml(order.title || "Custom Thumbnail Order")}</div>
            <div class="order-meta-chips">
              <span class="meta-chip">🆔 #${order.id.slice(0, 8)}</span>
              <span class="meta-chip">📅 ${dateString}</span>
              <span class="meta-chip price">${priceDisplay}</span>
              ${order.utr ? `<span class="meta-chip utr">UTR: ${escapeHtml(order.utr)}</span>` : ""}
            </div>
            ${order.description ? `
              <div class="order-desc-box">
                <strong>Brief:</strong> ${escapeHtml(order.description)}
              </div>
            ` : ""}
          </div>
          <div class="order-badges-wrap">
            <span class="badge ${paymentClass}">
              ${paymentLabel}
            </span>
            <span class="badge ${statusClass}">
              ● ${status}
            </span>
            ${downloadBtn}
          </div>
        </div>
      `;
    }).join("");
  }, (err) => {
    console.error("Orders listener error:", err);
    if (ordersListEl) {
      ordersListEl.innerHTML = `<p style="color:#ef4444;font-size:13px;">Failed to load orders: ${err.message}</p>`;
    }
  });
}

// Realtime Notifications Subscription
function subscribeToNotifications(userId) {
  if (unsubscribeNotifs) unsubscribeNotifs();

  const notifQuery = query(
    collection(db, "notifications"),
    where("userId", "==", userId)
  );

  unsubscribeNotifs = onSnapshot(notifQuery, (snapshot) => {
    const notifs = snapshot.docs.map(d => ({ id: d.id, ...d.data() }));

    // Sort by createdAt descending
    notifs.sort((a, b) => {
      const timeA = a.createdAt?.seconds ?? 0;
      const timeB = b.createdAt?.seconds ?? 0;
      return timeB - timeA;
    });

    if (!notifListEl) return;

    if (notifs.length === 0) {
      notifListEl.innerHTML = `
        <div class="empty-state-box">
          <span class="empty-state-icon">🔔</span>
          <p style="font-weight:600;color:#fff;margin-bottom:4px;">No Notifications</p>
          <p>You're all caught up! Updates regarding your orders will appear here.</p>
        </div>
      `;
      return;
    }

    notifListEl.innerHTML = notifs.map(n => {
      let dateString = "";
      if (n.createdAt && n.createdAt.seconds) {
        dateString = new Date(n.createdAt.seconds * 1000).toLocaleString(undefined, {
          month: "short",
          day: "numeric",
          hour: "2-digit",
          minute: "2-digit"
        });
      }

      return `
        <div class="notif ${n.read ? '' : 'unread'}" id="notif-${n.id}">
          <div style="display:flex;justify-content:space-between;align-items:flex-start;gap:14px;">
            <div>
              <div class="n-title">${escapeHtml(n.message || "")}</div>
              <div class="n-time">🕒 ${dateString}</div>
            </div>
            ${!n.read ? `
              <button class="btn-mark-read" onclick="markNotificationRead('${n.id}')">
                Mark Read
              </button>
            ` : ""}
          </div>
        </div>
      `;
    }).join("");
  }, (err) => {
    console.error("Notifications listener error:", err);
    if (notifListEl) {
      notifListEl.innerHTML = `<p style="color:#ef4444;font-size:13px;">Failed to load notifications.</p>`;
    }
  });
}

// Mark Notification as Read
window.markNotificationRead = async function(notificationId) {
  if (!currentUser) return;
  try {
    const notifRef = doc(db, "notifications", notificationId);
    await updateDoc(notifRef, {
      read: true
    });
  } catch (err) {
    console.error("Failed to mark notification as read:", err);
  }
};

function escapeHtml(str) {
  return String(str || "")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#039;");
}
