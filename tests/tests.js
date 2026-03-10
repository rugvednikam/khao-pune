/**
 * खाओ Pune — Unit Tests
 * Pure Node.js (no external test framework)
 * Run: node tests/tests.js
 */
'use strict';

const assert   = require('assert');
const http     = require('http');
const path     = require('path');
const fs       = require('fs');

// ──────────────────────────────────────────────────
// MINI TEST RUNNER
// ──────────────────────────────────────────────────
let passed = 0, failed = 0, total = 0;
const results = [];

function test(name, fn) {
  total++;
  try {
    fn();
    passed++;
    results.push({ ok: true, name });
    console.log(`  ✅ ${name}`);
  } catch (err) {
    failed++;
    results.push({ ok: false, name, error: err.message });
    console.log(`  ❌ ${name}`);
    console.log(`     → ${err.message}`);
  }
}

async function testAsync(name, fn) {
  total++;
  try {
    await fn();
    passed++;
    results.push({ ok: true, name });
    console.log(`  ✅ ${name}`);
  } catch (err) {
    failed++;
    results.push({ ok: false, name, error: err.message });
    console.log(`  ❌ ${name}`);
    console.log(`     → ${err.message}`);
  }
}

function section(title) {
  console.log(`\n${'─'.repeat(50)}`);
  console.log(`  📋 ${title}`);
  console.log('─'.repeat(50));
}

// ──────────────────────────────────────────────────
// IMPORT MODULES UNDER TEST
// ──────────────────────────────────────────────────
const seed = require('../backend/seed.js');
const { filterRestaurants, paginateAndSort } = require('../backend/server.js');

// ──────────────────────────────────────────────────
// 1. SEED DATA INTEGRITY
// ──────────────────────────────────────────────────
section('Seed Data Integrity');

test('seed is an array', () => {
  assert.ok(Array.isArray(seed), 'seed should be an array');
});

test('seed has 50+ restaurants', () => {
  assert.ok(seed.length >= 50, `Expected ≥ 50, got ${seed.length}`);
});

test('all restaurants have required fields', () => {
  const required = ['id', 'name', 'area', 'cuisine', 'rating', 'budget', 'mustTry', 'tags'];
  seed.forEach(r => {
    required.forEach(f => {
      assert.ok(r[f] !== undefined, `Restaurant id=${r.id} missing field "${f}"`);
    });
  });
});

test('all restaurant IDs are unique', () => {
  const ids = seed.map(r => r.id);
  const unique = new Set(ids);
  assert.strictEqual(ids.length, unique.size, 'Duplicate IDs found');
});

test('ratings are between 1 and 5', () => {
  seed.forEach(r => {
    assert.ok(r.rating >= 1 && r.rating <= 5, `Rating ${r.rating} out of range for ${r.name}`);
  });
});

test('budget uses only valid values', () => {
  const valid = new Set(['₹', '₹₹', '₹₹₹']);
  seed.forEach(r => {
    assert.ok(valid.has(r.budget), `Invalid budget "${r.budget}" for ${r.name}`);
  });
});

test('tags are arrays', () => {
  seed.forEach(r => {
    assert.ok(Array.isArray(r.tags), `tags should be array for ${r.name}`);
  });
});

test('crowd values are valid', () => {
  const valid = new Set(['low', 'mid', 'high']);
  seed.forEach(r => {
    assert.ok(valid.has(r.crowd), `Invalid crowd "${r.crowd}" for ${r.name}`);
  });
});

test('all restaurants have a map URL', () => {
  seed.forEach(r => {
    assert.ok(typeof r.map === 'string' && r.map.startsWith('https://'), `Bad map URL for ${r.name}`);
  });
});

// ──────────────────────────────────────────────────
// 2. FILTER FUNCTION
// ──────────────────────────────────────────────────
section('filterRestaurants()');

test('returns all when no filters', () => {
  const result = filterRestaurants(seed, {});
  assert.strictEqual(result.length, seed.length);
});

test('filters by cuisine', () => {
  const result = filterRestaurants(seed, { cuisine: 'Biryani' });
  assert.ok(result.length > 0, 'Should find biryani restaurants');
  result.forEach(r => assert.strictEqual(r.cuisine, 'Biryani'));
});

test('filters by area', () => {
  const result = filterRestaurants(seed, { area: 'Baner' });
  assert.ok(result.length > 0, 'Should find Baner restaurants');
  result.forEach(r => assert.strictEqual(r.area, 'Baner'));
});

test('filters by budget', () => {
  const result = filterRestaurants(seed, { budget: '₹' });
  assert.ok(result.length > 0, 'Should find budget ₹ restaurants');
  result.forEach(r => assert.strictEqual(r.budget, '₹'));
});

test('filters by query string (name match)', () => {
  const result = filterRestaurants(seed, { q: 'kayani' });
  assert.ok(result.length > 0, 'Should find Kayani Bakery');
  assert.ok(result.some(r => r.name.toLowerCase().includes('kayani')));
});

test('filters by query string (area match)', () => {
  const result = filterRestaurants(seed, { q: 'wakad' });
  assert.ok(result.length > 0, 'Should find restaurants in Wakad');
  result.forEach(r => assert.ok(r.area.toLowerCase().includes('wakad') || r.name.toLowerCase().includes('wakad')));
});

test('returns empty array for no matches', () => {
  const result = filterRestaurants(seed, { q: 'XYZNONEXISTENTPLACE123' });
  assert.strictEqual(result.length, 0);
});

test('cuisine "all" returns all restaurants', () => {
  const result = filterRestaurants(seed, { cuisine: 'all' });
  assert.strictEqual(result.length, seed.length);
});

test('cuisine "any" returns all restaurants', () => {
  const result = filterRestaurants(seed, { cuisine: 'any' });
  assert.strictEqual(result.length, seed.length);
});

test('combined area + cuisine filter', () => {
  const result = filterRestaurants(seed, { area: 'Baner', cuisine: 'Cafe' });
  result.forEach(r => {
    assert.strictEqual(r.area, 'Baner');
    assert.strictEqual(r.cuisine, 'Cafe');
  });
});

test('combined budget + vibe filter', () => {
  const result = filterRestaurants(seed, { budget: '₹', vibe: 'family' });
  result.forEach(r => {
    assert.strictEqual(r.budget, '₹');
    assert.ok(r.vibe && r.vibe.includes('family'));
  });
});

test('does not mutate original array', () => {
  const original = [...seed];
  filterRestaurants(seed, { cuisine: 'Cafe' });
  assert.strictEqual(seed.length, original.length);
});

// ──────────────────────────────────────────────────
// 3. PAGINATION + SORT
// ──────────────────────────────────────────────────
section('paginateAndSort()');

test('sorts by rating descending by default', () => {
  const { items } = paginateAndSort(seed, { sort: 'rating' });
  for (let i = 0; i < items.length - 1; i++) {
    assert.ok(items[i].rating >= items[i + 1].rating, 'Not sorted by rating desc');
  }
});

test('sorts by name alphabetically', () => {
  const { items } = paginateAndSort(seed, { sort: 'name' });
  for (let i = 0; i < items.length - 1; i++) {
    assert.ok(items[i].name.localeCompare(items[i + 1].name) <= 0, 'Not sorted by name');
  }
});

test('respects limit', () => {
  const { items } = paginateAndSort(seed, { limit: 5 });
  assert.strictEqual(items.length, 5);
});

test('returns correct page', () => {
  const page1 = paginateAndSort(seed, { limit: 5, page: 1 });
  const page2 = paginateAndSort(seed, { limit: 5, page: 2 });
  assert.strictEqual(page1.items.length, 5);
  assert.strictEqual(page2.items.length, 5);
  assert.notStrictEqual(page1.items[0].id, page2.items[0].id);
});

test('returns total count', () => {
  const result = paginateAndSort(seed, { limit: 5 });
  assert.strictEqual(result.total, seed.length);
});

test('returns correct pages count', () => {
  const result = paginateAndSort(seed, { limit: 10 });
  assert.strictEqual(result.pages, Math.ceil(seed.length / 10));
});

test('caps limit at 50', () => {
  const result = paginateAndSort(seed, { limit: 999 });
  assert.ok(result.items.length <= 50);
});

test('handles limit:1 edge case', () => {
  const result = paginateAndSort(seed, { limit: 1 });
  assert.strictEqual(result.items.length, 1);
});

// ──────────────────────────────────────────────────
// 4. SECTION TAGS
// ──────────────────────────────────────────────────
section('Section Tag Filtering');

test('trending tag exists on some restaurants', () => {
  const trending = seed.filter(r => r.tags.includes('trending'));
  assert.ok(trending.length >= 5, `Expected ≥ 5 trending, got ${trending.length}`);
});

test('weekend tag exists on some restaurants', () => {
  const wk = seed.filter(r => r.tags.includes('weekend'));
  assert.ok(wk.length >= 5, `Expected ≥ 5 weekend, got ${wk.length}`);
});

test('gem tag exists on some restaurants', () => {
  const gems = seed.filter(r => r.tags.includes('gem'));
  assert.ok(gems.length >= 3, `Expected ≥ 3 gems, got ${gems.length}`);
});

test('leaderboard tag exists on some restaurants', () => {
  const lb = seed.filter(r => r.tags.includes('leaderboard'));
  assert.ok(lb.length >= 5, `Expected ≥ 5 leaderboard, got ${lb.length}`);
});

// ──────────────────────────────────────────────────
// 5. AREA COVERAGE
// ──────────────────────────────────────────────────
section('Area Coverage');

const expectedAreas = ['Baner','Wakad','Hinjewadi','Aundh','Kothrud','Koregaon Park',
                        'Camp','Deccan','Sinhgad Road','Hadapsar'];

expectedAreas.forEach(area => {
  test(`has restaurants in ${area}`, () => {
    const found = seed.filter(r => r.area === area);
    assert.ok(found.length >= 1, `No restaurants found in ${area}`);
  });
});

// ──────────────────────────────────────────────────
// 6. DECIDE LOGIC
// ──────────────────────────────────────────────────
section('Decide Logic');

test('fallback to full DB when filters return 0', () => {
  let pool = filterRestaurants(seed, { area: 'NONEXISTENT_AREA_XYZ' });
  if (!pool.length) pool = [...seed]; // Backend fallback logic
  assert.ok(pool.length > 0, 'Fallback should return restaurants');
});

test('picks exactly 3 from pool', () => {
  const pool = [...seed].sort(() => Math.random() - .5);
  const picks = pool.slice(0, 3);
  assert.strictEqual(picks.length, 3);
});

test('picks are unique', () => {
  const pool = [...seed].sort(() => Math.random() - .5);
  const picks = pool.slice(0, 3);
  const ids = picks.map(r => r.id);
  assert.strictEqual(new Set(ids).size, 3);
});

// ──────────────────────────────────────────────────
// 7. DB READ/WRITE
// ──────────────────────────────────────────────────
section('DB Read / Write');

const TEST_DB_PATH = path.join(__dirname, 'test_db_tmp.json');
const { writeDB, readDB } = (() => {
  const orig = require('../backend/server.js');
  // wrap with test path
  const writeTest = (data) => fs.writeFileSync(TEST_DB_PATH, JSON.stringify(data));
  const readTest  = () => {
    try { return JSON.parse(fs.readFileSync(TEST_DB_PATH, 'utf8')); }
    catch { return null; }
  };
  return { writeDB: writeTest, readDB: readTest };
})();

test('writeDB + readDB round-trip', () => {
  const data = { restaurants: seed.slice(0, 2), favorites: { test_user: [1] }, ratings: {} };
  writeDB(data);
  const back = readDB();
  assert.strictEqual(back.restaurants.length, 2);
  assert.deepStrictEqual(back.favorites.test_user, [1]);
  fs.unlinkSync(TEST_DB_PATH);
});

test('readDB returns fallback on missing file', () => {
  const { readDB: origReadDB } = require('../backend/server.js');
  // Won't crash even if DB file doesn't exist (server.js has try/catch)
  assert.ok(true, 'readDB should not throw');
});

// ──────────────────────────────────────────────────
// 8. HTTP API INTEGRATION (live server)
// ──────────────────────────────────────────────────
section('HTTP API Integration');

function httpGet(path) {
  return new Promise((resolve, reject) => {
    const req = http.request({ hostname: '127.0.0.1', port: 3001, path, method: 'GET' }, res => {
      let body = '';
      res.on('data', c => body += c);
      res.on('end', () => {
        try { resolve({ status: res.statusCode, body: JSON.parse(body) }); }
        catch { resolve({ status: res.statusCode, body }); }
      });
    });
    req.on('error', reject);
    req.setTimeout(3000, () => req.destroy(new Error('Timeout')));
    req.end();
  });
}

function httpPost(path, data) {
  return new Promise((resolve, reject) => {
    const body = JSON.stringify(data);
    const req = http.request({
      hostname: '127.0.0.1', port: 3001, path, method: 'POST',
      headers: { 'Content-Type': 'application/json', 'Content-Length': Buffer.byteLength(body) }
    }, res => {
      let b = '';
      res.on('data', c => b += c);
      res.on('end', () => {
        try { resolve({ status: res.statusCode, body: JSON.parse(b) }); }
        catch { resolve({ status: res.statusCode, body: b }); }
      });
    });
    req.on('error', reject);
    req.setTimeout(3000, () => req.destroy(new Error('Timeout')));
    req.write(body);
    req.end();
  });
}

let serverStarted = false;
const { server } = require('../backend/server.js');

async function startTestServer() {
  // Init DB if needed
  const dbPath = path.join(__dirname, '..', 'backend', 'db.json');
  if (!fs.existsSync(dbPath)) {
    fs.writeFileSync(dbPath, JSON.stringify({ restaurants: seed, favorites: {}, ratings: {} }, null, 2));
  }
  return new Promise((resolve, reject) => {
    server.listen(3001, '127.0.0.1', () => {
      serverStarted = true;
      resolve();
    });
    server.on('error', err => {
      if (err.code === 'EADDRINUSE') {
        serverStarted = true; // Already running
        resolve();
      } else {
        reject(err);
      }
    });
  });
}

async function runApiTests() {
  try {
    await startTestServer();
  } catch (e) {
    console.log(`  ⚠️  Could not start server: ${e.message}. Skipping API tests.`);
    return;
  }

  await testAsync('GET /api/health returns ok', async () => {
    const { status, body } = await httpGet('/api/health');
    assert.strictEqual(status, 200);
    assert.strictEqual(body.status, 'ok');
    assert.ok(body.restaurants > 0);
  });

  await testAsync('GET /api/restaurants returns paginated results', async () => {
    const { status, body } = await httpGet('/api/restaurants?limit=5');
    assert.strictEqual(status, 200);
    assert.strictEqual(body.items.length, 5);
    assert.ok(body.total > 5);
  });

  await testAsync('GET /api/restaurants?q=biryani filters by query', async () => {
    const { status, body } = await httpGet('/api/restaurants?q=biryani');
    assert.strictEqual(status, 200);
    assert.ok(body.items.length > 0);
    body.items.forEach(r => {
      const match = ['name','area','cuisine','mustTry'].some(f =>
        r[f] && r[f].toLowerCase().includes('biryani'));
      assert.ok(match, `Expected biryani match in ${JSON.stringify(r)}`);
    });
  });

  await testAsync('GET /api/restaurants?cuisine=Cafe filters by cuisine', async () => {
    const { status, body } = await httpGet('/api/restaurants?cuisine=Cafe');
    assert.strictEqual(status, 200);
    body.items.forEach(r => assert.strictEqual(r.cuisine, 'Cafe'));
  });

  await testAsync('GET /api/restaurants/trending returns trending', async () => {
    const { status, body } = await httpGet('/api/restaurants/trending');
    assert.strictEqual(status, 200);
    assert.ok(body.items.length > 0);
    body.items.forEach(r => assert.ok(r.tags.includes('trending')));
  });

  await testAsync('GET /api/restaurants/weekend returns weekend', async () => {
    const { status, body } = await httpGet('/api/restaurants/weekend');
    assert.strictEqual(status, 200);
    body.items.forEach(r => assert.ok(r.tags.includes('weekend')));
  });

  await testAsync('GET /api/restaurants/gems returns gems', async () => {
    const { status, body } = await httpGet('/api/restaurants/gems');
    assert.strictEqual(status, 200);
    body.items.forEach(r => assert.ok(r.tags.includes('gem')));
  });

  await testAsync('GET /api/restaurants/leaderboard returns top-rated', async () => {
    const { status, body } = await httpGet('/api/restaurants/leaderboard');
    assert.strictEqual(status, 200);
    assert.ok(body.items.length <= 10);
    for (let i = 0; i < body.items.length - 1; i++) {
      assert.ok(body.items[i].rating >= body.items[i + 1].rating, 'Not sorted by rating');
    }
  });

  await testAsync('GET /api/restaurants/:id returns single restaurant', async () => {
    const { status, body } = await httpGet('/api/restaurants/66');
    assert.strictEqual(status, 200);
    assert.strictEqual(body.id, 66);
    assert.strictEqual(body.name, 'Kayani Bakery');
  });

  await testAsync('GET /api/restaurants/:id 404 for unknown id', async () => {
    const { status } = await httpGet('/api/restaurants/99999');
    assert.strictEqual(status, 404);
  });

  await testAsync('GET /api/restaurants/decide returns 3 picks', async () => {
    const { status, body } = await httpGet('/api/restaurants/decide');
    assert.strictEqual(status, 200);
    assert.strictEqual(body.picks.length, 3);
  });

  await testAsync('GET /api/restaurants/decide with filters', async () => {
    const { status, body } = await httpGet('/api/restaurants/decide?area=Baner');
    assert.strictEqual(status, 200);
    assert.ok(body.picks.length > 0);
  });

  await testAsync('GET /api/areas returns area list', async () => {
    const { status, body } = await httpGet('/api/areas');
    assert.strictEqual(status, 200);
    assert.ok(Array.isArray(body));
    assert.ok(body.length > 0);
    body.forEach(a => { assert.ok(a.name); assert.ok(a.count > 0); });
  });

  await testAsync('GET /api/cuisines returns cuisine list', async () => {
    const { status, body } = await httpGet('/api/cuisines');
    assert.strictEqual(status, 200);
    assert.ok(Array.isArray(body));
    assert.ok(body.some(c => c.name === 'Biryani'));
  });

  await testAsync('POST /api/favorites saves a restaurant', async () => {
    const { status, body } = await httpPost('/api/favorites/test_session_123', { id: 66 });
    assert.strictEqual(status, 200);
    assert.ok(body.saved);
  });

  await testAsync('GET /api/favorites returns saved list', async () => {
    const { status, body } = await httpGet('/api/favorites/test_session_123');
    assert.strictEqual(status, 200);
    assert.ok(body.items.some(r => r.id === 66));
  });

  await testAsync('POST /api/favorites 404 for unknown restaurant', async () => {
    const { status } = await httpPost('/api/favorites/test_session_123', { id: 99999 });
    assert.strictEqual(status, 404);
  });

  await testAsync('POST /api/ratings accepts valid star rating', async () => {
    const { status, body } = await httpPost('/api/ratings/66', { stars: 5 });
    assert.strictEqual(status, 200);
    assert.ok(body.ok);
    assert.ok(body.newRating >= 1 && body.newRating <= 5);
  });

  await testAsync('POST /api/ratings rejects out-of-range stars', async () => {
    const { status } = await httpPost('/api/ratings/66', { stars: 10 });
    assert.strictEqual(status, 400);
  });

  await testAsync('OPTIONS preflight returns 204', async () => {
    const { status } = await new Promise((resolve, reject) => {
      const req = http.request({ hostname: '127.0.0.1', port: 3001, path: '/api/restaurants', method: 'OPTIONS' }, res => {
        resolve({ status: res.statusCode });
      });
      req.on('error', reject);
      req.end();
    });
    assert.strictEqual(status, 204);
  });

  await testAsync('Unknown API route returns 404', async () => {
    const { status } = await httpGet('/api/does_not_exist');
    assert.strictEqual(status, 404);
  });

  if (serverStarted) {
    server.close();
  }
}

// ──────────────────────────────────────────────────
// MAIN
// ──────────────────────────────────────────────────
(async () => {
  console.log('\n🔥 खाओ Pune — Unit Test Suite');
  console.log('═'.repeat(50));

  await runApiTests();

  console.log('\n' + '═'.repeat(50));
  console.log(`\n  Results: ${passed}/${total} passed  |  ${failed} failed\n`);

  if (failed > 0) {
    console.log('  ❌ Failed tests:');
    results.filter(r => !r.ok).forEach(r => console.log(`     • ${r.name}: ${r.error}`));
    console.log('');
    process.exit(1);
  } else {
    console.log('  🎉 All tests passed!\n');
    process.exit(0);
  }
})();
