// ZOOM
const zoomModal = document.getElementById("zoomModal");
const zoomImg   = document.getElementById("zoomedImg");
const closeZoom = document.getElementById("closeZoom");

// Delegated, so cards added later (from the admin panel) zoom too
document.addEventListener("click", (e) => {
  const img = e.target.closest(".zoom-img");
  if (!img) return;
  zoomImg.src = img.src;
  zoomModal.style.display = "flex";
});

closeZoom.addEventListener("click", () => {
  zoomModal.style.display = "none";
});

zoomModal.addEventListener("click", (e) => {
  if (e.target === zoomModal) {
    zoomModal.style.display = "none";
  }
});
// BUY POPUP
const buyModal = document.getElementById("buyModal");

function openBuy(e){
  if(e) e.stopPropagation();
  const bm = document.getElementById("buyModal");
  bm.style.display = "flex";
}

function closeBuy(){
  buyModal.style.display = "none";
}

// ESC to close both modals
document.addEventListener("keydown",e=>{
  if(e.key === "Escape"){
    zoomModal.style.display = "none";
    closeBuy();
  }
});

// PLAN ACTIONS
function buySingle(){
  window.location.href =
    "mailto:shaurvsharma43@gmail.com"
    + "?subject=" + encodeURIComponent("I need thumbnail")
    + "&body=" + encodeURIComponent(
      "Plan: Single Thumbnail\n\n" +
      "Channel link:\n" +
      "Video type / idea:\n" +
      "Reference thumbnail link:\n"
    );
}

function buyPack(){
  window.location.href =
    "mailto:shaurvsharma43@gmail.com"
    + "?subject=" + encodeURIComponent("I need thumbnail")
    + "&body=" + encodeURIComponent(
      "Plan: 5 Thumbnail Pack\n\n" +
      "Channel link:\n" +
      "Video types in pack:\n" +
      "Reference thumbnail links:\n"
    );
}

function buyMonthly(){
  const dm = confirm("DM on Instagram? (OK = Insta, Cancel = Email)");
  if(dm){
    window.location.href = "https://www.instagram.com/sagarplayz_official/";
  } else {
    window.location.href =
      "mailto:shaurvsharma43@gmail.com"
      + "?subject=" + encodeURIComponent("I need thumbnail")
      + "&body=" + encodeURIComponent(
        "Plan: Monthly Thumbnail Pack\n\n" +
        "Channel link:\n" +
        "Upload frequency (per week):\n" +
        "Content type:\n" +
        "Reference thumbnails:\n"
      );
  }
}

  // 🔒 Drag block (gallery + zoom)
  document.addEventListener('dragstart', e => {
    if (e.target.classList.contains('gallery-img') || e.target.tagName === 'IMG') {
      e.preventDefault();
    }
  });

  // 🔒 Right click block (gallery)
  document.addEventListener('contextmenu', e => {
    if (e.target.classList.contains('gallery-img')) {
      e.preventDefault();
    }
  });


// ==== LIVE CARDS: every image published from the admin panel becomes a new card ====
(async function () {
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
  const original = [...grid.children];   // your existing cards, shown after the new ones

  function makeCard(i) {
    const card = document.createElement("div");
    card.className = "card";

    const inner = document.createElement("div");
    inner.className = "card-inner";

    const img = document.createElement("img");
    img.src = i.data;
    img.alt = i.title || "";
    img.className = "gallery-img zoom-img";
    img.loading = "lazy";

    const meta = document.createElement("div");
    meta.className = "card-meta";

    const title = document.createElement("span");
    title.className = "card-title";
    title.textContent = i.title || "Untitled";

    meta.append(title);
    if (i.tag) {
      const tag = document.createElement("span");
      tag.className = "card-tag";
      tag.textContent = i.tag;
      meta.append(tag);
    }
    inner.append(img, meta);
    card.appendChild(inner);
    return card;
  }

  onSnapshot(query(collection(db, "images"), where("published", "==", true), where("section", "==", "gallery")), (snap) => {
    const fresh = snap.docs
      .map((d) => d.data())
      .sort((a, b) => (b.createdAt?.seconds ?? 0) - (a.createdAt?.seconds ?? 0))
      .map(makeCard);
    grid.replaceChildren(...fresh, ...original);
  });
})();
