console.log("VibeBox script loaded");

/* ================= CONFIG ================= */
const S3_BASE = "https://vibebox-songs.s3.amazonaws.com";

/* ================= STATE ================= */
let albumsIndex = {};
let allSongs = [];
let songs = [];
let currentAlbum = null;
let currentIndex = 0;
let isMuted = false;
let lastVolume = 0.8;

const currentSong = new Audio();
currentSong.preload = "metadata";
currentSong.volume = lastVolume;

/* ================= UTILS ================= */
function formatTime(time) {
  if (!time || isNaN(time)) return "00:00";
  const m = Math.floor(time / 60);
  const s = Math.floor(time % 60);
  return `${m.toString().padStart(2, "0")}:${s.toString().padStart(2, "0")}`;
}

/* ================= IDLE / ACTIVE HELPERS ================= */
function setIdle() {
  const pb = document.querySelector(".playbar");
  if (!pb) return;
  pb.classList.add("idle");
  // CSS handles show/hide via .playbar.idle rules — just remove inline overrides
  const thumb = pb.querySelector(".playbar-thumb");
  const info  = pb.querySelector(".songinfo");
  const idle  = pb.querySelector(".idle-placeholder");
  if (thumb) thumb.style.removeProperty("display");
  if (info)  info.style.removeProperty("display");
  if (idle)  idle.style.removeProperty("display");
}

function setActive() {
  const pb = document.querySelector(".playbar");
  if (!pb) return;
  pb.classList.remove("idle");
  // CSS handles show/hide — just remove inline overrides
  const thumb = pb.querySelector(".playbar-thumb");
  const info  = pb.querySelector(".songinfo");
  const idle  = pb.querySelector(".idle-placeholder");
  if (thumb) thumb.style.removeProperty("display");
  if (info)  info.style.removeProperty("display");
  if (idle)  idle.style.removeProperty("display");
}

/* ================= LOAD ALBUMS ================= */
async function loadAlbums() {
  const container = document.querySelector(".cardcontainer");

  container.innerHTML = Array(6).fill(`
    <div class="skeleton-card">
      <div class="skeleton-img"></div>
      <div class="skeleton-title"></div>
      <div class="skeleton-sub"></div>
      <div class="skeleton-sub" style="width:60%;margin-top:4px"></div>
    </div>
  `).join("");

  let res;
  try {
    res = await fetch("songs-data.json");
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
  } catch (err) {
    container.innerHTML = `
      <div class="empty-state" style="grid-column:1/-1">
        <div class="empty-icon">⚠️</div>
        <div class="empty-title">Could not load albums</div>
        <div class="empty-sub">${err.message}</div>
      </div>`;
    return;
  }

  albumsIndex = await res.json();
  container.innerHTML = "";
  allSongs = [];

  for (const key of Object.keys(albumsIndex)) {
    const folder = albumsIndex[key].path;
    let info;
    try {
      const infoRes = await fetch(`${S3_BASE}/${folder}/info.json`);
      if (!infoRes.ok) continue;
      info = await infoRes.json();
    } catch { continue; }

    info.songs.forEach(song => {
      allSongs.push({ name: song.name, artist: song.artist, file: song.file, folder });
    });

    const card = document.createElement("div");
    card.className = "card";
    card.innerHTML = `
      <img src="${S3_BASE}/${folder}/${info.cover}" onerror="this.src='default-cover.jpg'">
      <h2>${info.title}</h2>
      <p>${info.description}</p>
    `;
    card.addEventListener("click", () => loadSongs(folder, info));
    container.appendChild(card);
  }
}

/* ================= LOAD SONG LIST ================= */
function loadSongs(folder, info) {
  currentAlbum = folder;
  songs = info.songs;
  currentIndex = 0;

  const desktopUL    = document.querySelector(".songlist ul");
  const mobileUL     = document.querySelector(".mobile-songlist ul");
  const mobileSonglist = document.querySelector(".mobile-songlist");
  const cardcontainer  = document.querySelector(".cardcontainer");

  desktopUL.innerHTML = "";
  mobileUL.innerHTML  = "";

  const oldBack = mobileSonglist.querySelector(".mobile-back-btn");
  if (oldBack) oldBack.remove();

  const backBtn = document.createElement("button");
  backBtn.className = "mobile-back-btn";
  backBtn.innerHTML = `<span class="back-arrow"></span> Back`;
  backBtn.addEventListener("click", () => {
    document.querySelector(".right").classList.remove("show-songs");
    cardcontainer.classList.remove("fade-out");
  });
  mobileSonglist.insertBefore(backBtn, mobileUL);

  songs.forEach((song, i) => {
    const html = `
      <li>
        <img class="invert" src="music.svg">
        <div class="info"><div>${song.name}</div><div>${song.artist}</div></div>
        <div class="playnow"><span>Play</span></div>
      </li>`;

    const liD = document.createElement("div");
    liD.innerHTML = html;
    liD.firstElementChild.addEventListener("click", () => playSong(i));
    desktopUL.appendChild(liD.firstElementChild);

    const liM = document.createElement("div");
    liM.innerHTML = html;
    liM.firstElementChild.addEventListener("click", () => playSong(i));
    mobileUL.appendChild(liM.firstElementChild);
  });

  // Only update playbar info if nothing is currently playing
  if (currentSong.paused) {
    updateSongInfo(0);
  }

  if (window.innerWidth <= 900) {
    cardcontainer.classList.add("fade-out");
    setTimeout(() => {
      document.querySelector(".right").classList.add("show-songs");
      mobileSonglist.classList.add("slide-in");
      setTimeout(() => mobileSonglist.classList.remove("slide-in"), 400);
    }, 300);
  }
}

/* ================= UPDATE INFO ONLY ================= */
function updateSongInfo(index) {
  if (!songs[index]) return;
  const song = songs[index];
  const titleEl  = document.querySelector(".songinfo-title");
  const artistEl = document.querySelector(".songinfo-artist");
  if (titleEl)  titleEl.textContent  = song.name;
  if (artistEl) artistEl.textContent = song.artist;
  playBtn.src = "play.svg";
}

/* ================= PLAY SONG ================= */
function playSong(index) {
  if (!songs[index]) return;

  currentIndex = index;
  const song = songs[index];
  const encodedFile = encodeURIComponent(song.file);

  currentSong.pause();
  currentSong.src = `${S3_BASE}/${currentAlbum}/${encodedFile}`;
  currentSong.currentTime = 0;

  // Update title + artist
  const titleEl  = document.querySelector(".songinfo-title");
  const artistEl = document.querySelector(".songinfo-artist");
  if (titleEl)  titleEl.textContent  = song.name;
  if (artistEl) artistEl.textContent = song.artist;

  // Load cover art
  const thumb = document.querySelector(".playbar-thumb");
  if (thumb) {
    fetch(`${S3_BASE}/${currentAlbum}/info.json`)
      .then(r => r.json())
      .then(info => {
        thumb.src = `${S3_BASE}/${currentAlbum}/${info.cover}`;
        thumb.onerror = () => { thumb.src = "default-cover.jpg"; };
      }).catch(() => { thumb.src = "default-cover.jpg"; });
  }

  // Show active playbar immediately
  setActive();

  // Reset seekbar fill
  const fill = document.querySelector(".seekbar-fill");
  if (fill) fill.style.width = "0%";

  // Now-playing indicators in song lists
  ["songlist ul li", ".mobile-songlist ul li"].forEach(sel => {
    document.querySelectorAll(sel).forEach((li, i) => {
      li.classList.remove("active-song");
      const icon = li.querySelector("img.invert");
      const bars = li.querySelector(".now-playing-bars");
      if (i === index) {
        li.classList.add("active-song");
        if (icon) icon.style.display = "none";
        if (!bars) {
          const b = document.createElement("div");
          b.className = "now-playing-bars";
          b.innerHTML = `<span></span><span></span><span></span><span></span>`;
          li.insertBefore(b, li.firstChild);
        }
      } else {
        if (icon) icon.style.display = "";
        if (bars) bars.remove();
      }
    });
  });

  currentSong.play().then(() => {
    playBtn.src = "pause.svg";
    if (thumb) thumb.classList.add("playing");
  }).catch(err => {
    if (err.name !== "AbortError") console.error(err);
    setIdle();
    playBtn.src = "play.svg";
  });
}

/* ================= CONTROLS ================= */
const playBtn = document.getElementById("play");
const nextBtn = document.getElementById("next");
const prevBtn = document.getElementById("prev");

playBtn.addEventListener("click", () => {
  if (!songs.length) return;
  const thumb = document.querySelector(".playbar-thumb");
  if (currentSong.paused) {
    setActive();
    currentSong.play();
    playBtn.src = "pause.svg";
    if (thumb) thumb.classList.add("playing");
  } else {
    currentSong.pause();
    playBtn.src = "play.svg";
    if (thumb) thumb.classList.remove("playing");
  }
});

nextBtn.addEventListener("click", () => { if (songs.length) playSong((currentIndex + 1) % songs.length); });
prevBtn.addEventListener("click", () => { if (songs.length) playSong((currentIndex - 1 + songs.length) % songs.length); });

currentSong.addEventListener("ended", () => {
  const next = (currentIndex + 1) % songs.length;
  if (songs.length && !(next === 0 && currentIndex === songs.length - 1)) {
    playSong(next);
  } else {
    setIdle();
    playBtn.src = "play.svg";
  }
});

/* ================= SEEK BAR ================= */
const seekbar = document.querySelector(".seekbar");
const circle  = document.querySelector(".circle");

seekbar.addEventListener("click", e => {
  if (!currentSong.duration) return;
  const rect = seekbar.getBoundingClientRect();
  const pct  = (e.clientX - rect.left) / rect.width;
  currentSong.currentTime = pct * currentSong.duration;
  const fill = document.querySelector(".seekbar-fill");
  if (fill) fill.style.width = `${pct * 100}%`;
});

currentSong.addEventListener("timeupdate", () => {
  const cur = currentSong.currentTime;
  const dur = currentSong.duration;
  document.querySelector(".songtime").textContent = `${formatTime(cur)} / ${formatTime(dur)}`;
  if (dur) {
    const pct = (cur / dur) * 100;
    circle.style.left = `${pct}%`;
    const fill = document.querySelector(".seekbar-fill");
    if (fill) fill.style.width = `${pct}%`;
  }
});

/* ================= VOLUME ================= */
const volumeIcon   = document.querySelector(".volume img");
const volumeSlider = document.querySelector(".volume input[type='range']");
volumeSlider.min = 0; volumeSlider.max = 1; volumeSlider.step = 0.01; volumeSlider.value = lastVolume;

volumeSlider.addEventListener("input", () => {
  const val = parseFloat(volumeSlider.value);
  currentSong.volume = val;
  lastVolume = val > 0 ? val : lastVolume;
  if (val === 0) { isMuted = true; currentSong.muted = true; volumeIcon.src = "mute.svg"; }
  else           { isMuted = false; currentSong.muted = false; volumeIcon.src = "volume.svg"; }
});

volumeIcon.addEventListener("click", () => {
  if (isMuted) {
    isMuted = false; currentSong.muted = false;
    currentSong.volume = lastVolume || 0.8;
    volumeSlider.value = currentSong.volume; volumeIcon.src = "volume.svg";
  } else {
    isMuted = true; lastVolume = currentSong.volume;
    currentSong.muted = true; volumeSlider.value = 0; volumeIcon.src = "mute.svg";
  }
});

/* ================= SEARCH ================= */
const searchBox     = document.getElementById("searchBox");
const searchResults = document.getElementById("searchResults");

searchBox.addEventListener("input", async () => {
  const q = searchBox.value.toLowerCase().trim();
  searchResults.innerHTML = "";
  if (!q) return;
  const matches = allSongs.filter(s => s.name.toLowerCase().includes(q) || s.artist.toLowerCase().includes(q));
  if (!matches.length) {
    searchResults.innerHTML = `<div class="empty-state"><div class="empty-icon">🎵</div><div class="empty-title">No songs found</div><div class="empty-sub">Try a different name</div></div>`;
    return;
  }
  matches.forEach(song => {
    const li = document.createElement("li");
    li.innerHTML = `<div class="search-song-title">${song.name}</div><div class="search-artist">${song.artist}</div>`;
    li.addEventListener("click", async () => {
      const res = await fetch(`${S3_BASE}/${song.folder}/info.json`);
      const info = await res.json();
      loadSongs(song.folder, info);
      playSong(info.songs.findIndex(s => s.file === song.file));
      searchResults.innerHTML = ""; searchBox.value = "";
    });
    searchResults.appendChild(li);
  });
});

/* ================= SEARCH PANEL TOGGLE ================= */
const openSearchBtn = document.getElementById("openSearch");
const closeSearchBtn = document.getElementById("closeSearch");
const searchPanel   = document.getElementById("leftSearchBox");
const overlay       = document.getElementById("overlay");

if (openSearchBtn)  openSearchBtn.addEventListener("click",  () => { searchPanel.classList.add("show"); overlay.classList.add("show"); searchBox.focus(); });
if (closeSearchBtn) closeSearchBtn.addEventListener("click", () => { searchPanel.classList.remove("show"); overlay.classList.remove("show"); });
if (overlay)        overlay.addEventListener("click",        () => { searchPanel.classList.remove("show"); overlay.classList.remove("show"); });

/* ================= BACK BUTTON ================= */
const backBtn = document.getElementById("backToAlbums");
if (backBtn) backBtn.addEventListener("click", () => document.querySelector(".right").classList.remove("show-songs"));

/* ================= SWIPE GESTURES ================= */
let touchStartX = 0, touchStartY = 0;
document.addEventListener("touchstart", e => { touchStartX = e.touches[0].clientX; touchStartY = e.touches[0].clientY; }, { passive: true });
document.addEventListener("touchend", e => {
  if (!songs.length) return;
  const dx = e.changedTouches[0].clientX - touchStartX;
  const dy = e.changedTouches[0].clientY - touchStartY;
  if (Math.abs(dx) > Math.abs(dy) && Math.abs(dx) > 60) {
    if (dx < 0) { playSong((currentIndex + 1) % songs.length); showSwipeFeedback("⏭ Next"); }
    else        { playSong((currentIndex - 1 + songs.length) % songs.length); showSwipeFeedback("⏮ Prev"); }
  }
}, { passive: true });

function showSwipeFeedback(label) {
  const old = document.getElementById("swipe-toast");
  if (old) old.remove();
  const toast = document.createElement("div");
  toast.id = "swipe-toast";
  toast.textContent = label;
  toast.style.cssText = "position:fixed;top:50%;left:50%;transform:translate(-50%,-50%);background:rgba(124,63,255,0.85);backdrop-filter:blur(10px);color:white;padding:12px 28px;border-radius:30px;font-size:16px;font-weight:700;letter-spacing:1px;z-index:99999;pointer-events:none;opacity:1;transition:opacity 0.4s ease;box-shadow:0 4px 20px rgba(124,63,255,0.5);";
  document.body.appendChild(toast);
  setTimeout(() => { toast.style.opacity = "0"; }, 800);
  setTimeout(() => { toast.remove(); }, 1200);
}

/* ================= INIT ================= */
playBtn.src = "play.svg";
setIdle();
loadAlbums();