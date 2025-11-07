// NASA Space Explorer — robust, starter-compatible, and pretty ✨

const DATA_URL = "https://cdn.jsdelivr.net/gh/GCA-Classroom/apod/data.json";

const gallery = document.getElementById("gallery");
const btn = document.getElementById("getImageBtn");

// Run after DOM is fully parsed (extra safety even though script is at the end)
document.addEventListener("DOMContentLoaded", () => {
  enhanceUI();
  // Click always fetches (fixes the issue where nothing happened on first click)
  btn.addEventListener("click", loadData);
  // Optional: auto-init so the page doesn’t look empty
  // loadData();
});

function enhanceUI() {
  const filters = document.querySelector(".filters");

  // Polished button label
  btn.textContent = "🚀 Fetch Space Images";

  // Date picker row (select an end date; we’ll show 9 consecutive entries ending on that date)
  const dateWrap = document.createElement("div");
  dateWrap.className = "date-row";
  dateWrap.style.display = "flex";
  dateWrap.style.gap = "10px";
  dateWrap.style.flexWrap = "wrap";
  dateWrap.style.alignItems = "center";

  dateWrap.innerHTML = `
    <label style="display:flex;align-items:center;gap:8px">
      <span>Start date:</span>
      <input id="startDate" type="date" />
    </label>
    <small id="dateHint" style="color:#666">
      Shows 9 consecutive entries ending on the selected date (or latest available).
    </small>
  `;
  filters.prepend(dateWrap);

  // Random fact bar
  const factBar = document.createElement("div");
  factBar.id = "factBar";
  factBar.className = "factbar";
  factBar.textContent = `🛰️ Did you know? ${randomFact()}`;
  filters.after(factBar);
}

function randomFact() {
  const FACTS = [
    "Neutron stars can spin hundreds of times per second.",
    "On Mars, sunsets appear blue due to dust scattering.",
    "Jupiter and the Sun orbit a point in space between them.",
    "Driving to the Sun at highway speeds would take 150+ years.",
    "There are more galaxies in the universe than trees on Earth."
  ];
  return FACTS[Math.floor(Math.random() * FACTS.length)];
}

/* ---------------- Modal ---------------- */
let modalEl;
function ensureModal() {
  if (modalEl) return modalEl;
  modalEl = document.createElement("div");
  modalEl.className = "modal-overlay";
  modalEl.innerHTML = `
    <div class="modal">
      <button class="modal-close" aria-label="Close details">✕</button>
      <div class="modal-media" id="modalMedia"></div>
      <div class="modal-meta">
        <h2 id="modalTitle"></h2>
        <p id="modalDate" class="muted"></p>
        <p id="modalExplain"></p>
        <p id="modalCopy" class="muted"></p>
        <div id="modalLinks" class="modal-links"></div>
      </div>
    </div>
  `;
  document.body.appendChild(modalEl);
  modalEl.addEventListener("click", (e) => {
    if (e.target.classList.contains("modal-overlay") || e.target.classList.contains("modal-close")) {
      closeModal();
    }
  });
  window.addEventListener("keydown", (e) => {
    if (e.key === "Escape" && modalEl.classList.contains("open")) closeModal();
  });
  return modalEl;
}

function openModal(item) {
  const m = ensureModal();
  m.classList.add("open");

  const media = m.querySelector("#modalMedia");
  const title = m.querySelector("#modalTitle");
  const date = m.querySelector("#modalDate");
  const explain = m.querySelector("#modalExplain");
  const copy = m.querySelector("#modalCopy");
  const links = m.querySelector("#modalLinks");

  title.textContent = item.title || "Untitled";
  date.textContent = formatDate(item.date);
  explain.textContent = item.explanation || "";
  copy.textContent = item.copyright ? `© ${item.copyright}` : "Public Domain / Various Contributors";

  media.innerHTML = "";
  if (item.media_type === "video") {
    const iframe = document.createElement("iframe");
    iframe.src = item.url; // YouTube embed expected
    iframe.title = item.title || "APOD Video";
    iframe.allowFullscreen = true;
    iframe.setAttribute("allow", "accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture; web-share");
    media.appendChild(iframe);
  } else {
    const img = document.createElement("img");
    img.src = item.hdurl || item.url;
    img.alt = item.title || "APOD Image";
    media.appendChild(img);
  }

  const linkNodes = [];
  if (item.media_type === "image") {
    if (item.hdurl) linkNodes.push(makeLink(item.hdurl, "View HD Image"));
    if (item.url) linkNodes.push(makeLink(item.url, "Open Original"));
  } else {
    if (item.url) linkNodes.push(makeLink(item.url, "Open Video"));
    if (item.thumbnail_url) linkNodes.push(makeLink(item.thumbnail_url, "Thumbnail"));
  }
  links.innerHTML = "";
  linkNodes.forEach((a) => links.appendChild(a));
}

function closeModal() { if (modalEl) modalEl.classList.remove("open"); }
function makeLink(href, label) {
  const a = document.createElement("a");
  a.href = href; a.target = "_blank"; a.rel = "noopener";
  a.textContent = `${label} ↗`;
  return a;
}

/* ---------------- Data + Gallery ---------------- */
let master = []; // full feed in memory

async function loadData() {
  // Loading state
  gallery.innerHTML = `
    <div class="placeholder">
      <div class="placeholder-icon">⏳</div>
      <p>Loading space photos…</p>
    </div>
  `;

  try {
    const res = await fetch(DATA_URL, { cache: "no-store" });
    if (!res.ok) throw new Error(`Network error ${res.status}`);
    const data = await res.json();
    if (!Array.isArray(data)) throw new Error("Unexpected data format");

    // Sort newest first
    data.sort((a, b) => (a.date < b.date ? 1 : -1));
    master = data;

    // Initialize date bounds + default to newest
    const startDateEl = document.getElementById("startDate");
    if (startDateEl) {
      const newest = master[0]?.date;
      const oldest = master[master.length - 1]?.date;
      if (newest) startDateEl.value = newest;
      if (oldest) startDateEl.min = oldest;
      if (newest) startDateEl.max = newest;
      startDateEl.addEventListener("change", () => renderGallery(selectNine()));
    }

    renderGallery(selectNine());
  } catch (err) {
    console.error(err);
    gallery.innerHTML = `
      <div class="placeholder">
        <div class="placeholder-icon">⚠️</div>
        <p>Could not load images right now. Please try again.</p>
      </div>
    `;
  }
}

function selectNine() {
  if (!master.length) return [];
  const startInput = document.getElementById("startDate");
  const picked = startInput && startInput.value ? startInput.value : master[0].date;

  // master is DESC; find first entry with date <= picked
  let idx = master.findIndex((it) => it.date <= picked);
  if (idx < 0) idx = master.length - 1;

  // Ensure we always return a 9-length window if available
  const startIdx = Math.max(0, Math.min(idx, Math.max(0, master.length - 9)));
  return master.slice(startIdx, startIdx + 9);
}

function renderGallery(items) {
  gallery.innerHTML = "";
  const frag = document.createDocumentFragment();
  items.forEach((item, i) => frag.appendChild(makeCard(item, i)));
  gallery.appendChild(frag);
}

function makeCard(item, index) {
  const isVideo = item.media_type === "video";
  const thumb = isVideo ? (item.thumbnail_url || youTubeThumb(item.url) || "") : (item.url || "");

  const card = document.createElement("div");
  card.className = "gallery-item";
  card.setAttribute("tabindex", "0");
  card.setAttribute("role", "button");
  card.dataset.index = index;

  const img = document.createElement("img");
  img.src = thumb;
  img.alt = item.title || "Space image";
  img.loading = "lazy";
  if (isVideo) img.classList.add("is-video");

  const caption = document.createElement("p");
  caption.innerHTML = `<strong>${item.title || "Untitled"}</strong>${formatDate(item.date) ? "<br>" + formatDate(item.date) : ""}`;

  if (isVideo) {
    const badge = document.createElement("span");
    badge.className = "video-badge";
    badge.textContent = "VIDEO";
    card.appendChild(badge);
  }

  card.appendChild(img);
  card.appendChild(caption);

  const open = () => openModal(item);
  card.addEventListener("click", open);
  card.addEventListener("keydown", (e) => {
    if (e.key === "Enter" || e.key === " ") { e.preventDefault(); open(); }
  });

  return card;
}

/* ---------------- Helpers ---------------- */
function formatDate(iso) {
  try {
    const d = new Date(iso + "T00:00:00");
    return d.toLocaleDateString(undefined, { year: "numeric", month: "short", day: "2-digit" });
  } catch { return ""; }
}

function youTubeThumb(embedUrl) {
  try {
    const m = embedUrl.match(/\/embed\/([^?&/]+)/i);
    return m && m[1] ? `https://img.youtube.com/vi/${m[1]}/hqdefault.jpg` : "";
  } catch { return ""; }
}
