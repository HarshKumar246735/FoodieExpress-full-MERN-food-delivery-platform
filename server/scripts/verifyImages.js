'use strict';
/**
 * Checks that every image URL in the cache/overrides (and, if MONGODB_URI is reachable and --db is passed,
 * every stored image in the database) answers 2xx with an image/* content type. Exits non-zero on failures.
 *   npm run images:verify [-- --db]
 */
const fs = require('fs');
const path = require('path');

const readJson = (f, d) => { try { return JSON.parse(fs.readFileSync(path.join(__dirname, '..', 'data', f), 'utf8')); } catch (e) { return d; } };

async function check(url) {
  try {
    let res = await fetch(url, { method: 'HEAD', redirect: 'follow', signal: AbortSignal.timeout(15000) });
    if (res.status === 405 || res.status === 403) res = await fetch(url, { method: 'GET', redirect: 'follow', signal: AbortSignal.timeout(20000) });
    const type = res.headers.get('content-type') || '';
    if (!res.ok) return `HTTP ${res.status}`;
    if (!/^image\//i.test(type)) return `not an image (${type || 'no content-type'})`;
    return '';
  } catch (e) { return e.message; }
}

(async () => {
  const urls = new Map();
  const cache = readJson('image-cache.json', {});
  Object.entries(cache).forEach(([k, v]) => v && v.url && urls.set(v.url, k));
  const ov = readJson('image-overrides.json', {});
  ['foods', 'restaurants', 'categories'].forEach((kind) => Object.entries(ov[kind] || {}).forEach(([slug, v]) => { const u = typeof v === 'string' ? v : v && v.url; if (u) urls.set(u, `${kind}:${slug}`); }));
  if (process.argv.includes('--db')) {
    const mongoose = require('mongoose');
    await require('../config/db')();
    const Food = require('../models/Food');
    (await Food.find({ image: /^https?:/ }).select('slug image').lean()).forEach((f) => urls.set(f.image, `foods:${f.slug}`));
    await mongoose.disconnect();
  }
  if (!urls.size) { console.log('No image URLs to check yet. Run "npm run images:fetch" first.'); return; }
  const broken = [];
  let n = 0;
  for (const [url, label] of urls) {
    n += 1;
    const err = await check(url);
    if (err) broken.push(`${label}: ${url} -> ${err}`);
  }
  console.log(`${n - broken.length}/${n} image URLs verified (2xx + image content type).`);
  if (broken.length) { console.log('BROKEN:\n - ' + broken.join('\n - ')); process.exitCode = 1; }
})();
