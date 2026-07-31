// ==== YEAR + ZOOM MODAL ====
document.getElementById("year").textContent = new Date().getFullYear();

const modal     = document.getElementById("zoomModal");
const zoomedImg = document.getElementById("zoomedImg");
const closeZoom = document.getElementById("closeZoom");

document.querySelectorAll(".zoom-img").forEach(img => {
  img.addEventListener("click", () => {
    zoomedImg.src = img.src;
    modal.style.display = "flex";
  });
});

closeZoom.addEventListener("click", () => (modal.style.display = "none"));
modal.addEventListener("click", e => {
  if (e.target === modal) modal.style.display = "none";
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
    alert("Please login with Google to submit a review.");
    return;
  }

  if (!message) {
    alert("Please write a review!");
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
      alert("Thanks for your review!");
      loadReviews();
    } else if (resp === "ALREADY_REVIEWED") {
      alert("A review has already been submitted from this email.");
    } else if (resp === "DUPLICATE_DEVICE") {
      alert("A review has already been submitted from this device/fingerprint.");
    } else {
      console.log("Unexpected response:", resp);
      alert("There was a problem saving your review.");
    }
  })
  .catch(err => {
    console.error("POST error:", err);
    alert("Network error, please try again later.");
  })
  .finally(() => {
    setReviewButtonLoading(false);
  });
}

// LOAD REVIEWS
function loadReviews() {
  fetch(SCRIPT_URL)
    .then(r => r.json())
    .then(data => {
      let html = "";

      if (!Array.isArray(data) || data.length === 0) {
        html = `<div style="color:#aaa;font-size:13px;">No reviews yet.</div>`;
      }

      (Array.isArray(data) ? data.slice().reverse() : []).forEach(r => {

        html += `
          <div style="margin-bottom:12px;padding:12px 14px;background:#0b0f20;border-radius:12px;border:1px solid rgba(255,255,255,0.08);">
            <div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:4px;">
              <span style="font-size:13px;font-weight:600;">${esc(r.name)}</span>
              <span>
                ${"⭐".repeat(Number(r.rating) || 0)}
              </span>
            </div>
            <div style="font-size:13px;color:#ddd;">
              ${esc(r.message)}
            </div>
          </div>
        `;
      });

      document.getElementById("reviewsList").innerHTML = html;
    })
    .catch(err => {
      console.error("GET error:", err);
      document.getElementById("reviewsList").innerHTML = `<div style="color:#aaa;font-size:13px;">There was a problem loading reviews.</div>`;
    });
}

loadReviews();


// ==== GOOGLE LOGIN ====
const CLIENT_ID = "330326769652-h3hcdreqcbj6jo84c74n60bvicuuea3o.apps.googleusercontent.com";

window.onload = function() {
  if (window.google && google.accounts && google.accounts.id) {
    google.accounts.id.initialize({
      client_id: CLIENT_ID,
      callback: handleLogin
    });

    google.accounts.id.renderButton(
      document.getElementById("g_login_btn"),
      { theme: "outline", size: "medium", shape:"pill" }
    );
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

  // scroll reveal
  const revealItems = document.querySelectorAll(".reveal");
  const observer = new IntersectionObserver((entries) => {
    entries.forEach(entry => {
      if (entry.isIntersecting) {
        entry.target.classList.add("active");
      } else {
        entry.target.classList.remove("active");
      }
    });
  }, { threshold: 0.20 });
  revealItems.forEach(el => observer.observe(el));
};

// On login success
function handleLogin(response){
  const data = decodeJwt(response.credential);

  localStorage.setItem("userName", data.name);
  localStorage.setItem("userEmail", data.email);
  localStorage.setItem("userPic", data.picture);

  showUserUI(data);

  const rName = document.getElementById("r_name");
  if (rName) {
    rName.value = data.name;
    rName.setAttribute("readonly", true);
  }
}

// Show user info + logout btn
function showUserUI(data){
  const userArea = document.getElementById("user_area");
  if (!userArea) return;
  userArea.innerHTML = `
    <img src="${data.picture}" style="width:32px;height:32px;border-radius:50%;object-fit:cover;">
    <span style="font-size:13px;">${data.name}</span>
    <button onclick="logout()" style="border:none;background:#ff3b6b;color:#fff;padding:4px 10px;border-radius:20px;cursor:pointer;font-size:11px;">
      Logout
    </button>
  `;
}

// Logout
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
  if (!newMessage) return alert("Message cannot be empty.");

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
      alert("Review updated successfully! 🎉");
    } else {
      alert("Error updating review.");
    }
  })
  .catch(err => {
    console.error("EDIT ERROR:", err);
    alert("Error updating review.");
  });
}

window.openEditPopup = openEditPopup;
window.submitEditedReview = submitEditedReview;
