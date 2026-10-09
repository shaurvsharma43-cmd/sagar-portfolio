// ==== PREMIUM TOAST NOTIFICATIONS ====
const TOAST_ICONS = {
  success: "&#10003;",
  error: "&#10005;",
  warning: "&#33;",
  info: "&#8505;"
};

function showToast(opts) {
  const {
    type = "info",
    title = "",
    message = "",
    duration = 4200
  } = typeof opts === "string" ? { message: opts } : opts;

  const container = document.getElementById("toastContainer");
  if (!container) { window.alert(message || title); return; }

  const toast = document.createElement("div");
  toast.className = `toast toast-${type}`;

  toast.innerHTML = `
    <div class="toast-icon">${TOAST_ICONS[type] || TOAST_ICONS.info}</div>
    <div class="toast-body">
      ${title ? `<div class="toast-title">${title}</div>` : ""}
      ${message ? `<div class="toast-message">${message}</div>` : ""}
    </div>
    <button class="toast-close" aria-label="Dismiss">&times;</button>
    <div class="toast-progress" style="animation-duration:${duration}ms;"></div>
  `;

  container.appendChild(toast);

  let dismissed = false;
  const dismiss = () => {
    if (dismissed) return;
    dismissed = true;
    toast.classList.add("toast-out");
    setTimeout(() => toast.remove(), 320);
  };

  toast.querySelector(".toast-close").addEventListener("click", dismiss);
  const timer = setTimeout(dismiss, duration);
  toast.addEventListener("mouseenter", () => clearTimeout(timer));
}

// ==== YEAR + ZOOM MODAL ====
document.getElementById("year").textContent = new Date().getFullYear();

const modal     = document.getElementById("zoomModal");
const zoomedImg = document.getElementById("zoomedImg");
const closeZoom = document.getElementById("closeZoom");

// Delegated, so images added later (from the admin panel) zoom too
document.addEventListener("click", e => {
  const img = e.target.closest(".zoom-img");
  if (!img) return;
  zoomedImg.src = img.src;
  modal.style.display = "flex";
});

closeZoom.addEventListener("click", () => (modal.style.display = "none"));
modal.addEventListener("click", e => {
  if (e.target === modal) modal.style.display = "none";
});

const signInModal = document.getElementById("signInModal");
signInModal.addEventListener("click", e => {
  if (e.target === signInModal) closeSignInModal();
});


// ==== REVIEW CONFIG ====
const SCRIPT_URL = "https://script.google.com/macros/s/AKfycbz4AEokp4Lf-lj7KaGZum0ARPF9nqOBu5EcKkPwtRN0vXP8O6UhYS1n4v7lZOiDHDHR/exec";

// DEVICE ID (localStorage)
const DEVICE_KEY = "nsg_review_device_id_v1";
let DEVICE_ID = localStorage.getItem(DEVICE_KEY);
if (!DEVICE_ID) {
  if (window.crypto && crypto.randomUUID) {
    DEVICE_ID = crypto.randomUUID();
  } else {
    DEVICE_ID = Math.random().toString(36).slice(2) + Date.now();
  }
  localStorage.setItem(DEVICE_KEY, DEVICE_ID);
}

// SIMPLE FINGERPRINT (browser info)
function getFingerprint(){
  try {
    const nav = navigator || {};
    const scr = screen || {};
    const ua  = nav.userAgent || "";
    const lang = nav.language || "";
    const tz = (Intl && Intl.DateTimeFormat().resolvedOptions().timeZone) || "";
    const screenPart = (scr.width || "") + "x" + (scr.height || "") + "|" + (scr.colorDepth || "");
    const raw = ua + "|" + lang + "|" + tz + "|" + screenPart;

    let hash = 0;
    for (let i = 0; i < raw.length; i++) {
      hash = ((hash << 5) - hash) + raw.charCodeAt(i);
      hash |= 0;
    }
    return "fp_" + Math.abs(hash);
  } catch(e){
    return "fp_fallback";
  }
}

function esc(str) {
  return String(str || "")
    .replace(/&/g,"&amp;")
    .replace(/</g,"&lt;")
    .replace(/>/g,"&gt;");
}

// button loading on/off
function setReviewButtonLoading(isLoading) {
  const btn = document.getElementById("reviewBtn");
  if (!btn) return;
  if (isLoading) {
    btn.disabled = true;
    btn.innerText = "Submitting...";
  } else {
    btn.disabled = false;
    btn.innerText = "Submit Review";
  }
}

// SUBMIT REVIEW
function submitReview() {
  const name    = document.getElementById("r_name").value.trim();
  const rating  = document.getElementById("r_rating").value;
  const message = document.getElementById("r_message").value.trim();
  const email   = localStorage.getItem("userEmail");
  const fingerprint = getFingerprint();

  if (!email) {
    showToast({
      type: "warning",
      title: "Sign in required",
      message: "Please sign in to submit a review."
    });
    return;
  }

  if (!message) {
    showToast({
      type: "warning",
      title: "Review is empty",
      message: "Please write a few words before submitting your review."
    });
    return;
  }

  setReviewButtonLoading(true);

  fetch(SCRIPT_URL, {
    method: "POST",
    body: JSON.stringify({ name, email, rating, message, deviceId: DEVICE_ID, fingerprint })
  })
  .then(r => r.text())
  .then(text => {
    const resp = String(text || "").trim();
    if (resp === "SUCCESS") {
      document.getElementById("r_message").value = "";
      showToast({
        type: "success",
        title: "Review submitted",
        message: "Thank you for your feedback — it's now live."
      });
      loadReviews();
    } else if (resp === "ALREADY_REVIEWED") {
      showToast({
        type: "info",
        title: "Already reviewed",
        message: "A review from this email has already been submitted."
      });
    } else if (resp === "DUPLICATE_DEVICE") {
      showToast({
        type: "info",
        title: "Already reviewed",
        message: "A review has already been submitted from this device."
      });
    } else {
      console.log("Unexpected response:", resp);
      showToast({
        type: "error",
        title: "Something went wrong",
        message: "We couldn't save your review. Please try again."
      });
    }
  })
  .catch(err => {
    console.error("POST error:", err);
    showToast({
      type: "error",
      title: "Connection issue",
      message: "Network error — please check your connection and try again."
    });
  })
  .finally(() => {
    setReviewButtonLoading(false);
  });
}

// LOAD REVIEWS
let REVIEWS_CACHE = [];

function loadReviews() {
  fetch(SCRIPT_URL)
    .then(r => r.json())
    .then(data => {
      const list = Array.isArray(data) ? data.slice().reverse() : [];
      REVIEWS_CACHE = list;
      const currentEmail = localStorage.getItem("userEmail");

      let html = "";

      if (list.length === 0) {
        html = `<div class="reviews-empty">No reviews yet — be the first to leave one.</div>`;
      }

      list.forEach((r, idx) => {
        const canEdit = !!currentEmail && !!r.email && r.email === currentEmail;
        const initial = esc((r.name || "?").trim().charAt(0).toUpperCase() || "?");

        html += `
          <div class="review-card">
            <div class="review-card-top">
              <div class="review-avatar">${initial}</div>
              <div class="review-meta">
                <span class="review-name">${esc(r.name)}</span>
                <span class="review-stars">${"⭐".repeat(Number(r.rating) || 0)}</span>
              </div>
              ${canEdit ? `<button class="review-edit-btn" data-idx="${idx}">Edit</button>` : ""}
            </div>
            <p class="review-text">${esc(r.message)}</p>
          </div>
        `;
      });

      document.getElementById("reviewsList").innerHTML = html;

      document.querySelectorAll(".review-edit-btn").forEach(btn => {
        btn.addEventListener("click", () => {
          const r = REVIEWS_CACHE[Number(btn.getAttribute("data-idx"))];
          if (r) openEditPopup(r.name, r.message, r.rating, r.email);
        });
      });
    })
    .catch(err => {
      console.error("GET error:", err);
      document.getElementById("reviewsList").innerHTML = `<div class="reviews-error">There was a problem loading reviews.</div>`;
    });
}

loadReviews();


document.querySelectorAll("img").forEach(img => {
    img.setAttribute("draggable", "false");

    img.addEventListener("dragstart", e => e.preventDefault());

    img.addEventListener("contextmenu", e => e.preventDefault());

    img.style.userSelect = "none";
    img.style.webkitUserSelect = "none";
    img.style.webkitTouchCallout = "none";
});

// ==== GOOGLE LOGIN ====
const CLIENT_ID = "330326769652-h3hcdreqcbj6jo84c74n60bvicuuea3o.apps.googleusercontent.com";

window.onload = function() {
  if (window.google && google.accounts && google.accounts.id) {
    google.accounts.id.initialize({
      client_id: CLIENT_ID,
      callback: handleLogin
    });
  }

  const savedName = localStorage.getItem("userName");
  const savedPic  = localStorage.getItem("userPic");
  if (savedName && savedPic) {
    showUserUI({ name: savedName, picture: savedPic });
    const rName = document.getElementById("r_name");
    if (rName) {
      rName.value = savedName;
      rName.setAttribute("readonly", true);
    }
  }

};

// On login success
function handleLogin(response){
  const data = decodeJwt(response.credential);

  localStorage.setItem("userName", data.name);
  localStorage.setItem("userEmail", data.email);
  localStorage.setItem("userPic", data.picture);

  showUserUI(data);
  closeSignInModal();

  const rName = document.getElementById("r_name");
  if (rName) {
    rName.value = data.name;
    rName.setAttribute("readonly", true);
  }
}

// Sign in modal (multiple methods, Google only for now)
function openSignInModal(){
  document.getElementById("signInModal").style.display = "flex";
  if (window.google && google.accounts && google.accounts.id) {
    google.accounts.id.renderButton(
      document.getElementById("g_login_btn"),
      { theme: "outline", size: "medium", shape: "pill" }
    );
  }
}

const DISCORD_CLIENT_ID = "1546842719559884891";
const DISCORD_REDIRECT = window.location.origin;

document.getElementById("discordLogin").addEventListener("click", () => {
  const url =
    `https://discord.com/oauth2/authorize` +
    `?client_id=${DISCORD_CLIENT_ID}` +
    `&response_type=token` +
    `&redirect_uri=${encodeURIComponent(DISCORD_REDIRECT)}` +
    `&scope=identify%20email`;

  window.location.href = url;
});

function closeSignInModal(){
  document.getElementById("signInModal").style.display = "none";
}

// Show user info + logout btn
function showUserUI(data) {
  const userArea = document.getElementById("user_area");
  if (!userArea) return;

  const initial = (data.name || "?").trim().charAt(0).toUpperCase();

  userArea.innerHTML = `
    <div class="profile-trigger" onclick="toggleProfileMenu(event)">
      <img src="${data.picture}" 
           onerror="this.style.display='none';this.nextElementSibling.style.display='flex'"
           style="width:30px;height:30px;border-radius:50%;object-fit:cover;">
      <div style="display:none;width:30px;height:30px;border-radius:50%;
                  background:linear-gradient(135deg,#27e0ff,#ff3b6b);
                  align-items:center;justify-content:center;
                  font-size:12px;font-weight:700;color:#000;">
        ${initial}
      </div>
      <span style="font-size:13px;color:#fff;font-weight:500;">${data.name}</span>
      <span style="font-size:11px;color:#aaa;" id="profileChevron">▾</span>
    </div>

    <div id="profileMenu">
      <div style="padding:14px 14px 10px;border-bottom:1px solid rgba(255,255,255,0.07);
                  display:flex;align-items:center;gap:10px;">
        <img src="${data.picture}"
             onerror="this.style.display='none'"
             style="width:36px;height:36px;border-radius:50%;object-fit:cover;flex-shrink:0;">
        <div>
          <div style="font-size:13px;font-weight:600;color:#fff;">${data.name}</div>
          <div style="font-size:11px;color:#888;margin-top:2px;">${data.email || ""}</div>
        </div>
      </div>
      <a href="/dashboard/index.html" class="profile-menu-item">
        <span>📦</span> My Dashboard
      </a>
      <a href="/dashboard/index.html#orders" class="profile-menu-item">
        <span>🛍️</span> My Orders
      </a>
      <a href="/dashboard/index.html#profile" class="profile-menu-item">
        <span>👤</span> Profile
      </a>
      <div style="height:1px;background:rgba(255,255,255,0.07);margin:4px 0;"></div>
      <div class="profile-menu-item profile-logout" onclick="logout()">
        <span>🚪</span> Logout
      </div>
    </div>
  `;

  const trigger = document.getElementById("signInTriggerBtn");
  if (trigger) trigger.style.display = "none";
}

function toggleProfileMenu(e) {
  e.stopPropagation();
  const menu = document.getElementById("profileMenu");
  const chev = document.getElementById("profileChevron");
  const isOpen = menu.style.display === "block";
  menu.style.display = isOpen ? "none" : "block";
  chev.textContent = isOpen ? "▾" : "▴";
}

// close when clicking anywhere else
document.addEventListener("click", () => {
  const menu = document.getElementById("profileMenu");
  const chev = document.getElementById("profileChevron");
  if (menu) { menu.style.display = "none"; }
  if (chev) { chev.textContent = "▾"; }
});


document.addEventListener("keydown", function (e) {
    if (e.key === "F12") {
        e.preventDefault();
        return false;
    }
});


function logout(){
    localStorage.removeItem("userName");
    localStorage.removeItem("userEmail");
    localStorage.removeItem("userPic");

    location.reload();
}

// decode ID token
function decodeJwt(token){
  return JSON.parse(atob(token.split('.')[1]));
}

// ==== MONTHLY POPUP ====
function openMonthlyOptions(){
  document.getElementById("monthlyPopup").style.display = "flex";
}
function closeMonthlyOptions(){
  document.getElementById("monthlyPopup").style.display = "none";
}

// ==== EDIT REVIEW POPUP ====
let EDIT_EMAIL = "";
let EDIT_RATING = "";
let EDIT_NAME = "";

function openEditPopup(name, message, rating, email) {
  EDIT_EMAIL = email;
  EDIT_NAME = name;
  EDIT_RATING = rating;

  document.getElementById("edit_message").value = message;
  document.getElementById("editModal").style.display = "flex";
}

function closeEditPopup() {
  document.getElementById("editModal").style.display = "none";
}

function submitEditedReview() {
  const newMessage = document.getElementById("edit_message").value.trim();
  if (!newMessage) {
    return showToast({
      type: "warning",
      title: "Review is empty",
      message: "Your message can't be blank."
    });
  }

  fetch(SCRIPT_URL, {
    method: "POST",
    body: JSON.stringify({
      name: EDIT_NAME,
      email: EDIT_EMAIL,
      rating: EDIT_RATING,
      message: newMessage,
      deviceId: DEVICE_ID,
      fingerprint: getFingerprint(),
      mode: "EDIT"
    })
  })
  .then(r => r.text())
  .then(resp => {
    if (resp.includes("UPDATED")) {
      closeEditPopup();
      loadReviews();
      showToast({
        type: "success",
        title: "Review updated",
        message: "Your changes have been saved successfully."
      });
    } else {
      showToast({
        type: "error",
        title: "Update failed",
        message: "We couldn't update your review. Please try again."
      });
    }
  })
  .catch(err => {
    console.error("EDIT ERROR:", err);
    showToast({
      type: "error",
      title: "Update failed",
      message: "We couldn't update your review. Please try again."
    });
  });
}

window.openEditPopup = openEditPopup;
window.submitEditedReview = submitEditedReview;

async function discordAutoLogin() {
  const hash = new URLSearchParams(location.hash.substring(1));
  const token = hash.get("access_token");
  if (!token) return;

  const user = await fetch("https://discord.com/api/users/@me", {
    headers: { Authorization: `Bearer ${token}` }
  }).then(r => r.json());

  const data = {
    name: user.global_name || user.username,
    email: user.email,
    picture: `https://cdn.discordapp.com/avatars/${user.id}/${user.avatar}.png`
  };

  localStorage.setItem("userName", data.name);
  localStorage.setItem("userEmail", data.email);
  localStorage.setItem("userPic", data.picture);

  showUserUI(data);
  history.replaceState({}, "", location.pathname);
}

discordAutoLogin();
const DISCORD_USER_ID = "1249122290944446477";

async function updateDiscordPresence() {
  try {
    const res = await fetch(
      `https://api.lanyard.rest/v1/users/${DISCORD_USER_ID}`
    );

    const { data } = await res.json();

    const dot = document.getElementById("statusDot");
    const status = document.getElementById("discordStatus");
    const game = document.getElementById("discordGame");

    if (!dot) return;

    const colors = {
      online: "#22c55e",
      idle: "#f59e0b",
      dnd: "#ef4444",
      offline: "#6b7280"
    };

    const names = {
      online: "Online",
      idle: "Idle",
      dnd: "Do Not Disturb",
      offline: "Offline"
    };
   
    dot.style.background = colors[data.discord_status];
    dot.style.boxShadow = `0 0 12px ${colors[data.discord_status]}`;

    status.textContent = names[data.discord_status];
    const live = document.querySelector(".dc-live");
    if (data.discord_status === "offline") {
    live.style.display = "none";
    } else {
     live.style.display = "block";
    }
    const activity = data.activities.find(a => a.type === 0);
    game.textContent = activity
      ? `Playing ${activity.name}`
      : "Not playing anything";
  
  } catch {
    document.getElementById("discordStatus").textContent = "Unavailable";
    document.getElementById("discordGame").textContent = "Couldn't connect";
  }
}
   
updateDiscordPresence();
setInterval(updateDiscordPresence, 15000);

// ==== PRELOADER ====
(function(){
  var loaderEl = document.getElementById('siteLoader');
  if (!loaderEl) return;

  var barFill = document.getElementById('ldrBarFill');
  var pctText = document.getElementById('ldrPctText');
  var statusText = document.getElementById('ldrStatusText');
  var messages = ["Rendering pixels…", "Grading colors…", "Sharpening the hook…", "Almost live…"];
  var pct = 0, msgIndex = 0, realLoadDone = false;

  var tick = setInterval(function(){
    // creep toward 90% while waiting on real assets, then let finish() take it to 100
    var ceiling = realLoadDone ? 100 : 90;
    pct += Math.random() * 10 + 3;
    if (pct >= ceiling) pct = ceiling;

    barFill.style.width = pct + '%';
    pctText.textContent = Math.floor(pct) + '%';

    var newIndex = Math.min(messages.length - 1, Math.floor((pct / 100) * messages.length));
    if (newIndex !== msgIndex) {
      msgIndex = newIndex;
      statusText.textContent = messages[msgIndex];
    }

    if (pct >= 100) {
      clearInterval(tick);
      setTimeout(function(){ loaderEl.classList.add('ldr-done'); }, 300);
    }
  }, 180);

  window.addEventListener('load', function(){
    realLoadDone = true;
  });
})();

// ==== LIGHT SCROLL REVEAL ====
(function(){
  var targets = document.querySelectorAll("#services, #gallery, #process, #reviews, #contact");
  if (!targets.length) return;
  if (!("IntersectionObserver" in window) ||
      window.matchMedia("(prefers-reduced-motion: reduce)").matches) return;

  var io = new IntersectionObserver(function(entries){
    entries.forEach(function(entry){
      if (!entry.isIntersecting) return;
      entry.target.classList.add("in");
      io.unobserve(entry.target); // play once, then stop watching
    });
  }, { threshold: 0.08, rootMargin: "0px 0px -40px 0px" });

  targets.forEach(function(el){
    el.classList.add("rv");
    io.observe(el);
  });
})();

// ==== LIVE GALLERY: shows images published from the admin panel (Firebase) ====
(async function () {
  const MAX_ITEMS = 8;   // homepage shows this many; 0 = no limit

  const grid = document.querySelector(".gallery-grid");
  if (!grid) return;

  const { initializeApp } = await import("https://www.gstatic.com/firebasejs/10.12.2/firebase-app.js");
  const { getFirestore, collection, query, where, onSnapshot } =
    await import("https://www.gstatic.com/firebasejs/10.12.2/firebase-firestore.js");

  const app = initializeApp({
    apiKey: "AIzaSyDR0c9r785_Q14bCVQh1a1HEvyfxxOPBkQ",
    authDomain: "sagarthumbnailhub.firebaseapp.com",
    projectId: "sagarthumbnailhub",
    storageBucket: "sagarthumbnailhub.firebasestorage.app",
    messagingSenderId: "548631925900",
    appId: "1:548631925900:web:6ac9c298238bfdf7e717a9",
  });
  const db = getFirestore(app);
  const original = [...grid.children];   // your existing images, shown after the new ones

  onSnapshot(query(collection(db, "images"), where("published", "==", true), where("section", "==", "main")), (snap) => {
    const fresh = snap.docs
      .map((d) => d.data())
      .sort((a, b) => (b.createdAt?.seconds ?? 0) - (a.createdAt?.seconds ?? 0))
      .map((i) => {
        const item = document.createElement("div");
        item.className = "gallery-item";
        const img = document.createElement("img");
        img.src = i.data;
        img.alt = i.title || "";
        img.className = "zoom-img";
        item.appendChild(img);
        return item;
      });
    const all = [...fresh, ...original];
    grid.replaceChildren(...(MAX_ITEMS ? all.slice(0, MAX_ITEMS) : all));
  });
})();
