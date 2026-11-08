const fs = require("fs");
const path = require("path");
const Database = require("better-sqlite3");

const DATA_DIR = path.join(__dirname, "data");
// Railway (or similar) can mount a volume at DB_DIR so SQLite persists
// without overwriting curriculum.json / programs.json in DATA_DIR.
const DB_DIR = process.env.DB_DIR
  ? path.resolve(process.env.DB_DIR)
  : DATA_DIR;
const DB_PATH = path.join(DB_DIR, "joint-effort.sqlite");

/** @type {import("better-sqlite3").Database | null} */
let db = null;

function getDb() {
  if (!db) {
    throw new Error("Database not initialized. Call initDb() first.");
  }
  return db;
}

function initDb() {
  if (!fs.existsSync(DATA_DIR)) {
    fs.mkdirSync(DATA_DIR, { recursive: true });
  }
  if (!fs.existsSync(DB_DIR)) {
    fs.mkdirSync(DB_DIR, { recursive: true });
  }

  db = new Database(DB_PATH);
  db.pragma("journal_mode = WAL");
  db.pragma("foreign_keys = ON");

  db.exec(`
    CREATE TABLE IF NOT EXISTS places (
      id TEXT PRIMARY KEY,
      source TEXT NOT NULL CHECK (source IN ('calgary', 'program', 'buddy')),
      name TEXT NOT NULL,
      category TEXT,
      address TEXT,
      lat REAL NOT NULL,
      lng REAL NOT NULL,
      phone TEXT,
      website TEXT,
      extras TEXT NOT NULL DEFAULT '{}',
      updated_at TEXT NOT NULL
    );

    CREATE INDEX IF NOT EXISTS idx_places_source ON places(source);
    CREATE INDEX IF NOT EXISTS idx_places_category ON places(category);
    CREATE INDEX IF NOT EXISTS idx_places_name ON places(name);

    CREATE TABLE IF NOT EXISTS buddies (
      id TEXT PRIMARY KEY,
      name TEXT NOT NULL,
      area TEXT NOT NULL,
      time TEXT NOT NULL,
      note TEXT NOT NULL,
      lat REAL,
      lng REAL,
      created_at TEXT NOT NULL
    );
  `);

  // Broader activity invites (yoga, walks, stretch groups, etc.)
  const buddyCols = db.prepare("PRAGMA table_info(buddies)").all();
  if (!buddyCols.some((c) => c.name === "activity")) {
    db.exec(
      `ALTER TABLE buddies ADD COLUMN activity TEXT NOT NULL DEFAULT 'Gentle movement'`
    );
  }
  if (!buddyCols.some((c) => c.name === "interest_count")) {
    db.exec(
      `ALTER TABLE buddies ADD COLUMN interest_count INTEGER NOT NULL DEFAULT 0`
    );
  }

  return db;
}

function upsertPlace(place) {
  const stmt = getDb().prepare(`
    INSERT INTO places (
      id, source, name, category, address, lat, lng, phone, website, extras, updated_at
    ) VALUES (
      @id, @source, @name, @category, @address, @lat, @lng, @phone, @website, @extras, @updated_at
    )
    ON CONFLICT(id) DO UPDATE SET
      source = excluded.source,
      name = excluded.name,
      category = excluded.category,
      address = excluded.address,
      lat = excluded.lat,
      lng = excluded.lng,
      phone = excluded.phone,
      website = excluded.website,
      extras = excluded.extras,
      updated_at = excluded.updated_at
  `);

  stmt.run({
    id: place.id,
    source: place.source,
    name: place.name,
    category: place.category || null,
    address: place.address || null,
    lat: place.lat,
    lng: place.lng,
    phone: place.phone || null,
    website: place.website || null,
    extras:
      typeof place.extras === "string"
        ? place.extras
        : JSON.stringify(place.extras || {}),
    updated_at: place.updated_at || new Date().toISOString(),
  });
}

function upsertPlaces(places) {
  const insertMany = getDb().transaction((rows) => {
    for (const place of rows) upsertPlace(place);
  });
  insertMany(places);
}

function countPlacesBySource(source) {
  const row = getDb()
    .prepare("SELECT COUNT(*) AS count FROM places WHERE source = ?")
    .get(source);
  return row ? row.count : 0;
}

function deletePlacesBySource(source) {
  return getDb().prepare("DELETE FROM places WHERE source = ?").run(source);
}

function queryPlaces({ sources, q, category, amenity } = {}) {
  const where = [];
  const params = {};

  if (sources && sources.length) {
    const placeholders = sources.map((_, i) => `@source${i}`).join(", ");
    where.push(`source IN (${placeholders})`);
    sources.forEach((source, i) => {
      params[`source${i}`] = source;
    });
  }

  if (q && q.trim()) {
    where.push(`(name LIKE @q OR IFNULL(address, '') LIKE @q OR IFNULL(category, '') LIKE @q)`);
    params.q = `%${q.trim()}%`;
  }

  if (category && category.trim()) {
    where.push(`category = @category`);
    params.category = category.trim();
  }

  if (amenity && amenity.trim()) {
    const key = amenity.trim().toLowerCase();
    // extras is JSON text; match amenity flags stored during sync/seed
    where.push(`extras LIKE @amenity`);
    params.amenity = `%"${key}":true%`;
  }

  const sql = `
    SELECT id, source, name, category, address, lat, lng, phone, website, extras, updated_at
    FROM places
    ${where.length ? `WHERE ${where.join(" AND ")}` : ""}
    ORDER BY name COLLATE NOCASE
  `;

  return getDb()
    .prepare(sql)
    .all(params)
    .map((row) => ({
      ...row,
      extras: safeParseJson(row.extras),
    }));
}

function listCategories(sources) {
  const params = {};
  let sql = `
    SELECT DISTINCT category AS category
    FROM places
    WHERE category IS NOT NULL AND category != ''
  `;
  if (sources && sources.length) {
    const placeholders = sources.map((_, i) => `@source${i}`).join(", ");
    sql += ` AND source IN (${placeholders})`;
    sources.forEach((source, i) => {
      params[`source${i}`] = source;
    });
  }
  sql += ` ORDER BY category COLLATE NOCASE`;
  return getDb()
    .prepare(sql)
    .all(params)
    .map((row) => row.category);
}

function listBuddies() {
  return getDb()
    .prepare(
      `SELECT id, name, activity, area, time, note, lat, lng,
              interest_count AS interestCount, created_at AS createdAt
       FROM buddies
       ORDER BY CASE WHEN id LIKE 'seed-%' THEN 0 ELSE 1 END,
                created_at DESC`
    )
    .all();
}

function getBuddy(id) {
  return (
    getDb()
      .prepare(
        `SELECT id, name, activity, area, time, note, lat, lng,
                interest_count AS interestCount, created_at AS createdAt
         FROM buddies
         WHERE id = ?`
      )
      .get(id) || null
  );
}

function syncBuddyPlace(post) {
  if (
    typeof post.lat !== "number" ||
    !Number.isFinite(post.lat) ||
    typeof post.lng !== "number" ||
    !Number.isFinite(post.lng)
  ) {
    return;
  }
  const activity = post.activity || "Gentle movement";
  upsertPlace({
    id: `buddy:${post.id}`,
    source: "buddy",
    name: `${activity} (${post.area})`,
    category: "activity invite",
    address: post.area,
    lat: post.lat,
    lng: post.lng,
    phone: null,
    website: null,
    extras: {
      activity,
      time: post.time,
      note: post.note,
      buddyId: post.id,
      host: post.name,
      interestCount: post.interestCount || 0,
    },
    updated_at: post.createdAt || new Date().toISOString(),
  });
}

function insertBuddy(post) {
  getDb()
    .prepare(
      `INSERT INTO buddies (id, name, activity, area, time, note, lat, lng, interest_count, created_at)
       VALUES (@id, @name, @activity, @area, @time, @note, @lat, @lng, @interestCount, @createdAt)`
    )
    .run({
      id: post.id,
      name: post.name,
      activity: post.activity || "Gentle movement",
      area: post.area,
      time: post.time,
      note: post.note,
      lat: post.lat ?? null,
      lng: post.lng ?? null,
      interestCount: Number(post.interestCount) || 0,
      createdAt: post.createdAt,
    });

  syncBuddyPlace({
    ...post,
    interestCount: Number(post.interestCount) || 0,
  });
}

function adjustBuddyInterest(id, delta) {
  const existing = getBuddy(id);
  if (!existing) return null;
  const step = Number(delta) || 0;
  if (!step) return existing;
  getDb()
    .prepare(
      `UPDATE buddies
       SET interest_count = MAX(0, interest_count + ?)
       WHERE id = ?`
    )
    .run(step, id);
  const updated = getBuddy(id);
  if (updated) syncBuddyPlace(updated);
  return updated;
}

function incrementBuddyInterest(id) {
  return adjustBuddyInterest(id, 1);
}

function removeBuddyPlace(id) {
  getDb().prepare(`DELETE FROM places WHERE id = ?`).run(`buddy:${id}`);
}

function updateBuddy(id, fields) {
  const existing = getBuddy(id);
  if (!existing) return null;

  const next = {
    id,
    name: fields.name ?? existing.name,
    activity: fields.activity ?? existing.activity,
    area: fields.area ?? existing.area,
    time: fields.time ?? existing.time,
    note: fields.note ?? existing.note,
    lat: Object.prototype.hasOwnProperty.call(fields, "lat")
      ? fields.lat
      : existing.lat,
    lng: Object.prototype.hasOwnProperty.call(fields, "lng")
      ? fields.lng
      : existing.lng,
    interestCount: existing.interestCount,
    createdAt: existing.createdAt,
  };

  getDb()
    .prepare(
      `UPDATE buddies
       SET name = @name,
           activity = @activity,
           area = @area,
           time = @time,
           note = @note,
           lat = @lat,
           lng = @lng
       WHERE id = @id`
    )
    .run({
      id: next.id,
      name: next.name,
      activity: next.activity || "Gentle movement",
      area: next.area,
      time: next.time,
      note: next.note,
      lat: next.lat ?? null,
      lng: next.lng ?? null,
    });

  const updated = getBuddy(id);
  if (!updated) return null;

  const hasCoords =
    typeof updated.lat === "number" &&
    Number.isFinite(updated.lat) &&
    typeof updated.lng === "number" &&
    Number.isFinite(updated.lng);

  if (hasCoords) {
    syncBuddyPlace(updated);
  } else {
    removeBuddyPlace(id);
  }

  return updated;
}

function deleteBuddy(id) {
  const existing = getBuddy(id);
  if (!existing) return false;
  getDb().prepare(`DELETE FROM buddies WHERE id = ?`).run(id);
  removeBuddyPlace(id);
  return true;
}

const SEED_BUDDIES = [
  {
    id: "seed-nose-hill-walk",
    name: "Priya",
    activity: "Gentle Nose Hill walk",
    area: "Nose Hill Park",
    time: "Saturdays 10am",
    note: "Easy pace near the paved paths by the parking lot. All ages welcome.",
    lat: 51.1115,
    lng: -114.1118,
    interestCount: 4,
    createdAt: "2026-11-01T16:00:00.000Z",
  },
  {
    id: "seed-confederation-stretch",
    name: "Marcus",
    activity: "Park stretch circle",
    area: "Confederation Park",
    time: "Tuesdays 9:30am",
    note: "Seated and standing stretches on the pathway. Bring a mat if you like.",
    lat: 51.0732,
    lng: -114.0875,
    interestCount: 2,
    createdAt: "2026-11-03T15:30:00.000Z",
  },
  {
    id: "seed-campus-yoga",
    name: "Aisha",
    activity: "Campus gentle yoga",
    area: "University of Calgary — outdoor quad",
    time: "Thursdays 5pm",
    note: "Beginner-friendly outdoor yoga. Free, no signup — just show up.",
    lat: 51.0783,
    lng: -114.1335,
    interestCount: 6,
    createdAt: "2026-11-05T22:00:00.000Z",
  },
];

function seedBuddyInvites() {
  const existing = getDb().prepare(`SELECT id FROM buddies WHERE id = ?`);
  let added = 0;
  for (const seed of SEED_BUDDIES) {
    if (existing.get(seed.id)) {
      syncBuddyPlace(seed);
      continue;
    }
    insertBuddy(seed);
    added += 1;
  }
  return { added, total: SEED_BUDDIES.length };
}

function safeParseJson(value) {
  try {
    return JSON.parse(value || "{}");
  } catch {
    return {};
  }
}

function placesToGeoJson(places) {
  return {
    type: "FeatureCollection",
    features: places.map((place) => ({
      type: "Feature",
      geometry: {
        type: "Point",
        coordinates: [place.lng, place.lat],
      },
      properties: {
        id: place.id,
        source: place.source,
        name: place.name,
        category: place.category,
        address: place.address,
        phone: place.phone,
        website: place.website,
        extras: place.extras,
        updated_at: place.updated_at,
      },
    })),
  };
}

module.exports = {
  initDb,
  getDb,
  upsertPlace,
  upsertPlaces,
  countPlacesBySource,
  deletePlacesBySource,
  queryPlaces,
  listCategories,
  listBuddies,
  getBuddy,
  insertBuddy,
  updateBuddy,
  deleteBuddy,
  adjustBuddyInterest,
  incrementBuddyInterest,
  seedBuddyInvites,
  placesToGeoJson,
};
