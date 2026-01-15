// script.js - ONLY SONGS version
console.log("Script loaded");
let allSongs = [];

let currFolder;

const baseUrl = "http://127.0.0.1:5500/"; // adjust if you use a different host/port
let currentSong = new Audio();
let songs = [];           // filenames relative to /songs/, e.g. "My-Song-by-Artist.mp3"
let currentIndex = -1;    // index in `songs`

/* ---------------- utilities ---------------- */
function formatTime(time) {
  if (isNaN(time) || time < 0) return "00:00";
  const m = Math.floor(time / 60);
  const s = Math.floor(time % 60);
  return `${m.toString().padStart(2, "0")}:${s.toString().padStart(2, "0")}`;
}

function cleanDisplayName(filename) {
  // filename is like "My-Song-by-Artist.mp3" or "My Song.mp3"
  const name = decodeURIComponent(filename).replace(".mp3", "");
  // prefer "-by-" separation if used
  let parts = name.split("-by-");
  if (parts.length === 1) parts = name.split("by");
  const songName = parts[0] ? parts[0].replace(/-/g, " ").trim() : "Unknown Song";
  const artist = parts[1] ? parts[1].replace(/-/g, " ").trim() : "Unknown Artist";
  return { songName, artist };
}

/* ---------------- load all songs from /songs/ ---------------- */
async function getsongs(folder) {
  currFolder=folder;
  const url = `${baseUrl}${currFolder}/`;
  const res = await fetch(url);
  const text = await res.text();

  const div = document.createElement("div");
  div.innerHTML = text;
  const anchors = Array.from(div.getElementsByTagName("a"));

  const found = [];
  for (const a of anchors) {
    const href = a.href;
    if (href.endsWith(".mp3")) {
      // href like http://127.0.0.1:5500/songs/My-Song.mp3
      const filename = href.split(`/${currFolder}/`)[1];
      if (filename) found.push(filename);
    }
  }
  return found;
}

/* render song list into UI  */
function renderSongList() {
  const ul = document.querySelector(".songlist ul");
  if (!ul) return;
  ul.innerHTML = "";

  songs.forEach((filename, i) => {
    const { songName, artist } = cleanDisplayName(filename);
    const li = document.createElement("li");
    li.dataset.file = filename;
    li.innerHTML = `
      <img class="invert" src="music.svg" alt="">
      <div class="info">
        <div>${songName}</div>
        <div>${artist}</div>
      </div>
      <div class="playnow">
        <span>Play Now</span>
        <img class="invert" src="play.svg" alt="">
      </div>
    `;
    // click to play
    li.addEventListener("click", () => {
      currentIndex = i;
      playMusic(songs[currentIndex]);
    });
    ul.appendChild(li);
  });
}

/* play a file (filename relative to /songs/) - */
function playMusic(filename, autoplay = true) {
  if (!filename) return;
  const src = `${currFolder}/${filename}`;
  currentSong.src = src;
  // update UI
  const infoEl = document.querySelector(".songinfo");
  const timeEl = document.querySelector(".songtime");
  const { songName, artist } = cleanDisplayName(filename);
  if (infoEl) infoEl.textContent = `${songName} - ${artist}`;
  if (timeEl) timeEl.textContent = `00:00 / 00:00`;

  if (autoplay) {
    currentSong.play().catch(err => console.error("Play error:", err));
    const playBtn = document.getElementById("play");
    if (playBtn) playBtn.src = "pause.svg";
  }
}

/* attach controls (once) */
function attachControls() {
  // play/pause
  const playBtn = document.getElementById("play");
  if (playBtn) {
    playBtn.onclick = () => {
      if (currentSong.paused) {
        currentSong.play();
        playBtn.src = "pause.svg";
      } else {
        currentSong.pause();
        playBtn.src = "play.svg";
      }
    };
  }

  // next / prev
  const nextBtn = document.getElementById("next");
  const prevBtn = document.getElementById("prev");

  if (nextBtn) {
    nextBtn.onclick = () => {
      if (!songs.length) return;
      if (currentIndex === -1) currentIndex = 0;
      currentIndex = (currentIndex + 1) % songs.length;
      playMusic(songs[currentIndex]);
    };
  }

  if (prevBtn) {
    prevBtn.onclick = () => {
      if (!songs.length) return;
      if (currentIndex === -1) currentIndex = 0;
      currentIndex = (currentIndex - 1 + songs.length) % songs.length;
      playMusic(songs[currentIndex]);
    };
  }

  // seekbar click
  const seekbar = document.querySelector(".seekbar");
  const circle = document.querySelector(".circle");
  if (seekbar && circle) {
    seekbar.onclick = (e) => {
      const rect = seekbar.getBoundingClientRect();
      const offsetX = e.clientX - rect.left;
      const percent = Math.max(0, Math.min(1, offsetX / rect.width));
      if (currentSong.duration) {
        currentSong.currentTime = percent * currentSong.duration;
      }
      circle.style.left = `${percent * 100}%`;
    };
  }

  // volume range (try both .range and .volume input)
  const volInput = document.querySelector(".range input[type='range'], .volume input[type='range']");
  if (volInput) {
    currentSong.volume = parseInt(volInput.value || volInput.defaultValue || 50, 10) / 100;
    volInput.oninput = (e) => {
      currentSong.volume = parseInt(e.target.value, 10) / 100;
    };
  }

  // update time UI
  currentSong.ontimeupdate = () => {
    const timeEl = document.querySelector(".songtime");
    if (timeEl) {
      const cur = formatTime(currentSong.currentTime);
      const tot = formatTime(currentSong.duration);
      timeEl.textContent = `${cur} / ${tot}`;
    }
    const circle = document.querySelector(".circle");
    const seekbar = document.querySelector(".seekbar");
    if (circle && seekbar && currentSong.duration) {
      const percent = (currentSong.currentTime / currentSong.duration) * 100;
      circle.style.left = `${percent}%`;
    }
  };

  // when track ends auto-next
  currentSong.onended = () => {
    if (!songs.length) return;
    currentIndex = (currentIndex + 1) % songs.length;
    playMusic(songs[currentIndex]);
  };
}

/* ---------------- display albums in sidebar ---------------- */
async function displayAlbums() {
  console.log("displaying albums");
  // fetch the songs directory listing (your server must allow directory listing)
  const listRes = await fetch(`${baseUrl}songs/`);
  const listText = await listRes.text();
  const div = document.createElement("div");
  div.innerHTML = listText;
  const anchors = Array.from(div.getElementsByTagName("a"));

  const cardcontainer = document.querySelector(".cardcontainer");
  if (!cardcontainer) {
    console.warn("No .cardcontainer found in DOM");
    return;
  }

  const frag = document.createDocumentFragment();
  // Use a set to avoid duplicates if server listing repeats entries
  const seen = new Set();

  for (const a of anchors) {
    // anchor href might be absolute like http://127.0.0.1:5500/songs/cs/
    try {
      const pathname = new URL(a.href, location.origin).pathname; // safe parse
      // normalize: pathname like /songs/cs/ or /songs/
      if (!pathname.startsWith("/songs/")) continue;
      // skip root /songs/ link (we want folders inside)
      const parts = pathname.split("/").filter(Boolean); // ["songs", "cs"]
      if (parts.length < 2) continue;
      const folder = parts[1]; // "cs", "ncs", etc.
      if (!folder || seen.has(folder)) continue;
      seen.add(folder);
      const folderSongs = await getsongs(`songs/${folder}`);
folderSongs.forEach(s => {
  allSongs.push({
    filename: s,
    folder: `songs/${folder}`
  });
});


      // Try to load info.json for metadata (title, description)
      let meta = { title: folder, description: "", cover: `/songs/${folder}/cover.jpg` };
      try {
        const infoRes = await fetch(`${baseUrl}songs/${folder}/info.json`);
        if (infoRes.ok) {
          const infoJson = await infoRes.json();
          meta.title = infoJson.title || meta.title;
          meta.description = infoJson.description || meta.description;
          if (infoJson.cover) meta.cover = `/songs/${folder}/${infoJson.cover}`;
        }
      } catch (err) {
        // info.json missing or parse failed — ignore and keep defaults
      }

      // Create card element (DOM methods to avoid reparse)
      const card = document.createElement("div");
      card.className = "card";
      card.dataset.folder = folder;

      // play button
      const playDiv = document.createElement("div");
      playDiv.className = "play";
      playDiv.innerHTML = `
        <svg width="16" height="16" viewBox="0 0 24 24" fill="none"
          xmlns="http://www.w3.org/2000/svg">
          <path d="M5 20V4L19 12L5 20Z" stroke="#141B34" fill="#000" stroke-width="1.5"
            stroke-linejoin="round" />
        </svg>`;
      card.appendChild(playDiv);

      // image - add onerror fallback
      const img = document.createElement("img");
      img.src = meta.cover;
      img.alt = meta.title;
      img.onerror = () => { img.src = `${baseUrl}default-cover.jpg`; }; // add a default-cover.jpg at root
      card.appendChild(img);

      const h2 = document.createElement("h2");
      h2.textContent = meta.title;
      card.appendChild(h2);

      const p = document.createElement("p");
      p.textContent = meta.description;
      card.appendChild(p);

      frag.appendChild(card);

    } catch (err) {
      console.warn("Skipping anchor due to URL parse error:", a.href, err);
    }
  }

  // append all cards once
  cardcontainer.appendChild(frag);

  // attach click listeners to cards (or use event delegation)
  // I use delegation to handle cards added later too.
  cardcontainer.addEventListener("click", async (evt) => {
    const card = evt.target.closest(".card");
    if (!card) return;
    const folder = card.dataset.folder;
    if (!folder) return;

    // visual active state - remove existing and set this
    document.querySelectorAll(".card.active").forEach(c => c.classList.remove("active"));
    card.classList.add("active");

    try {
      // load songs from that folder (your getsongs sets currFolder internally)
      songs = await getsongs(`songs/${folder}`);
      console.log("Loaded songs for folder:", folder, songs);

      // update library UI
      renderSongList();

      // set currentIndex and load first song metadata (do not autoplay)
      currentIndex = songs.length ? 0 : -1;
      if (songs.length) {
        playMusic(songs[0], false);
        const playBtn = document.getElementById("play");
        if (playBtn) playBtn.src = "play.svg";
      }

      // optional: close sidebar
      const left = document.querySelector(".left");
      if (left) left.style.left = "-120%";

    } catch (err) {
      console.error("Failed to load songs for folder", folder, err);
    }
  }, { passive: true });
}



/* ---------------- main init ---------------- */
async function main() {
  // load songs from /songs/
  await displayAlbums();
  try {
    songs = await getsongs("songs/cs");
    console.log("Found songs:", songs);
  } catch (err) {
    console.error("Failed to load songs:", err);
    return;
  }

  // render and attach
  renderSongList();

  // set first song as loaded (do not auto play)
  if (songs.length > 0) {
    currentIndex = 0;
    // playMusic(songs[0], false);
    playMusic(songs[0], true);
    document.getElementById("play").src = "play.svg";
  }

  attachControls();
}
document.querySelector(".hamburger").addEventListener("click", function() {
  document.querySelector(".left").style.left = "0";
});
document.querySelector(".close").addEventListener("click", function() {
  document.querySelector(".left").style.left = "-120%";
});

// document.getElementById("openSearch").addEventListener("click", ()=>{
//   document.getElementById("leftSearchBox").style.display = "block";
// });
document.getElementById("openSearch").addEventListener("click", ()=>{
  document.getElementById("leftSearchBox").classList.add("show");
});

const searchBox = document.getElementById("searchBox");
const searchResults = document.getElementById("searchResults");

searchBox.addEventListener("input", ()=>{
  const text = searchBox.value.toLowerCase();
  searchResults.innerHTML = "";

  const filtered = allSongs.filter(song =>
    song.filename.toLowerCase().includes(text)
  );

  // NO RESULT FOUND
  if(filtered.length === 0){
    const li = document.createElement("li");
    li.style.textAlign = "center";
    li.style.padding = "10px";
    li.style.color = "#aaa";
    li.textContent = "No results found";
    searchResults.appendChild(li);
    return;
  }

  // Show results if found
  filtered.forEach(song=>{
    const { songName, artist } = cleanDisplayName(song.filename);

    const li = document.createElement("li");
    li.innerHTML = `
      <div class="search-song-title">${songName}</div>
      <div class="search-artist">${artist}</div>
    `;

    li.addEventListener("click",()=>{
      currFolder = song.folder;
      playMusic(song.filename);
    });

    searchResults.appendChild(li);
  });
});
document.getElementById("closeSearch").addEventListener("click", ()=>{
  const box = document.getElementById("leftSearchBox");
  box.classList.remove("show");

  // clear after animation ends
  setTimeout(()=>{
    searchBox.value = "";
    searchResults.innerHTML = "";
  }, 300);
});







// load the songs of folder when clicked
// 
// When an album "card" is clicked we fetch that album folder and update the library UI.
Array.from(document.getElementsByClassName("card")).forEach(card => {
  card.addEventListener("click", async (evt) => {
    const folderName = evt.currentTarget.dataset.folder; // expected 'cs' or 'ncs'
    if (!folderName) return;

    // call getsongs with the folder path relative to base: "songs/cs"
    try {
      songs = await getsongs(`songs/${folderName}`);
      console.log("Loaded songs for folder:", folderName, songs);

      // render the new song list into the library UI
      renderSongList();

      // reset currentIndex and load the first song (but do not autoplay)
      currentIndex = songs.length ? 0 : -1;
      if (songs.length) {
        // load first track (false = don't autoplay right away)
        playMusic(songs[0], false);
        const playBtn = document.getElementById("play");
        if (playBtn) playBtn.src = "play.svg";
      }

      // Optional: close left sidebar if you want to hide album list after click
      const left = document.querySelector(".left");
      if (left) left.style.left = "-120%";

    } catch (err) {
      console.error("Failed to load album:", folderName, err);
    }
  });
});

// adding event listner to mute

document.querySelector(".volume > img").addEventListener("click", function (event) {

  const img = event.target;  
  const volSlider = document.querySelector(".range input[type='range']");

  // MUTE
  if (img.src.includes("volume.svg")) {
    img.src = img.src.replace("volume.svg", "mute.svg");
    currentSong.volume = 0;
    if (volSlider) volSlider.value = 0;

  // UNMUTE
  } else {
    img.src = img.src.replace("mute.svg", "volume.svg");
    currentSong.volume = 1;
    if (volSlider) volSlider.value =30;
  }
});

main();
