/**
 * One-time migration: Cloudinary URLs → your server /uploads + MongoDB update
 *
 * Run on the machine where your Node backend + uploads folder live (NOT in browser).
 *
 * Prerequisites:
 *   - Cloudinary account still active (download images BEFORE deactivation)
 *   - MongoDB reachable (same MONGODB_URI as backend)
 *   - uploads/ folder exists (same path your multer uses)
 *
 * Usage (from backend folder, recommended):
 *   cd e-commercebackend
 *   npm install mongodb          # if not already in backend
 *   MONGODB_URI="mongodb://..." \
 *   PUBLIC_BASE_URL="https://api.smalcouture.com" \
 *   UPLOADS_DIR="./uploads" \
 *   node ../scripts/migrateCloudinaryToLocal.js
 *
 * Dry run (only lists URLs, no download/write):
 *   DRY_RUN=1 node ../scripts/migrateCloudinaryToLocal.js
 *
 * Env:
 *   MONGODB_URI       - required
 *   PUBLIC_BASE_URL   - e.g. https://api.smalcouture.com (no trailing slash)
 *   UPLOADS_DIR       - default ./uploads (relative to cwd)
 *   DRY_RUN=1         - preview only
 */

/* eslint-disable no-console */
const fs = require("fs");
const path = require("path");
const crypto = require("crypto");
const { MongoClient } = require("mongodb");

const MONGODB_URI = process.env.MONGODB_URI || "";
const PUBLIC_BASE_URL = (process.env.PUBLIC_BASE_URL || "http://localhost:4000").replace(
  /\/$/,
  "",
);
const UPLOADS_DIR = path.resolve(process.env.UPLOADS_DIR || "./uploads");
const DRY_RUN = process.env.DRY_RUN === "1" || process.env.DRY_RUN === "true";
const CONCURRENCY = Math.max(1, parseInt(process.env.CONCURRENCY || "3", 10) || 3);

const CLOUDINARY_HOST = /res\.cloudinary\.com/i;

/** @type {Map<string, string>} oldUrl -> newUrl */
const urlMap = new Map();

function isCloudinaryUrl(value) {
  return typeof value === "string" && CLOUDINARY_HOST.test(value);
}

function extFromUrl(url) {
  try {
    const u = new URL(url);
    const base = path.basename(u.pathname);
    const m = base.match(/\.(jpe?g|png|webp|gif|avif)$/i);
    if (m) return m[0].toLowerCase();
  } catch {
    /* ignore */
  }
  return ".jpg";
}

function safeFilename(url) {
  const hash = crypto.createHash("sha1").update(url).digest("hex").slice(0, 16);
  return `migrated-${hash}${extFromUrl(url)}`;
}

/**
 * Strip Cloudinary transforms so we download the best original when possible.
 * https://res.cloudinary.com/cloud/image/upload/f_auto,w_640/v123/id.png
 *   → https://res.cloudinary.com/cloud/image/upload/v123/id.png
 */
function normalizeCloudinaryDownloadUrl(url) {
  const trimmed = String(url || "").trim();
  const m = trimmed.match(
    /^(https?:\/\/res\.cloudinary\.com\/[^/]+\/image\/upload\/)(.+)$/i,
  );
  if (!m) return trimmed;

  const prefix = m[1];
  const rest = m[2].split("?")[0];
  const parts = rest.split("/");

  const versionIdx = parts.findIndex((p) => /^v\d+$/i.test(p));
  if (versionIdx >= 0) {
    return prefix + parts.slice(versionIdx).join("/");
  }
  return trimmed;
}

async function downloadToUploads(cloudinaryUrl) {
  const cached = urlMap.get(cloudinaryUrl);
  if (cached) return cached;

  const downloadUrl = normalizeCloudinaryDownloadUrl(cloudinaryUrl);
  const filename = safeFilename(downloadUrl);
  const diskPath = path.join(UPLOADS_DIR, filename);
  const publicUrl = `${PUBLIC_BASE_URL}/uploads/${filename}`;

  if (DRY_RUN) {
    console.log("[dry-run] would migrate:", cloudinaryUrl, "→", publicUrl);
    urlMap.set(cloudinaryUrl, publicUrl);
    return publicUrl;
  }

  if (!fs.existsSync(UPLOADS_DIR)) {
    fs.mkdirSync(UPLOADS_DIR, { recursive: true });
  }

  if (!fs.existsSync(diskPath)) {
    const res = await fetch(downloadUrl, { redirect: "follow" });
    if (!res.ok) {
      throw new Error(`Download failed ${res.status} for ${downloadUrl}`);
    }
    const buf = Buffer.from(await res.arrayBuffer());
    fs.writeFileSync(diskPath, buf);
    console.log("saved:", diskPath);
  } else {
    console.log("exists, skip download:", diskPath);
  }

  urlMap.set(cloudinaryUrl, publicUrl);
  return publicUrl;
}

function walkAndReplace(value) {
  if (isCloudinaryUrl(value)) {
    const mapped = urlMap.get(value);
    return mapped !== undefined ? mapped : value;
  }
  if (Array.isArray(value)) {
    let changed = false;
    const next = value.map((item) => {
      const r = walkAndReplace(item);
      if (r !== item) changed = true;
      return r;
    });
    return changed ? next : value;
  }
  if (value && typeof value === "object" && !(value instanceof Date)) {
    let changed = false;
    const next = {};
    for (const [k, v] of Object.entries(value)) {
      const r = walkAndReplace(v);
      if (r !== v) changed = true;
      next[k] = r;
    }
    return changed ? next : value;
  }
  return value;
}

function collectCloudinaryUrls(value, out = new Set()) {
  if (isCloudinaryUrl(value)) {
    out.add(value);
    return out;
  }
  if (Array.isArray(value)) {
    for (const item of value) collectCloudinaryUrls(item, out);
  } else if (value && typeof value === "object" && !(value instanceof Date)) {
    for (const v of Object.values(value)) collectCloudinaryUrls(v, out);
  }
  return out;
}

async function pool(items, limit, fn) {
  const results = [];
  let i = 0;
  async function worker() {
    while (i < items.length) {
      const idx = i++;
      results[idx] = await fn(items[idx], idx);
    }
  }
  await Promise.all(Array.from({ length: Math.min(limit, items.length) }, worker));
  return results;
}

async function main() {
  if (!MONGODB_URI) {
    console.error("Set MONGODB_URI (same as your backend .env)");
    process.exit(1);
  }

  const client = new MongoClient(MONGODB_URI);
  await client.connect();
  const db = client.db();

  const allUrls = new Set();
  const docsByCollection = [];

  const collections = await db.listCollections().toArray();
  for (const { name } of collections) {
    if (name.startsWith("system.")) continue;
    const col = db.collection(name);
    const cursor = col.find({});
    // eslint-disable-next-line no-await-in-loop
    for await (const doc of cursor) {
      const urls = collectCloudinaryUrls(doc);
      if (urls.size) {
        docsByCollection.push({ name, doc, urls });
        for (const u of urls) allUrls.add(u);
      }
    }
  }

  console.log(`Found ${allUrls.size} unique Cloudinary URL(s) in ${docsByCollection.length} document(s)`);
  if (!allUrls.size) {
    await client.close();
    console.log("Nothing to migrate.");
    return;
  }

  const urlList = [...allUrls];
  await pool(urlList, CONCURRENCY, async (url) => {
    try {
      await downloadToUploads(url);
    } catch (err) {
      console.error("FAILED download:", url, err.message);
    }
  });

  const mapPath = path.join(UPLOADS_DIR, "cloudinary-migration-map.json");
  if (!DRY_RUN) {
    fs.writeFileSync(
      mapPath,
      JSON.stringify(Object.fromEntries(urlMap), null, 2),
      "utf8",
    );
    console.log("Wrote URL map:", mapPath);
  }

  let updatedDocs = 0;
  for (const { name, doc } of docsByCollection) {
    const next = walkAndReplace(doc);
    if (next === doc) continue;

    if (DRY_RUN) {
      console.log("[dry-run] would update", name, String(doc._id));
      updatedDocs += 1;
      continue;
    }

    const { _id, ...rest } = next;
    // eslint-disable-next-line no-await-in-loop
    await db.collection(name).replaceOne({ _id: doc._id }, { ...rest, _id: doc._id });
    updatedDocs += 1;
    console.log("updated", name, String(doc._id));
  }

  await client.close();
  console.log(`Done. Updated ${updatedDocs} document(s). Migrated ${urlMap.size} URL(s).`);
  if (DRY_RUN) console.log("This was a dry run. Run again without DRY_RUN=1 to apply.");
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
