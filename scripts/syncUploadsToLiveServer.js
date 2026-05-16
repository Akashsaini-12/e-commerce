/**
 * Upload local migrated images to live server and fix MongoDB URLs.
 *
 *   export MONGODB_URI=...
 *   export JWT_SECRET=...
 *   API_BASE=http://35.244.32.175:5001 \
 *   UPLOADS_DIR=./e-commercebackend/uploads \
 *   node scripts/syncUploadsToLiveServer.js
 */

/* eslint-disable no-console */
const fs = require("fs");
const path = require("path");
const jwt = require("jsonwebtoken");
const { MongoClient } = require("mongodb");

const MONGODB_URI = process.env.MONGODB_URI || "";
const JWT_SECRET = process.env.JWT_SECRET || "";
const API_BASE = (process.env.API_BASE || "http://35.244.32.175:5001").replace(/\/$/, "");
const UPLOADS_DIR = path.resolve(process.env.UPLOADS_DIR || "./e-commercebackend/uploads");
const CONCURRENCY = Math.max(1, parseInt(process.env.CONCURRENCY || "4", 10) || 4);
const DRY_RUN = process.env.DRY_RUN === "1";

const MIME = {
  ".jpg": "image/jpeg",
  ".jpeg": "image/jpeg",
  ".png": "image/png",
  ".webp": "image/webp",
  ".gif": "image/gif",
};

async function getAdminToken(client) {
  if (process.env.ADMIN_TOKEN) return process.env.ADMIN_TOKEN.trim();
  const user = await client.db().collection("users").findOne({ role: 0 });
  if (!user) throw new Error("No admin user (role: 0) in DB");
  return jwt.sign(
    { userId: String(user._id), email: user.email, role: user.role },
    JWT_SECRET,
    { expiresIn: "24h" },
  );
}

async function uploadFile(filePath, token) {
  const ext = path.extname(filePath).toLowerCase();
  const mime = MIME[ext] || "image/jpeg";
  const buf = fs.readFileSync(filePath);
  const form = new FormData();
  form.append("file", new Blob([buf], { type: mime }), path.basename(filePath));

  const res = await fetch(`${API_BASE}/api/upload`, {
    method: "POST",
    headers: { Authorization: `Bearer ${token}` },
    body: form,
  });

  const data = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error(data?.error || `Upload failed ${res.status}`);
  const url = data?.url ? String(data.url).trim() : "";
  if (!url) throw new Error("No url in upload response");
  return url;
}

function walkAndReplaceUrl(value, fromUrl, toUrl) {
  if (typeof value === "string" && value === fromUrl) return toUrl;
  if (Array.isArray(value)) {
    let changed = false;
    const next = value.map((v) => {
      const r = walkAndReplaceUrl(v, fromUrl, toUrl);
      if (r !== v) changed = true;
      return r;
    });
    return changed ? next : value;
  }
  if (value && typeof value === "object" && !(value instanceof Date)) {
    let changed = false;
    const next = {};
    for (const [k, v] of Object.entries(value)) {
      const r = walkAndReplaceUrl(v, fromUrl, toUrl);
      if (r !== v) changed = true;
      next[k] = r;
    }
    return changed ? next : value;
  }
  return value;
}

async function main() {
  if (!MONGODB_URI || !JWT_SECRET) {
    console.error("Set MONGODB_URI and JWT_SECRET");
    process.exit(1);
  }

  const files = fs
    .readdirSync(UPLOADS_DIR)
    .filter((f) => f.startsWith("migrated-") && fs.statSync(path.join(UPLOADS_DIR, f)).isFile());

  console.log(`Syncing ${files.length} file(s) to ${API_BASE}`);

  const client = new MongoClient(MONGODB_URI);
  await client.connect();
  const token = await getAdminToken(client);
  const db = client.db();

  const expectedPrefix = `${API_BASE}/uploads/`;
  const urlFixMap = new Map();
  let uploaded = 0;
  let failed = 0;

  let i = 0;
  async function worker() {
    while (i < files.length) {
      const file = files[i++];
      const localExpected = `${expectedPrefix}${file}`;
      const fullPath = path.join(UPLOADS_DIR, file);

      if (DRY_RUN) {
        console.log("[dry-run]", file);
        continue;
      }

      try {
        const liveUrl = await uploadFile(fullPath, token);
        if (liveUrl !== localExpected) {
          urlFixMap.set(localExpected, liveUrl);
        }
        uploaded += 1;
        if (uploaded % 25 === 0) {
          console.log(`progress ${uploaded}/${files.length}`);
        }
      } catch (err) {
        failed += 1;
        console.error("FAILED", file, err.message);
      }
    }
  }

  await Promise.all(
    Array.from({ length: Math.min(CONCURRENCY, files.length) }, () => worker()),
  );

  console.log(`Uploaded ${uploaded}, failed ${failed}, URL remaps ${urlFixMap.size}`);

  if (urlFixMap.size && !DRY_RUN) {
    const mapPath = path.join(UPLOADS_DIR, "server-url-remap.json");
    fs.writeFileSync(mapPath, JSON.stringify(Object.fromEntries(urlFixMap), null, 2));

    const collections = await db.listCollections().toArray();
    let docsFixed = 0;
    for (const { name } of collections) {
      if (name.startsWith("system.")) continue;
      const col = db.collection(name);
      // eslint-disable-next-line no-await-in-loop
      for await (const doc of col.find({})) {
        let next = doc;
        for (const [from, to] of urlFixMap) {
          next = walkAndReplaceUrl(next, from, to);
        }
        if (next !== doc) {
          const { _id, ...rest } = next;
          // eslint-disable-next-line no-await-in-loop
          await col.replaceOne({ _id: doc._id }, { ...rest, _id: doc._id });
          docsFixed += 1;
        }
      }
    }
    console.log(`DB documents updated: ${docsFixed}`);
  }

  await client.close();
  console.log("Done.");
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
