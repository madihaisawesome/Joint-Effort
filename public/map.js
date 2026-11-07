const map = L.map("map", { preferCanvas: true }).setView([51.05, -114.07], 11);

L.tileLayer("https://tile.openstreetmap.org/{z}/{x}/{y}.png", {
  maxZoom: 19,
  attribution: '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a>',
}).addTo(map);

const layer = L.layerGroup().addTo(map);

const qInput = document.getElementById("q");
const categorySelect = document.getElementById("category");
const resultCount = document.getElementById("result-count");
const syncStatus = document.getElementById("sync-status");
const syncBtn = document.getElementById("sync-btn");

const SOURCE_COLORS = {
  calgary: "#1f5f8b",
  program: "#2f7d4a",
  buddy: "#b05a1e",
};

let debounceTimer = null;
let loadToken = 0;

function escapeHtml(value) {
  return String(value)
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

function selectedSources() {
  return Array.from(document.querySelectorAll('input[name="source"]:checked')).map(
    (el) => el.value
  );
}

function selectedAmenity() {
  const el = document.querySelector('input[name="amenity"]:checked');
  return el ? el.value : "";
}

function buildQuery() {
  const params = new URLSearchParams();
  const sources = selectedSources();
  if (sources.length) params.set("source", sources.join(","));
  const q = qInput.value.trim();
  if (q) params.set("q", q);
  const category = categorySelect.value;
  if (category) params.set("category", category);
  const amenity = selectedAmenity();
  if (amenity) params.set("amenity", amenity);
  return params.toString();
}

async function loadCategories() {
  const sources = selectedSources();
  const params = new URLSearchParams();
  if (sources.length) params.set("source", sources.join(","));
  const res = await fetch(`/api/map/categories?${params}`);
  const data = await res.json();
  const current = categorySelect.value;
  categorySelect.innerHTML = '<option value="">All categories</option>';
  for (const cat of data.categories || []) {
    const opt = document.createElement("option");
    opt.value = cat;
    opt.textContent = cat;
    categorySelect.appendChild(opt);
  }
  if ([...categorySelect.options].some((o) => o.value === current)) {
    categorySelect.value = current;
  }
}

function popupHtml(props) {
  const extras = props.extras || {};
  const subtitle = [props.source, props.category].filter(Boolean).join(" · ");

  const amenityLabels = [];
  if (extras.pool) amenityLabels.push("Pool");
  if (extras.gym) amenityLabels.push("Gym");
  if (extras.active_living) amenityLabels.push("Active living");
  if (extras.fitness_studio) amenityLabels.push("Fitness studio");
  if (extras.ice) amenityLabels.push("Ice");
  if (extras.track) amenityLabels.push("Track");
  if (extras.spray_park) amenityLabels.push("Spray park");

  const rows = [
    ["Address", props.address],
    ["Phone", props.phone],
    ["Hours", extras.hours],
    ["Time", extras.time],
    ["Note", extras.note || extras.notes],
    ["Org", extras.org],
    ["Amenities", amenityLabels.join(", ")],
  ];

  let body = "";
  for (const [label, value] of rows) {
    if (value == null || value === "") continue;
    body += `<div class="popup-row"><span class="popup-label">${escapeHtml(label)}</span><span>${escapeHtml(value)}</span></div>`;
  }

  if (props.website) {
    const href = escapeHtml(props.website);
    body += `<div class="popup-row"><span class="popup-label">Website</span><a href="${href}" target="_blank" rel="noopener noreferrer">${href}</a></div>`;
  }

  return `
    <div class="place-popup">
      <strong class="popup-title">${escapeHtml(props.name || "Place")}</strong>
      ${subtitle ? `<div class="popup-sub">${escapeHtml(subtitle)}</div>` : ""}
      ${body}
    </div>
  `;
}

async function loadPlaces() {
  const token = ++loadToken;
  const query = buildQuery();
  resultCount.textContent = "Loading places…";

  const res = await fetch(`/api/map/places?${query}`);
  if (token !== loadToken) return;

  if (!res.ok) {
    const err = await res.json().catch(() => ({}));
    resultCount.textContent = err.error || "Failed to load places";
    return;
  }

  const geojson = await res.json();
  if (token !== loadToken) return;

  layer.clearLayers();

  const features = geojson.features || [];
  resultCount.textContent = `${features.length} place${features.length === 1 ? "" : "s"}`;

  for (const feature of features) {
    const [lng, lat] = feature.geometry.coordinates;
    const props = feature.properties || {};
    const color = SOURCE_COLORS[props.source] || SOURCE_COLORS.calgary;
    const marker = L.circleMarker([lat, lng], {
      radius: 7,
      color: "#fff",
      weight: 1.5,
      fillColor: color,
      fillOpacity: 0.95,
    });
    marker.bindPopup(popupHtml(props), {
      maxWidth: 280,
      className: "place-popup-wrap",
    });
    layer.addLayer(marker);
  }
}

function scheduleReload() {
  clearTimeout(debounceTimer);
  debounceTimer = setTimeout(() => {
    loadCategories();
    loadPlaces();
  }, 150);
}

document.querySelectorAll('input[name="source"], input[name="amenity"]').forEach((el) => {
  el.addEventListener("change", scheduleReload);
});
qInput.addEventListener("input", scheduleReload);
categorySelect.addEventListener("change", () => loadPlaces());

syncBtn.addEventListener("click", async () => {
  syncBtn.disabled = true;
  syncStatus.hidden = false;
  syncStatus.textContent = "Syncing Open Calgary…";
  try {
    const res = await fetch("/api/map/sync", { method: "POST" });
    const data = await res.json();
    if (!res.ok) throw new Error(data.error || "Sync failed");
    syncStatus.textContent = `Synced ${data.upserted} facilities`;
    await Promise.all([loadCategories(), loadPlaces()]);
  } catch (err) {
    syncStatus.textContent = err.message || "Sync failed";
  } finally {
    syncBtn.disabled = false;
  }
});

Promise.all([loadCategories(), loadPlaces()]);
