'use strict';
/**
 * Image resolution for seeding. Order: manual override -> cache -> live lookup
 * (Pexels key, Unsplash key, else keyless Wikimedia Commons). Nothing here is
 * "verified" - run `npm run images:verify` to check the stored URLs.
 */
const fs = require('fs');
const path = require('path');
const env = require('../../config/env');

const DATA = path.join(__dirname, '..', '..', 'data');
const CACHE_FILE = path.join(DATA, 'image-cache.json');
const OVERRIDE_FILE = path.join(DATA, 'image-overrides.json');

const readJson = (f, d) => { try { return JSON.parse(fs.readFileSync(f, 'utf8')); } catch (e) { return d; } };
const loadCache = () => readJson(CACHE_FILE, {});
const saveCache = (c) => fs.writeFileSync(CACHE_FILE, `${JSON.stringify(c, null, 2)}\n`);
const loadOverrides = () => readJson(OVERRIDE_FILE, { foods: {}, restaurants: {}, categories: {} });
const norm = (v) => (v ? (typeof v === 'string' ? { url: v, credit: 'manual override' } : v) : null);

async function getJson(url, headers = {}) {
  const res = await fetch(url, { headers, signal: AbortSignal.timeout(15000) });
  if (!res.ok) throw new Error(`HTTP ${res.status}`);
  return res.json();
}

async function fromPexels(q) {
  const j = await getJson(`https://api.pexels.com/v1/search?per_page=1&orientation=landscape&query=${encodeURIComponent(q)}`, { Authorization: env.PEXELS_API_KEY });
  const p = j.photos && j.photos[0];
  return p ? { url: p.src.large, credit: `Photo by ${p.photographer} on Pexels` } : null;
}
async function fromUnsplash(q) {
  const j = await getJson(`https://api.unsplash.com/search/photos?per_page=1&orientation=landscape&query=${encodeURIComponent(q)}&client_id=${env.UNSPLASH_ACCESS_KEY}`);
  const p = j.results && j.results[0];
  return p ? { url: `${p.urls.raw}&w=800&q=75&auto=format&fit=crop`, credit: `Photo by ${p.user.name} on Unsplash` } : null;
}
async function fromWikimedia(q) {
  const api = `https://commons.wikimedia.org/w/api.php?action=query&generator=search&gsrnamespace=6&gsrlimit=6&gsrsearch=${encodeURIComponent(`${q} filetype:bitmap`)}&prop=imageinfo&iiprop=url|extmetadata|mime&iiurlwidth=800&format=json&origin=*`;
  const j = await getJson(api);
  const pages = Object.values((j.query && j.query.pages) || {}).sort((a, b) => a.index - b.index);
  for (const pg of pages) {
    const ii = pg.imageinfo && pg.imageinfo[0];
    if (ii && /^image\/(jpeg|png)$/.test(ii.mime) && ii.thumburl) {
      const artist = ii.extmetadata && ii.extmetadata.Artist ? String(ii.extmetadata.Artist.value).replace(/<[^>]+>/g, '').trim() : 'Wikimedia Commons contributor';
      const lic = ii.extmetadata && ii.extmetadata.LicenseShortName ? ii.extmetadata.LicenseShortName.value : 'open licence';
      return { url: ii.thumburl, credit: `${artist} (${lic}) via Wikimedia Commons` };
    }
  }
  return null;
}

async function lookup(query) {
  if (env.PEXELS_API_KEY) return fromPexels(query);
  if (env.UNSPLASH_ACCESS_KEY) return fromUnsplash(query);
  return fromWikimedia(query);
}

/**
 * @param kind 'foods' | 'restaurants' | 'categories'
 * @returns {Promise<{url:string, credit:string, source:string}>} url is '' when nothing was found
 */
async function resolveImage(kind, slug, query, { cache, overrides, offline = false } = {}) {
  const ov = norm(overrides && overrides[kind] && overrides[kind][slug]);
  if (ov) return { ...ov, source: 'override' };
  const key = `${kind}:${slug}`;
  if (cache[key] && cache[key].url) return { ...cache[key], source: 'cache' };
  if (offline) return { url: '', credit: '', source: 'none' };
  try {
    const hit = await lookup(query);
    if (hit) { cache[key] = hit; return { ...hit, source: 'lookup' }; }
  } catch (e) {
    return { url: '', credit: '', source: `error: ${e.message}` };
  }
  return { url: '', credit: '', source: 'none' };
}

module.exports = { loadCache, saveCache, loadOverrides, resolveImage };
