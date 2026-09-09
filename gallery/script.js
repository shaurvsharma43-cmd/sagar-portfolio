// ZOOM
const zoomModal = document.getElementById("zoomModal");
const zoomImg   = document.getElementById("zoomedImg");
const closeZoom = document.getElementById("closeZoom");

document.querySelectorAll(".zoom-img").forEach(img => {
  img.addEventListener("click", () => {
    zoomImg.src = img.src;
    zoomModal.style.display = "flex";
  });
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

