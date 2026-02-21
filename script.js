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
let lastVolume = 0.8; // remember volume before mute

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

/* ================= LOAD ALBUMS ================= */
async function loadAlbums() {
  const container = document.querySelector(".cardcontainer");

  // Show 6 skeleton cards while loading
  container.innerHTML = Array(6).fill(`
    <div class="skeleton-card">
      <div class="skeleton-img"></div>
      <div class="skeleton-title"></div>
      <div class="skeleton-sub"></div>
      <div class="skeleton-sub" style="width:60%;margin-top:4px"></div>
    </div>
  `).join("");

  const res = await fetch("songs-data.json");
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
    } catch {
      console.warn("Skipping album:", folder);
      continue;
    }

    info.songs.forEach(song => {
      allSongs.push({
        name: song.name,
        artist: song.artist,
        file: song.file,
        folder
      });
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

  const desktopUL = document.querySelector(".songlist ul");
  const mobileUL = document.querySelector(".mobile-songlist ul");
  const mobileSonglist = document.querySelector(".mobile-songlist");
  const cardcontainer = document.querySelector(".cardcontainer");

  desktopUL.innerHTML = "";
  mobileUL.innerHTML = "";

  // Inject back button at top of mobile songlist (remove old one first)
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
        <div class="info">
          <div>${song.name}</div>
          <div>${song.artist}</div>
        </div>
        <div class="playnow"><span>Play</span></div>
      </li>
    `;

    // Desktop
    const liDesktop = document.createElement("div");
    liDesktop.innerHTML = html;
    liDesktop.firstElementChild.addEventListener("click", () => playSong(i));
    desktopUL.appendChild(liDesktop.firstElementChild);

    // Mobile
    const liMobile = document.createElement("div");
    liMobile.innerHTML = html;
    liMobile.firstElementChild.addEventListener("click", () => playSong(i));
    mobileUL.appendChild(liMobile.firstElementChild);
  });

  updateSongInfo(0);

  if (window.innerWidth <= 900) {
    // Smooth transition: fade out cards, slide in song list
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
  document.querySelector(".songinfo").textContent =
    `${song.name} - ${song.artist}`;
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

  document.querySelector(".songinfo").textContent =
    `${song.name} - ${song.artist}`;

  // Update album art thumbnail in playbar
  let thumb = document.querySelector(".playbar-thumb");
  if (!thumb) {
    thumb = document.createElement("img");
    thumb.className = "playbar-thumb";
    thumb.alt = "album art";
    const songinfo = document.querySelector(".songinfo");
    songinfo.parentNode.insertBefore(thumb, songinfo);
  }

  // Try to find cover from albumsIndex
  const albumKey = Object.keys(albumsIndex).find(k => albumsIndex[k].path === currentAlbum);
  if (albumKey) {
    fetch(`${S3_BASE}/${currentAlbum}/info.json`)
      .then(r => r.json())
      .then(info => {
        thumb.src = `${S3_BASE}/${currentAlbum}/${info.cover}`;
        thumb.onerror = () => { thumb.src = "default-cover.jpg"; };
      }).catch(() => { thumb.src = "default-cover.jpg"; });
  }

  // Update now playing indicator in both song lists
  ["songlist ul li", ".mobile-songlist ul li"].forEach(selector => {
    document.querySelectorAll(selector).forEach((li, i) => {
      li.classList.remove("active-song");

      // Replace icon with bouncing bars or restore music note
      const icon = li.querySelector("img.invert");
      const existingBars = li.querySelector(".now-playing-bars");

      if (i === index) {
        li.classList.add("active-song");
        if (icon) icon.style.display = "none";
        if (!existingBars) {
          const bars = document.createElement("div");
          bars.className = "now-playing-bars";
          bars.innerHTML = `<span></span><span></span><span></span><span></span>`;
          li.insertBefore(bars, li.firstChild);
        }
      } else {
        if (icon) icon.style.display = "";
        if (existingBars) existingBars.remove();
      }
    });
  });

  currentSong.play().then(() => {
    playBtn.src = "pause.svg";
    // Spin album thumb when playing
    const t = document.querySelector(".playbar-thumb");
    if (t) t.classList.add("playing");
  }).catch(err => {
    if (err.name !== "AbortError") console.error(err);
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
    currentSong.play();
    playBtn.src = "pause.svg";
    if (thumb) thumb.classList.add("playing");
  } else {
    currentSong.pause();
    playBtn.src = "play.svg";
    if (thumb) thumb.classList.remove("playing");
  }
});

nextBtn.addEventListener("click", () => {
  if (!songs.length) return;
  playSong((currentIndex + 1) % songs.length);
});

prevBtn.addEventListener("click", () => {
  if (!songs.length) return;
  playSong((currentIndex - 1 + songs.length) % songs.length);
});

/* ================= SEEK BAR ================= */
const seekbar = document.querySelector(".seekbar");
const circle = document.querySelector(".circle");

// Inject the gradient fill div inside seekbar
const seekFill = document.createElement("div");
seekFill.className = "seekbar-fill";
seekbar.insertBefore(seekFill, circle);

seekbar.addEventListener("click", e => {
  if (!currentSong.duration) return;
  const rect = seekbar.getBoundingClientRect();
  const percent = (e.clientX - rect.left) / rect.width;
  currentSong.currentTime = percent * currentSong.duration;
});

currentSong.addEventListener("timeupdate", () => {
  const cur = currentSong.currentTime;
  const dur = currentSong.duration;

  document.querySelector(".songtime").textContent =
    `${formatTime(cur)} / ${formatTime(dur)}`;

  if (dur) {
    const pct = (cur / dur) * 100;
    circle.style.left = `${pct}%`;
    seekFill.style.width = `${pct}%`;   // grow the gradient fill
  }
});

/* ================= VOLUME CONTROL ================= */
const volumeIcon = document.querySelector(".volume img");
const volumeSlider = document.querySelector(".volume input[type='range']");

// Set slider initial state
volumeSlider.min = 0;
volumeSlider.max = 1;
volumeSlider.step = 0.01;
volumeSlider.value = lastVolume;

// Slider → change audio volume
volumeSlider.addEventListener("input", () => {
  const val = parseFloat(volumeSlider.value);
  currentSong.volume = val;
  lastVolume = val > 0 ? val : lastVolume; // don't overwrite lastVolume with 0

  // sync mute state with slider
  if (val === 0) {
    isMuted = true;
    currentSong.muted = true;
    volumeIcon.src = "mute.svg";
  } else {
    isMuted = false;
    currentSong.muted = false;
    volumeIcon.src = "volume.svg";
  }
});

// Volume icon click → toggle mute/unmute
volumeIcon.addEventListener("click", () => {
  if (isMuted) {
    // Unmute
    isMuted = false;
    currentSong.muted = false;
    currentSong.volume = lastVolume || 0.8;
    volumeSlider.value = currentSong.volume;
    volumeIcon.src = "volume.svg";
  } else {
    // Mute
    isMuted = true;
    lastVolume = currentSong.volume; // save current before muting
    currentSong.muted = true;
    volumeSlider.value = 0;
    volumeIcon.src = "mute.svg";
  }
});

/* ================= SEARCH ================= */
const searchBox = document.getElementById("searchBox");
const searchResults = document.getElementById("searchResults");

searchBox.addEventListener("input", async () => {
  const q = searchBox.value.toLowerCase().trim();
  searchResults.innerHTML = "";
  if (!q) return;

  const matches = allSongs.filter(s =>
    s.name.toLowerCase().includes(q) ||
    s.artist.toLowerCase().includes(q)
  );

  if (!matches.length) {
    searchResults.innerHTML = `
      <div class="empty-state">
        <div class="empty-icon">🎵</div>
        <div class="empty-title">No songs found</div>
        <div class="empty-sub">Try a different song or artist name</div>
      </div>
    `;
    return;
  }

  matches.forEach(song => {
    const li = document.createElement("li");
    li.innerHTML = `
      <div class="search-song-title">${song.name}</div>
      <div class="search-artist">${song.artist}</div>
    `;

    li.addEventListener("click", async () => {
      const res = await fetch(`${S3_BASE}/${song.folder}/info.json`);
      const info = await res.json();

      loadSongs(song.folder, info);
      const idx = info.songs.findIndex(s => s.file === song.file);
      playSong(idx);

      searchResults.innerHTML = "";
      searchBox.value = "";
    });

    searchResults.appendChild(li);
  });
});

/* ================= SEARCH PANEL TOGGLE ================= */
const openSearchBtn = document.getElementById("openSearch");
const closeSearchBtn = document.getElementById("closeSearch");
const searchPanel = document.getElementById("leftSearchBox");
const overlay = document.getElementById("overlay");

if (openSearchBtn) {
  openSearchBtn.addEventListener("click", () => {
    searchPanel.classList.add("show");
    overlay.classList.add("show");
    searchBox.focus();
  });
}

if (closeSearchBtn) {
  closeSearchBtn.addEventListener("click", () => {
    searchPanel.classList.remove("show");
    overlay.classList.remove("show");
  });
}

if (overlay) {
  overlay.addEventListener("click", () => {
    searchPanel.classList.remove("show");
    overlay.classList.remove("show");
  });
}

/* ================= BACK BUTTON ================= */
const backBtn = document.getElementById("backToAlbums");

if (backBtn) {
  backBtn.addEventListener("click", () => {
    document.querySelector(".right").classList.remove("show-songs");
  });
}

/* ================= INIT ================= */
playBtn.src = "play.svg";   // always start as play icon on load
loadAlbums();

/* ================= SWIPE GESTURES (MOBILE) ================= */
let touchStartX = 0;
let touchStartY = 0;

document.addEventListener("touchstart", e => {
  touchStartX = e.touches[0].clientX;
  touchStartY = e.touches[0].clientY;
}, { passive: true });

document.addEventListener("touchend", e => {
  if (!songs.length) return;

  const dx = e.changedTouches[0].clientX - touchStartX;
  const dy = e.changedTouches[0].clientY - touchStartY;

  // Only trigger if horizontal swipe is dominant and long enough
  if (Math.abs(dx) > Math.abs(dy) && Math.abs(dx) > 60) {
    if (dx < 0) {
      // Swipe LEFT → next song
      playSong((currentIndex + 1) % songs.length);
      showSwipeFeedback("⏭ Next");
    } else {
      // Swipe RIGHT → previous song
      playSong((currentIndex - 1 + songs.length) % songs.length);
      showSwipeFeedback("⏮ Prev");
    }
  }
}, { passive: true });

function showSwipeFeedback(label) {
  const old = document.getElementById("swipe-toast");
  if (old) old.remove();

  const toast = document.createElement("div");
  toast.id = "swipe-toast";
  toast.textContent = label;
  toast.style.cssText = `
    position: fixed;
    top: 50%;
    left: 50%;
    transform: translate(-50%, -50%);
    background: rgba(124, 63, 255, 0.85);
    backdrop-filter: blur(10px);
    color: white;
    padding: 12px 28px;
    border-radius: 30px;
    font-size: 16px;
    font-weight: 700;
    letter-spacing: 1px;
    z-index: 99999;
    pointer-events: none;
    opacity: 1;
    transition: opacity 0.4s ease;
    box-shadow: 0 4px 20px rgba(124,63,255,0.5);
  `;
  document.body.appendChild(toast);

  setTimeout(() => { toast.style.opacity = "0"; }, 800);
  setTimeout(() => { toast.remove(); }, 1200);
}
