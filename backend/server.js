/**
 * खाओ Pune — Backend Server
 * Pure Node.js, zero npm dependencies
 * JSON file as persistent storage
 */

'use strict';

const http = require('http');
const fs   = require('fs');
const path = require('path');
const url  = require('url');

// ──────────────────────────────────────────────
// CONFIG
// ──────────────────────────────────────────────
const PORT        = process.env.PORT || 3001;
const DB_PATH     = path.join(__dirname, 'db.json');

// CORS_ORIGIN can be a comma-separated list or '*'
// e.g. CORS_ORIGIN=https://testy-pune.netlify.app
const CORS_ORIGINS = (process.env.CORS_ORIGIN || '*')
  .split(',').map(s => s.trim()).filter(Boolean);

// ──────────────────────────────────────────────
// DB HELPERS
// ──────────────────────────────────────────────
function readDB() {
  try {
    return JSON.parse(fs.readFileSync(DB_PATH, 'utf8'));
  } catch {
    return { restaurants: [], favorites: {}, ratings: {} };
  }
}

function writeDB(data) {
  fs.writeFileSync(DB_PATH, JSON.stringify(data, null, 2));
}

// ──────────────────────────────────────────────
// CORS + JSON RESPONSE HELPERS
// ──────────────────────────────────────────────
function setCORS(res, req) {
  const origin = req && req.headers && req.headers.origin;
  // Allow '*' wildcard or match against the whitelist
  const allowed = CORS_ORIGINS.includes('*')
    ? '*'
    : (CORS_ORIGINS.includes(origin) ? origin : CORS_ORIGINS[0]);
  res.setHeader('Access-Control-Allow-Origin', allowed);
  res.setHeader('Access-Control-Allow-Methods', 'GET,POST,DELETE,OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
  if (!CORS_ORIGINS.includes('*') && origin) {
    res.setHeader('Vary', 'Origin');
  }
}

function json(res, data, status = 200) {
  res.writeHead(status, { 'Content-Type': 'application/json' });
  res.end(JSON.stringify(data));
}

function err(res, msg, status = 400) {
  json(res, { error: msg }, status);
}

function readBody(req) {
  return new Promise((resolve, reject) => {
    let body = '';
    req.on('data', chunk => { body += chunk; });
    req.on('end', () => {
      try { resolve(JSON.parse(body || '{}')); }
      catch { resolve({}); }
    });
    req.on('error', reject);
  });
}

// ──────────────────────────────────────────────
// RESTAURANT HELPERS
// ──────────────────────────────────────────────
function filterRestaurants(restaurants, query) {
  const { q, cuisine, area, budget, vibe } = query;
  let result = [...restaurants];

  if (q) {
    const lq = q.toLowerCase();
    result = result.filter(r =>
      r.name.toLowerCase().includes(lq) ||
      r.area.toLowerCase().includes(lq) ||
      r.cuisine.toLowerCase().includes(lq) ||
      (r.mustTry && r.mustTry.toLowerCase().includes(lq)) ||
      (r.desc && r.desc.toLowerCase().includes(lq))
    );
  }
  if (cuisine && cuisine !== 'all' && cuisine !== 'any') {
    result = result.filter(r => r.cuisine === cuisine);
  }
  if (area && area !== 'any') {
    result = result.filter(r => r.area === area);
  }
  if (budget && budget !== 'any') {
    result = result.filter(r => r.budget === budget);
  }
  if (vibe && vibe !== 'any') {
    result = result.filter(r => r.vibe && r.vibe.includes(vibe));
  }

  return result;
}

function paginateAndSort(arr, query) {
  const { sort = 'rating', page = 1, limit = 20 } = query;
  const p = Math.max(1, parseInt(page));
  const l = Math.min(200, Math.max(1, parseInt(limit)));

  let sorted = [...arr];
  if (sort === 'rating') sorted.sort((a, b) => b.rating - a.rating);
  else if (sort === 'reviews') sorted.sort((a, b) => b.reviews - a.reviews);
  else if (sort === 'name') sorted.sort((a, b) => a.name.localeCompare(b.name));

  const total  = sorted.length;
  const start  = (p - 1) * l;
  const items  = sorted.slice(start, start + l);

  return { items, total, page: p, limit: l, pages: Math.ceil(total / l) };
}

// ──────────────────────────────────────────────
// ROUTER
// ──────────────────────────────────────────────
async function router(req, res) {
  const parsed   = url.parse(req.url, true);
  const pathname = parsed.pathname.replace(/\/$/, '') || '/';
  const query    = parsed.query;
  const method   = req.method.toUpperCase();

  setCORS(res, req);
  if (method === 'OPTIONS') { res.writeHead(204); res.end(); return; }

  const db = readDB();

  // ── Health check ──────────────────────────
  if (pathname === '/api/health' && method === 'GET') {
    return json(res, { status: 'ok', timestamp: new Date().toISOString(), restaurants: db.restaurants.length });
  }

  // ── GET /api/restaurants ──────────────────
  if (pathname === '/api/restaurants' && method === 'GET') {
    const filtered = filterRestaurants(db.restaurants, query);
    const result   = paginateAndSort(filtered, query);
    return json(res, result);
  }

  // ── GET /api/restaurants/trending ─────────
  if (pathname === '/api/restaurants/trending' && method === 'GET') {
    const items = db.restaurants.filter(r => r.tags.includes('trending'))
      .sort((a, b) => b.rating - a.rating).slice(0, parseInt(query.limit) || 8);
    return json(res, { items, total: items.length });
  }

  // ── GET /api/restaurants/weekend ──────────
  if (pathname === '/api/restaurants/weekend' && method === 'GET') {
    const items = db.restaurants.filter(r => r.tags.includes('weekend'))
      .sort((a, b) => b.rating - a.rating).slice(0, parseInt(query.limit) || 8);
    return json(res, { items, total: items.length });
  }

  // ── GET /api/restaurants/gems ──────────────
  if (pathname === '/api/restaurants/gems' && method === 'GET') {
    const items = db.restaurants.filter(r => r.tags.includes('gem'))
      .sort((a, b) => b.rating - a.rating).slice(0, parseInt(query.limit) || 8);
    return json(res, { items, total: items.length });
  }

  // ── GET /api/restaurants/leaderboard ──────
  if (pathname === '/api/restaurants/leaderboard' && method === 'GET') {
    const items = [...db.restaurants].sort((a, b) => b.rating - a.rating)
      .slice(0, parseInt(query.limit) || 10);
    return json(res, { items, total: items.length });
  }

  // ── GET /api/restaurants/decide ───────────
  if (pathname === '/api/restaurants/decide' && method === 'GET') {
    let pool = filterRestaurants(db.restaurants, query);
    if (!pool.length) pool = [...db.restaurants];
    // Fisher-Yates shuffle
    for (let i = pool.length - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1));
      [pool[i], pool[j]] = [pool[j], pool[i]];
    }
    const picks = pool.slice(0, 3);
    return json(res, { picks, total: pool.length });
  }

  // ── GET /api/restaurants/:id ──────────────
  const detailMatch = pathname.match(/^\/api\/restaurants\/(\d+)$/);
  if (detailMatch && method === 'GET') {
    const r = db.restaurants.find(x => x.id === parseInt(detailMatch[1]));
    if (!r) return err(res, 'Restaurant not found', 404);
    return json(res, r);
  }

  // ── GET /api/areas ─────────────────────────
  if (pathname === '/api/areas' && method === 'GET') {
    const areas = [...new Set(db.restaurants.map(r => r.area))].sort();
    const withCounts = areas.map(name => ({
      name,
      count: db.restaurants.filter(r => r.area === name).length,
    }));
    return json(res, withCounts);
  }

  // ── GET /api/cuisines ──────────────────────
  if (pathname === '/api/cuisines' && method === 'GET') {
    const cuisines = [...new Set(db.restaurants.map(r => r.cuisine))].sort();
    const withCounts = cuisines.map(name => ({
      name,
      count: db.restaurants.filter(r => r.cuisine === name).length,
    }));
    return json(res, withCounts);
  }

  // ── GET /api/favorites/:sessionId ─────────
  const favGetMatch = pathname.match(/^\/api\/favorites\/([a-zA-Z0-9_-]+)$/);
  if (favGetMatch && method === 'GET') {
    const sid  = favGetMatch[1];
    const ids  = db.favorites[sid] || [];
    const items = ids.map(id => db.restaurants.find(r => r.id === id)).filter(Boolean);
    return json(res, { items, total: items.length });
  }

  // ── POST /api/favorites/:sessionId ────────
  if (favGetMatch && method === 'POST') {
    const sid  = favGetMatch[1];
    const body = await readBody(req);
    if (!body.id || typeof body.id !== 'number') return err(res, 'id required');
    if (!db.restaurants.find(r => r.id === body.id)) return err(res, 'Restaurant not found', 404);
    if (!db.favorites[sid]) db.favorites[sid] = [];
    if (!db.favorites[sid].includes(body.id)) {
      db.favorites[sid].push(body.id);
      writeDB(db);
    }
    return json(res, { saved: true, total: db.favorites[sid].length });
  }

  // ── DELETE /api/favorites/:sessionId/:restId ──
  const favDelMatch = pathname.match(/^\/api\/favorites\/([a-zA-Z0-9_-]+)\/(\d+)$/);
  if (favDelMatch && method === 'DELETE') {
    const sid = favDelMatch[1];
    const rid = parseInt(favDelMatch[2]);
    if (db.favorites[sid]) {
      db.favorites[sid] = db.favorites[sid].filter(id => id !== rid);
      writeDB(db);
    }
    return json(res, { removed: true });
  }

  // ── POST /api/ratings/:id ─────────────────
  const rateMatch = pathname.match(/^\/api\/ratings\/(\d+)$/);
  if (rateMatch && method === 'POST') {
    const id   = parseInt(rateMatch[1]);
    const body = await readBody(req);
    const stars = parseFloat(body.stars);
    if (!stars || stars < 1 || stars > 5) return err(res, 'stars must be 1–5');
    if (!db.ratings[id]) db.ratings[id] = [];
    db.ratings[id].push({ stars, ts: Date.now() });
    // Update restaurant average
    const r = db.restaurants.find(x => x.id === id);
    if (r) {
      const all = db.ratings[id];
      r.rating = Math.round((all.reduce((s, x) => s + x.stars, 0) / all.length) * 10) / 10;
      r.reviews = all.length;
    }
    writeDB(db);
    return json(res, { ok: true, newRating: r ? r.rating : null });
  }

  // ── Static frontend files ──────────────────
  if (method === 'GET' && !pathname.startsWith('/api/')) {
    const frontendDir = path.join(__dirname, '..', 'frontend');
    let filePath = path.join(frontendDir, pathname === '/' ? 'index.html' : pathname);
    // Security: prevent path traversal
    if (!filePath.startsWith(frontendDir)) return err(res, 'Forbidden', 403);

    const extMap = {
      '.html': 'text/html', '.css': 'text/css', '.js': 'application/javascript',
      '.json': 'application/json', '.png': 'image/png', '.svg': 'image/svg+xml',
      '.ico': 'image/x-icon', '.webp': 'image/webp',
    };
    const ext  = path.extname(filePath);
    const mime = extMap[ext] || 'application/octet-stream';

    try {
      const data = fs.readFileSync(filePath);
      res.writeHead(200, { 'Content-Type': mime });
      res.end(data);
    } catch {
      // SPA fallback
      try {
        const index = fs.readFileSync(path.join(frontendDir, 'index.html'));
        res.writeHead(200, { 'Content-Type': 'text/html' });
        res.end(index);
      } catch {
        err(res, 'Not found', 404);
      }
    }
    return;
  }

  err(res, 'Not found', 404);
}

// ──────────────────────────────────────────────
// BOOT
// ──────────────────────────────────────────────
const server = http.createServer(router);

if (require.main === module) {
  // Init DB if empty
  if (!fs.existsSync(DB_PATH)) {
    const seed = require('./seed.js');
    writeDB({ restaurants: seed, favorites: {}, ratings: {} });
    console.log(`✅ Database seeded with ${seed.length} restaurants`);
  }

  server.listen(PORT, () => {
    console.log(`🔥 खाओ Pune backend running at http://localhost:${PORT}`);
    console.log(`   Serving frontend from ../frontend/`);
  });
}

module.exports = { server, router, filterRestaurants, paginateAndSort, readDB, writeDB };
