/*
 * One-off helper script:
 * - Reads images from /public/cdn/shop/products
 * - Uploads each image to your backend (/api/upload)
 * - Inserts catalog products via admin API
 *
 * Usage:
 *   1) Backend running on PORT (default 4000)
 *   2) Set ADMIN_TOKEN in env (JWT from admin login) OR pass as 2nd arg
 *   3) node scripts/uploadLocalProductsToServer.js
 *
 * Assumptions:
 * - Filenames are like "1_red_1.jpg", "1_red_2.jpg", "2_blue_1.jpg" etc.
 * - Number before first "_" is product index (1 product per number)
 * - Middle part (between first and second "_") is color name
 * - All images with same "<index>_<color>_" become one variant
 */

/* eslint-disable no-console */

const path = require("path");
const fs = require("fs");
const FormData = require("form-data");
const fetch = require("node-fetch");

const API_BASE = process.env.API_BASE || "http://localhost:4000";
const ADMIN_TOKEN = process.env.ADMIN_TOKEN || process.argv[2] || "";

const PRODUCTS_DIR = path.join(
  __dirname,
  "..",
  "public",
  "cdn",
  "shop",
  "products",
);

function parseFileName(file) {
  const base = file.replace(/\.[^.]+$/, "");
  const parts = base.split("_");
  if (parts.length < 2) return null;
  const productKey = parts[0];
  const colorKey = parts[1];
  return { productKey, colorKey };
}

async function uploadFileToServer(fullPath) {
  const form = new FormData();
  form.append("file", fs.createReadStream(fullPath));

  const headers = { ...form.getHeaders() };
  if (ADMIN_TOKEN) {
    headers.Authorization = `Bearer ${ADMIN_TOKEN}`;
  }

  const res = await fetch(`${API_BASE}/api/upload`, {
    method: "POST",
    headers,
    body: form,
  });

  const text = await res.text();
  let data;
  try {
    data = text ? JSON.parse(text) : null;
  } catch {
    data = { error: text };
  }

  if (!res.ok) {
    throw new Error(
      `Upload failed: ${res.status} ${data?.error || text || "unknown"}`,
    );
  }

  const url = data?.url ? String(data.url).trim() : "";
  if (!url) throw new Error("No URL returned from server");
  return url;
}

async function main() {
  if (!ADMIN_TOKEN) {
    console.error(
      "ADMIN_TOKEN required. Login as admin in the app, copy JWT from localStorage.token, then:",
    );
    console.error(
      "  ADMIN_TOKEN=your_jwt node scripts/uploadLocalProductsToServer.js",
    );
    process.exit(1);
  }

  if (!fs.existsSync(PRODUCTS_DIR)) {
    console.error("Products folder not found:", PRODUCTS_DIR);
    process.exit(1);
  }

  const files = fs
    .readdirSync(PRODUCTS_DIR)
    .filter((f) => /\.(jpe?g|png|webp)$/i.test(f));

  if (!files.length) {
    console.log("No images found in", PRODUCTS_DIR);
    return;
  }

  const grouped = {};

  for (const file of files) {
    const parsed = parseFileName(file);
    if (!parsed) continue;
    const { productKey, colorKey } = parsed;
    if (!grouped[productKey]) {
      grouped[productKey] = {};
    }
    if (!grouped[productKey][colorKey]) {
      grouped[productKey][colorKey] = [];
    }
    grouped[productKey][colorKey].push(file);
  }

  const allProducts = [];
  const productKeys = Object.keys(grouped).sort();
  const limitedKeys = productKeys.slice(0, 10);

  for (const productKey of limitedKeys) {
    const colorGroups = grouped[productKey];
    const variants = [];

    for (const colorKey of Object.keys(colorGroups)) {
      const imageFiles = colorGroups[colorKey];

      const uploadedUrls = [];
      for (const file of imageFiles) {
        const fullPath = path.join(PRODUCTS_DIR, file);
        console.log("Uploading to server:", fullPath);
        // eslint-disable-next-line no-await-in-loop
        const url = await uploadFileToServer(fullPath);
        uploadedUrls.push(url);
      }

      variants.push({
        color: colorKey,
        colorCode: "#000000",
        sizes: [
          {
            size: "M",
            stock: 1,
          },
        ],
        images: uploadedUrls,
      });
    }

    const productName = `Product ${productKey}`;
    const base = String(productName)
      .toLowerCase()
      .trim()
      .replace(/[^a-z0-9]+/g, "-")
      .replace(/^-+|-+$/g, "") || "product";

    allProducts.push({
      name: productName,
      slug: base,
      price: 0,
      discountPrice: 0,
      description: `Auto imported product ${productKey}`,
      categoryId: 1,
      variants,
      rating: 0,
      numReviews: 0,
      isFeatured: false,
      status: "active",
    });
  }

  for (const product of allProducts) {
    try {
      const res = await fetch(`${API_BASE}/api/admin/catalog-products`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${ADMIN_TOKEN}`,
        },
        body: JSON.stringify(product),
      });
      if (!res.ok) {
        const text = await res.text();
        console.error("Failed to insert product", product.name, res.status, text);
      } else {
        const saved = await res.json();
        console.log("Inserted product:", saved.name, "id:", saved._id);
      }
    } catch (e) {
      console.error("Error inserting product", product.name, e.message);
    }
  }
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
