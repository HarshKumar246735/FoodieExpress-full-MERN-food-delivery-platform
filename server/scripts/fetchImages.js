'use strict';
/**
 * Fills data/image-cache.json with photo URLs for every category, restaurant and food (no database needed).
 *   npm run images:fetch            (uses PEXELS_API_KEY, else UNSPLASH_ACCESS_KEY, else keyless Wikimedia Commons)
 * Manual URLs in data/image-overrides.json always win. Re-run safely: cached entries are skipped.
 */
const { categories, restaurants, buildFoods } = require('./lib/seedData');
const { resolveImage, loadCache, saveCache, loadOverrides } = require('./lib/images');
const slugify = (s) => String(s).toLowerCase().replace(/[^\w\s-]/g, '').trim().replace(/[\s_-]+/g, '-');

(async () => {
  const cache = loadCache();
  const overrides = loadOverrides();
  const jobs = [
    ...categories.map((c) => ['categories', c.slug, `${c.name} food dish`]),
    ...restaurants.map((r) => ['restaurants', slugify(r.name), `${r.cuisines[0]} restaurant food`]),
    ...buildFoods().map((f) => ['foods', f.slug, `${f.name} ${f.isVeg ? 'vegetarian' : ''} dish`.trim()]),
  ];
  let ok = 0; const failed = [];
  for (const [kind, slug, q] of jobs) {
    const r = await resolveImage(kind, slug, q, { cache, overrides });
    if (r.url) ok += 1; else failed.push(`${kind}:${slug} (${r.source})`);
    if (r.source === 'lookup') saveCache(cache);
    if (r.source === 'lookup') await new Promise((res) => setTimeout(res, 250)); // be polite to the API
  }
  saveCache(cache);
  console.log(`${ok}/${jobs.length} images resolved.`);
  if (failed.length) { console.log(`No image for ${failed.length} item(s). Add them to data/image-overrides.json:\n - ${failed.join('\n - ')}`); process.exitCode = 1; }
})();
