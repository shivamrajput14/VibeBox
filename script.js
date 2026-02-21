console.log("VibeBox script loaded");

/* ================= CONFIG ================= */
const S3_BASE = "https://vibebox-songs.s3.amazonaws.com";

/* ================= STATE ================= */
let albumsIndex = {};
let allSongs = [];
let songs = [];
let currentAlbum = null;
let currentIndex = 0;

const currentSong = new Audio();
currentSong.preload = "metadata";

/* ================= UTILS ================= */
function formatTime(time) {
  if (!time || isNaN(time)) return "00:00";
  const m = Math.floor(time / 60);
  const s = Math.floor(time % 60);
  return `${m.toString().padStart(2, "0")}:${s.toString().padStart(2, "0")}`;
}

/* ================= LOAD ALBUMS ================= */
async function loadAlbums() {
  const res = await fetch("songs-data.json");
  albumsIndex = await res.json();

  const container = document.querySelector(".cardcontainer");
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

    /* build global search index */
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

  console.log("Search index ready:", allSongs.length);
}

/* ================= LOAD SONG LIST ================= */
function loadSongs(folder, info) {
  currentAlbum = folder;
  songs = info.songs;
  currentIndex = 0;

  const ul = document.querySelector(".songlist ul");
  ul.innerHTML = "";

  songs.forEach((song, i) => {
    const li = document.createElement("li");
    li.innerHTML = `
      <img class="invert" src="music.svg">
      <div class="info">
        <div>${song.name}</div>
        <div>${song.artist}</div>
      </div>
      <div class="playnow"><span>Play Now</span></div>
    `;
    li.addEventListener("click", () => playSong(i));
    ul.appendChild(li);
  });

  playSong(0, false);
}

/* ================= PLAY SONG ================= */
function playSong(index, autoplay = true) {
  if (!songs[index]) return;

  currentIndex = index;
  const song = songs[index];
  const encodedFile = encodeURIComponent(song.file);

  currentSong.pause();
  currentSong.src = `${S3_BASE}/${currentAlbum}/${encodedFile}`;
  currentSong.currentTime = 0;

  document.querySelector(".songinfo").textContent = "Loading…";
  playBtn.src = "play.svg";

  if (!autoplay) return;

  currentSong.oncanplay = () => {
    currentSong.play().catch(err => {
      if (err.name !== "AbortError") console.error(err);
    });

    document.querySelector(".songinfo").textContent =
      `${song.name} - ${song.artist}`;
    playBtn.src = "pause.svg";
  };
}

/* ================= CONTROLS ================= */
const playBtn = document.getElementById("play");
const nextBtn = document.getElementById("next");
const prevBtn = document.getElementById("prev");

playBtn.addEventListener("click", () => {
  if (currentSong.paused) {
    currentSong.play();
    playBtn.src = "pause.svg";
  } else {
    currentSong.pause();
    playBtn.src = "play.svg";
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
    circle.style.left = `${(cur / dur) * 100}%`;
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
    searchResults.innerHTML = "<li>No results found</li>";
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

if (openSearchBtn && searchPanel) {
  openSearchBtn.addEventListener("click", () => {
    searchPanel.classList.add("show");
    if (overlay) overlay.classList.add("show");
    searchBox.focus();
  });
}

if (closeSearchBtn && searchPanel) {
  closeSearchBtn.addEventListener("click", () => {
    searchPanel.classList.remove("show");
    if (overlay) overlay.classList.remove("show");
  });
}

if (overlay) {
  overlay.addEventListener("click", () => {
    searchPanel.classList.remove("show");
    overlay.classList.remove("show");
  });
}



/* ================= INIT ================= */
loadAlbums();
