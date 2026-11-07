const { upsertPlaces, deletePlacesBySource } = require("./db");

const DATASET_URL = "https://data.calgary.ca/resource/hxfu-6d96.json";
const PAGE_SIZE = 1000;

function truthyFlag(value) {
  if (value == null) return false;
  const s = String(value).trim().toUpperCase();
  if (s === "Y" || s === "YES" || s === "TRUE") return true;
  const n = Number(value);
  return Number.isFinite(n) && n > 0;
}

function amenitiesFromRow(row) {
  return {
    pool: truthyFlag(row.indr_pool) || truthyFlag(row.outdr_pool),
    gym: truthyFlag(row.gym) || truthyFlag(row.fitnss_wght),
    active_living: truthyFlag(row.active_living_program),
    fitness_studio: truthyFlag(row.fit_studio),
    ice: truthyFlag(row.ice_indr),
    track: truthyFlag(row.track_indr) || truthyFlag(row.track_outdr),
    spray_park: truthyFlag(row.spray_park),
  };
}

function placeIdFromRow(row, index) {
  const label = row.label || row.complex_name || row.facility_name || "facility";
  const address = row.address || "";
  const coords = row.point && row.point.coordinates;
  const key = `${label}|${address}|${coords ? coords.join(",") : index}`;
  return `calgary:${Buffer.from(key).toString("base64url").slice(0, 48)}`;
}

function mapRowToPlace(row, index) {
  const coords = row.point && row.point.coordinates;
  if (!Array.isArray(coords) || coords.length < 2) return null;

  const lng = Number(coords[0]);
  const lat = Number(coords[1]);
  if (!Number.isFinite(lat) || !Number.isFinite(lng)) return null;

  const name =
    row.label ||
    row.complex_name ||
    row.facility_name ||
    "Calgary recreation facility";

  return {
    id: placeIdFromRow(row, index),
    source: "calgary",
    name,
    category: row.facility_type || row.complex_category || "Recreation",
    address: row.address || null,
    lat,
    lng,
    phone: row.phone || null,
    website: row.website || null,
    extras: {
      ...amenitiesFromRow(row),
      org: row.org || null,
      steward: row.steward || null,
      notes: row.notes || null,
      complex_name: row.complex_name || null,
    },
    updated_at: new Date().toISOString(),
  };
}

async function fetchPage(offset) {
  const url = new URL(DATASET_URL);
  url.searchParams.set("$limit", String(PAGE_SIZE));
  url.searchParams.set("$offset", String(offset));

  const res = await fetch(url);
  if (!res.ok) {
    throw new Error(`Open Calgary fetch failed: ${res.status} ${res.statusText}`);
  }
  return res.json();
}

/**
 * Pull all recreation facilities from Open Calgary and replace calgary places.
 * @returns {Promise<{ fetched: number, upserted: number }>}
 */
async function syncCalgaryFacilities() {
  const places = [];
  let offset = 0;

  for (;;) {
    const rows = await fetchPage(offset);
    if (!Array.isArray(rows) || rows.length === 0) break;

    rows.forEach((row, i) => {
      const place = mapRowToPlace(row, offset + i);
      if (place) places.push(place);
    });

    if (rows.length < PAGE_SIZE) break;
    offset += PAGE_SIZE;
  }

  deletePlacesBySource("calgary");
  upsertPlaces(places);

  return { fetched: places.length, upserted: places.length };
}

module.exports = {
  syncCalgaryFacilities,
};
