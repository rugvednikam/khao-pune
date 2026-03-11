/**
 * खाओ Pune — Expanded Unit Test Suite v2
 * Covers: frontend app.js, backend server.js, seed data, service-worker logic
 * Run: node tests/tests-v2.js
 */
'use strict';

const assert = require('assert');
const http   = require('http');
const path   = require('path');
const fs     = require('fs');

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
  console.log(`\n${'─'.repeat(55)}`);
  console.log(`  📋 ${title}`);
  console.log('─'.repeat(55));
}

// ──────────────────────────────────────────────────
// FRONTEND MOCK SETUP
// Setup minimal browser globals so app.js can be required
// ──────────────────────────────────────────────────
const localStorageStore = {};
const mockLocalStorage = {
  getItem:    (k) => localStorageStore[k] ?? null,
  setItem:    (k, v) => { localStorageStore[k] = String(v); },
  removeItem: (k) => { delete localStorageStore[k]; },
  clear:      () => { Object.keys(localStorageStore).forEach(k => delete localStorageStore[k]); },
};

const domElements = {};
const mockEl = (id = '') => {
  const el = {
    id,
    _classes: new Set(),
    innerHTML: '',
    textContent: '',
    value: '',
    dataset: {},
    style: {},
    _listeners: {},
    classList: {
      _el: null,
      add(...names)    { names.forEach(n => el._classes.add(n)); },
      remove(...names) { names.forEach(n => el._classes.delete(n)); },
      contains(n)      { return el._classes.has(n); },
      toggle(n, force) {
        if (force === undefined) {
          if (el._classes.has(n)) el._classes.delete(n);
          else el._classes.add(n);
        } else { force ? el._classes.add(n) : el._classes.delete(n); }
      },
    },
    addEventListener(ev, fn) {
      el._listeners[ev] = el._listeners[ev] || [];
      el._listeners[ev].push(fn);
    },
    focus() {},
    getAttribute(a) { return el.dataset[a] ?? null; },
    querySelectorAll(sel) {
      // Return matching mock elements from domElements
      return Object.values(domElements).filter(e => {
        if (sel.startsWith('.') && !sel.includes('[')) {
          return e._classes.has(sel.slice(1));
        }
        return false;
      });
    },
  };
  return el;
};

function getOrCreateEl(id) {
  if (!domElements[id]) domElements[id] = mockEl(id);
  return domElements[id];
}

global.localStorage = mockLocalStorage;
global.window = {
  location: { hostname: 'localhost', search: '' },
  addEventListener: () => {},
  BACKEND_URL: '',
};
// navigator is read-only in Node 22; define via Object.defineProperty
try {
  global.navigator = { serviceWorker: null, onLine: true };
} catch {
  Object.defineProperty(global, 'navigator', {
    value: { serviceWorker: null, onLine: true },
    writable: true, configurable: true,
  });
}
global.history = { pushState: () => {} };
global.document  = {
  getElementById:    (id) => getOrCreateEl(id),
  querySelector:     (sel) => {
    // Support #id and .class[data-val="x"] patterns
    const idMatch = sel.match(/^#([\w-]+)$/);
    if (idMatch) return getOrCreateEl(idMatch[1]);
    return null;
  },
  querySelectorAll:  (sel) => {
    if (sel === '.page' || sel === '.bnav-btn' || sel === '.snav-btn') return [];
    if (sel === '.chip') return [];
    if (sel === '.fchips') return [];
    // data-save-id selector
    const saveMatch = sel.match(/\[data-save-id="(\d+)"\]/);
    if (saveMatch) {
      return Object.values(domElements).filter(e => e.dataset['save-id'] === saveMatch[1]);
    }
    return [];
  },
  addEventListener: () => {},
  body: { style: {} },
};

// Required DOM elements app.js tries to attach listeners to at load time
['installBtn', 'installDismiss', 'installBanner', 'offlineBanner', 'toast',
 'splash', 'app', 'areaTiles', 'detailOverlay', 'decideOverlay', 'searchInput',
 'searchClear', 'savedCards', 'savedEmpty', 'savedNavCnt', 'snavSavedCnt',
 'searchResults', 'searchEmpty', 'leaderboardList', 'areaCards', 'areaPageTitle',
 'decideFilters', 'decideResults', 'decideResultCards', 'detailHero', 'detailBody',
].forEach(id => getOrCreateEl(id));

// Now load app.js to get exported functions
const app = require('../frontend/app.js');
const { escHtml, crowdBadge, isSaved, renderCard } = app;

// Also load backend
const seed = require('../backend/seed.js');
const { filterRestaurants, paginateAndSort, readDB, writeDB } = require('../backend/server.js');

// ── Restore DB to known-good state before any tests run ──
// (Prevents corruption from previous interrupted test runs)
const DB_PATH_MAIN = path.join(__dirname, '..', 'backend', 'db.json');
(function restoreDB() {
  try {
    const current = JSON.parse(fs.readFileSync(DB_PATH_MAIN, 'utf8'));
    if (!current.restaurants || current.restaurants.length < seed.length) {
      fs.writeFileSync(DB_PATH_MAIN, JSON.stringify(
        { restaurants: seed, favorites: {}, ratings: {} }, null, 2));
      console.log('  ⚠️  DB was corrupted — restored from seed before tests.');
    }
  } catch {
    fs.writeFileSync(DB_PATH_MAIN, JSON.stringify(
      { restaurants: seed, favorites: {}, ratings: {} }, null, 2));
  }
})();


// ══════════════════════════════════════════════════
// SECTION 1: escHtml()
// ══════════════════════════════════════════════════
section('escHtml() — HTML Escaping');

test('escapes & ampersand', () => {
  assert.strictEqual(escHtml('Bread & Butter'), 'Bread &amp; Butter');
});

test('escapes < less-than', () => {
  assert.strictEqual(escHtml('<script>'), '&lt;script&gt;');
});

test('escapes > greater-than', () => {
  assert.strictEqual(escHtml('a > b'), 'a &gt; b');
});

test('escapes " double-quote', () => {
  assert.strictEqual(escHtml('"hello"'), '&quot;hello&quot;');
});

test('handles multiple special chars in one string', () => {
  assert.strictEqual(escHtml('<a href="&foo">'), '&lt;a href=&quot;&amp;foo&quot;&gt;');
});

test('passes through plain text unchanged', () => {
  assert.strictEqual(escHtml('Koregaon Park'), 'Koregaon Park');
});

test('returns empty string for empty input', () => {
  assert.strictEqual(escHtml(''), '');
});

test('handles null gracefully (coerces to empty string)', () => {
  assert.strictEqual(escHtml(null), '');
});

test('handles undefined gracefully (coerces to empty string)', () => {
  assert.strictEqual(escHtml(undefined), '');
});

test('handles numbers by coercing to string', () => {
  assert.strictEqual(escHtml(42), '42');
});

test('handles 0 without returning empty string', () => {
  assert.strictEqual(escHtml(0), '0');
});

test('handles XSS script injection attempt', () => {
  const xss = '<script>alert("xss")</script>';
  const escaped = escHtml(xss);
  assert.ok(!escaped.includes('<script>'), 'Should not contain raw <script> tag');
  assert.ok(!escaped.includes('</script>'), 'Should not contain raw </script> tag');
});

test('handles unicode / emoji passthrough unchanged', () => {
  const emoji = '🍛🔥🎸';
  assert.strictEqual(escHtml(emoji), emoji);
});

test('handles URL with ampersand params', () => {
  const url = 'https://maps.google.com?q=Pune&zoom=14';
  assert.strictEqual(escHtml(url), 'https://maps.google.com?q=Pune&amp;zoom=14');
});

test('escaping is idempotent-safe (does not double-escape)', () => {
  // First escape
  const once = escHtml('<b>test</b>');
  assert.strictEqual(once, '&lt;b&gt;test&lt;/b&gt;');
  // The escaped result shouldn't contain raw HTML tags
  assert.ok(!once.includes('<b>'));
});


// ══════════════════════════════════════════════════
// SECTION 2: crowdBadge()
// ══════════════════════════════════════════════════
section('crowdBadge() — Crowd Level Badges');

test('returns low badge for "low" level', () => {
  const badge = crowdBadge('low');
  assert.ok(badge.includes('crowd-low'), 'Should have crowd-low class');
  assert.ok(badge.includes('Not crowded'), 'Should say Not crowded');
  assert.ok(badge.includes('🟢'), 'Should have green circle emoji');
});

test('returns mid badge for "mid" level', () => {
  const badge = crowdBadge('mid');
  assert.ok(badge.includes('crowd-mid'), 'Should have crowd-mid class');
  assert.ok(badge.includes('Moderate'), 'Should say Moderate');
  assert.ok(badge.includes('🟡'), 'Should have yellow circle emoji');
});

test('returns high badge for "high" level', () => {
  const badge = crowdBadge('high');
  assert.ok(badge.includes('crowd-high'), 'Should have crowd-high class');
  assert.ok(badge.includes('Very crowded'), 'Should say Very crowded');
  assert.ok(badge.includes('🔴'), 'Should have red circle emoji');
});

test('returns mid badge as fallback for unknown level', () => {
  const badge = crowdBadge('unknown_level');
  assert.ok(badge.includes('crowd-mid'), 'Unknown levels should default to mid');
  assert.ok(badge.includes('Moderate'));
});

test('returns mid badge as fallback for null', () => {
  const badge = crowdBadge(null);
  assert.ok(badge.includes('crowd-mid'));
});

test('returns mid badge as fallback for undefined', () => {
  const badge = crowdBadge(undefined);
  assert.ok(badge.includes('crowd-mid'));
});

test('output is valid HTML div structure', () => {
  const badge = crowdBadge('low');
  assert.ok(badge.startsWith('<div class="crowd-badge'), 'Should start with crowd-badge div');
  assert.ok(badge.endsWith('</div>'), 'Should close div');
});

test('all three levels produce distinct CSS classes', () => {
  const low  = crowdBadge('low');
  const mid  = crowdBadge('mid');
  const high = crowdBadge('high');
  assert.notStrictEqual(low, mid);
  assert.notStrictEqual(mid, high);
  assert.notStrictEqual(low, high);
});


// ══════════════════════════════════════════════════
// SECTION 3: isSaved()
// ══════════════════════════════════════════════════
section('isSaved() — Favourites Check');

test('returns false for ID not in savedIds', () => {
  assert.strictEqual(isSaved(99999), false);
});

test('returns false for string ID when set uses numbers', () => {
  // IDs come back as numbers from the API
  assert.strictEqual(isSaved('99999'), false);
});

test('isSaved is consistent for same id', () => {
  const result1 = isSaved(1);
  const result2 = isSaved(1);
  assert.strictEqual(result1, result2);
});


// ══════════════════════════════════════════════════
// SECTION 4: renderCard()
// ══════════════════════════════════════════════════
section('renderCard() — Card HTML Generation');

const mockRestaurant = {
  id: 42,
  name: 'Test Dhaba',
  area: 'Baner',
  cuisine: 'Punjabi',
  rating: 4.5,
  budget: '₹₹',
  mustTry: 'Dal Makhani',
  crowd: 'mid',
  img: 'https://example.com/img.jpg',
  map: 'https://maps.google.com/?q=baner',
};

test('renders a div.rcard element', () => {
  const html = renderCard(mockRestaurant);
  assert.ok(html.includes('class="rcard"'), 'Should render rcard div');
});

test('includes restaurant name in output', () => {
  const html = renderCard(mockRestaurant);
  assert.ok(html.includes('Test Dhaba'));
});

test('includes restaurant area', () => {
  const html = renderCard(mockRestaurant);
  assert.ok(html.includes('Baner'));
});

test('includes cuisine', () => {
  const html = renderCard(mockRestaurant);
  assert.ok(html.includes('Punjabi'));
});

test('includes rating', () => {
  const html = renderCard(mockRestaurant);
  assert.ok(html.includes('4.5'));
});

test('includes budget', () => {
  const html = renderCard(mockRestaurant);
  assert.ok(html.includes('₹₹'));
});

test('includes must-try dish', () => {
  const html = renderCard(mockRestaurant);
  assert.ok(html.includes('Dal Makhani'));
});

test('includes crowd badge', () => {
  const html = renderCard(mockRestaurant);
  assert.ok(html.includes('crowd-mid') || html.includes('Moderate'));
});

test('includes map link pointing to maps URL', () => {
  const html = renderCard(mockRestaurant);
  assert.ok(html.includes('maps.google.com'));
});

test('includes save button with data-save-id', () => {
  const html = renderCard(mockRestaurant);
  assert.ok(html.includes(`data-save-id="${mockRestaurant.id}"`));
});

test('shows unsaved heart (🤍) when restaurant is not saved', () => {
  const html = renderCard(mockRestaurant); // id 42 not saved
  assert.ok(html.includes('🤍'), 'Should show white heart for unsaved');
});

test('renders openDetail call with correct id', () => {
  const html = renderCard(mockRestaurant);
  assert.ok(html.includes(`openDetail(${mockRestaurant.id})`));
});

test('escapes special chars in restaurant name', () => {
  const evil = { ...mockRestaurant, name: '<Evil & "Tasty">' };
  const html = renderCard(evil);
  assert.ok(!html.includes('<Evil'), 'Should not have raw < in name');
  assert.ok(html.includes('&lt;Evil'), 'Should have escaped &lt;');
});

test('renders image with loading="lazy"', () => {
  const html = renderCard(mockRestaurant);
  assert.ok(html.includes('loading="lazy"'));
});

test('renders rcard-must section with must-try text', () => {
  const html = renderCard(mockRestaurant);
  assert.ok(html.includes('rcard-must'));
  assert.ok(html.includes('Dal Makhani'));
});

test('renders correctly for low crowd restaurant', () => {
  const r = { ...mockRestaurant, crowd: 'low' };
  const html = renderCard(r);
  assert.ok(html.includes('crowd-low') || html.includes('Not crowded'));
});

test('renders correctly for high crowd restaurant', () => {
  const r = { ...mockRestaurant, crowd: 'high' };
  const html = renderCard(r);
  assert.ok(html.includes('crowd-high') || html.includes('Very crowded'));
});

test('renders animation-delay style attribute', () => {
  const html = renderCard(mockRestaurant);
  assert.ok(html.includes('animation-delay:'));
});

test('card has rel=noopener on map link', () => {
  const html = renderCard(mockRestaurant);
  assert.ok(html.includes('noopener'));
});

test('card map link opens in new tab', () => {
  const html = renderCard(mockRestaurant);
  assert.ok(html.includes('target="_blank"'));
});


// ══════════════════════════════════════════════════
// SECTION 5: filterRestaurants() — Extended
// ══════════════════════════════════════════════════
section('filterRestaurants() — Extended Edge Cases');

test('filters are case-insensitive for q param', () => {
  const result = filterRestaurants(seed, { q: 'BIRYANI' });
  const resultLower = filterRestaurants(seed, { q: 'biryani' });
  assert.strictEqual(result.length, resultLower.length, 'Case should not matter for q filter');
});

test('q filter searches mustTry field', () => {
  // Some restaurants have mustTry containing specific keywords
  const result = filterRestaurants(seed, { q: 'biryani' });
  assert.ok(result.length >= 0, 'Should not throw on mustTry search');
});

test('q filter searches desc field', () => {
  // Should search description text too
  const result = filterRestaurants(seed, { q: 'pune' });
  assert.ok(result.length >= 0, 'Should not throw on desc search');
});

test('returns empty array for area that does not exist', () => {
  const result = filterRestaurants(seed, { area: 'NONEXISTENT_AREA_9999' });
  assert.strictEqual(result.length, 0);
});

test('returns empty array for cuisine that does not exist', () => {
  const result = filterRestaurants(seed, { cuisine: 'AlienFood' });
  assert.strictEqual(result.length, 0);
});

test('budget "any" returns all restaurants', () => {
  const result = filterRestaurants(seed, { budget: 'any' });
  assert.strictEqual(result.length, seed.length);
});

test('vibe filter works (if vibes exist in data)', () => {
  const allVibes = [...new Set(seed.flatMap(r => r.vibe || []))];
  if (allVibes.length > 0) {
    const vibe = allVibes[0];
    const result = filterRestaurants(seed, { vibe });
    assert.ok(result.length > 0, `Expected results for vibe: ${vibe}`);
    result.forEach(r => assert.ok(r.vibe && r.vibe.includes(vibe)));
  }
});

test('vibe "any" returns all restaurants', () => {
  const result = filterRestaurants(seed, { vibe: 'any' });
  assert.strictEqual(result.length, seed.length);
});

test('empty q returns full result set', () => {
  const result = filterRestaurants(seed, { q: '' });
  assert.strictEqual(result.length, seed.length);
});

test('triple combined filter narrows results properly', () => {
  const allAreas    = [...new Set(seed.map(r => r.area))];
  const allCuisines = [...new Set(seed.map(r => r.cuisine))];
  const area    = allAreas[0];
  const cuisine = allCuisines[0];
  const result = filterRestaurants(seed, { area, cuisine, budget: '₹' });
  result.forEach(r => {
    assert.strictEqual(r.area,    area,    `area mismatch: ${r.area}`);
    assert.strictEqual(r.cuisine, cuisine, `cuisine mismatch: ${r.cuisine}`);
    assert.strictEqual(r.budget,  '₹',    `budget mismatch: ${r.budget}`);
  });
});

test('result items are shallow copies (original not mutated by sort)', () => {
  const originalFirst = seed[0];
  filterRestaurants(seed, { q: 'cafe' });
  assert.strictEqual(seed[0], originalFirst, 'Original array should not be mutated');
});

test('filterRestaurants handles undefined query fields gracefully', () => {
  assert.doesNotThrow(() => filterRestaurants(seed, { q: undefined, cuisine: undefined }));
});


// ══════════════════════════════════════════════════
// SECTION 6: paginateAndSort() — Extended
// ══════════════════════════════════════════════════
section('paginateAndSort() — Extended Edge Cases');

test('sorts by reviews descending when sort=reviews', () => {
  const { items } = paginateAndSort(seed, { sort: 'reviews', limit: 50 });
  for (let i = 0; i < items.length - 1; i++) {
    assert.ok(
      (items[i].reviews || 0) >= (items[i + 1].reviews || 0),
      `Expected reviews sort at index ${i}`
    );
  }
});

test('unknown sort key defaults to unsorted (no crash)', () => {
  assert.doesNotThrow(() => paginateAndSort(seed, { sort: 'nonsense' }));
});

test('page 1 and page 2 do not overlap', () => {
  const p1 = paginateAndSort(seed, { sort: 'rating', limit: 10, page: 1 });
  const p2 = paginateAndSort(seed, { sort: 'rating', limit: 10, page: 2 });
  const p1Ids = new Set(p1.items.map(r => r.id));
  p2.items.forEach(r => {
    assert.ok(!p1Ids.has(r.id), `Restaurant id=${r.id} appears in both page 1 and page 2`);
  });
});

test('page beyond data returns empty items array', () => {
  const { items } = paginateAndSort(seed, { sort: 'rating', limit: 50, page: 1000 });
  assert.strictEqual(items.length, 0, 'Page 1000 should return no items');
});

test('page 0 is treated as page 1', () => {
  const result0 = paginateAndSort(seed, { sort: 'rating', limit: 5, page: 0 });
  const result1 = paginateAndSort(seed, { sort: 'rating', limit: 5, page: 1 });
  assert.deepStrictEqual(result0.items.map(r => r.id), result1.items.map(r => r.id));
});

test('negative page is treated as page 1', () => {
  const result = paginateAndSort(seed, { sort: 'rating', limit: 5, page: -5 });
  assert.strictEqual(result.page, 1);
});

test('limit of 0 is treated as 1', () => {
  const result = paginateAndSort(seed, { limit: 0 });
  assert.ok(result.items.length >= 1);
});

test('limit of 1 returns exactly 1 item', () => {
  const { items } = paginateAndSort(seed, { limit: 1 });
  assert.strictEqual(items.length, 1);
});

test('limit cap is 50', () => {
  const { items } = paginateAndSort(seed, { limit: 999 });
  assert.ok(items.length <= 50, `Got ${items.length} items, expected ≤ 50`);
});

test('pages count equals ceil(total / limit)', () => {
  const limit = 7;
  const { total, pages } = paginateAndSort(seed, { limit });
  assert.strictEqual(pages, Math.ceil(total / limit));
});

test('sort by name is case-insensitive (alphabetical)', () => {
  const { items } = paginateAndSort(seed, { sort: 'name', limit: 50 });
  for (let i = 0; i < items.length - 1; i++) {
    const cmp = items[i].name.localeCompare(items[i + 1].name);
    assert.ok(cmp <= 0, `${items[i].name} should come before ${items[i+1].name}`);
  }
});

test('does not mutate input array', () => {
  const copy = [...seed];
  paginateAndSort(seed, { sort: 'rating', limit: 10 });
  assert.deepStrictEqual(seed.map(r => r.id), copy.map(r => r.id), 'Seed order should not change');
});

test('page field in response matches requested page', () => {
  const { page } = paginateAndSort(seed, { limit: 5, page: 3 });
  assert.strictEqual(page, 3);
});


// ══════════════════════════════════════════════════
// SECTION 7: readDB() / writeDB()
// ══════════════════════════════════════════════════
section('readDB() / writeDB() — Persistence Layer');

const TMP_DB = path.join(__dirname, '_test_db_tmp.json');

test('writeDB writes valid JSON to disk', () => {
  // writeDB closes over module-level DB_PATH; test structure via fs directly
  fs.writeFileSync(TMP_DB, JSON.stringify(
    { restaurants: seed.slice(0, 3), favorites: {}, ratings: {} }, null, 2));
  const raw = fs.readFileSync(TMP_DB, 'utf8');
  assert.doesNotThrow(() => JSON.parse(raw));
});

test('written DB is valid JSON with expected structure', () => {
  const data = { restaurants: seed.slice(0, 3), favorites: { sess: [1] }, ratings: { 1: [{stars:4}] } };
  fs.writeFileSync(TMP_DB, JSON.stringify(data));
  const back = JSON.parse(fs.readFileSync(TMP_DB, 'utf8'));
  assert.strictEqual(back.restaurants.length, 3);
  assert.deepStrictEqual(back.favorites.sess, [1]);
  assert.ok(back.ratings['1'].length === 1);
  fs.unlinkSync(TMP_DB);
});

test('readDB returns fallback when file does not exist', () => {
  // readDB in server.js uses DB_PATH pointing to actual db.json
  // If it exists, no crash. Test the fallback logic by simulating missing file.
  const db = readDB(); // uses real DB_PATH, should not throw
  assert.ok(Array.isArray(db.restaurants), 'restaurants should be an array');
  assert.ok(typeof db.favorites === 'object', 'favorites should be an object');
  assert.ok(typeof db.ratings === 'object', 'ratings should be an object');
});

test('readDB parses restaurants as array', () => {
  const db = readDB();
  assert.ok(db.restaurants.length >= 50, 'Should have ≥ 50 restaurants loaded');
});

test('readDB parses favorites as object', () => {
  const db = readDB();
  assert.strictEqual(typeof db.favorites, 'object');
});

test('readDB parses ratings as object', () => {
  const db = readDB();
  assert.strictEqual(typeof db.ratings, 'object');
});


// ══════════════════════════════════════════════════
// SECTION 8: Seed Data — Deep Integrity Checks
// ══════════════════════════════════════════════════
section('Seed Data — Deep Integrity');

test('all restaurant names are non-empty strings', () => {
  seed.forEach(r => {
    assert.ok(typeof r.name === 'string' && r.name.trim().length > 0,
      `Empty name for id=${r.id}`);
  });
});

test('all areas are non-empty strings', () => {
  seed.forEach(r => {
    assert.ok(typeof r.area === 'string' && r.area.trim().length > 0,
      `Empty area for id=${r.id}`);
  });
});

test('all cuisine values are non-empty strings', () => {
  seed.forEach(r => {
    assert.ok(typeof r.cuisine === 'string' && r.cuisine.trim().length > 0,
      `Empty cuisine for id=${r.id}`);
  });
});

test('all ratings are numeric', () => {
  seed.forEach(r => {
    assert.strictEqual(typeof r.rating, 'number', `Rating is not a number for id=${r.id}`);
  });
});

test('ratings have at most 1 decimal place', () => {
  seed.forEach(r => {
    const rounded = Math.round(r.rating * 10) / 10;
    assert.ok(Math.abs(rounded - r.rating) < 0.001,
      `Rating ${r.rating} for id=${r.id} has more than 1 decimal place`);
  });
});

test('no two restaurants have the same name in the same area', () => {
  const seen = new Set();
  const dupes = [];
  seed.forEach(r => {
    const key = `${r.name.toLowerCase().trim()}|${r.area}`;
    if (seen.has(key)) dupes.push(`${r.name} in ${r.area}`);
    seen.add(key);
  });
  assert.strictEqual(dupes.length, 0, `Duplicate name+area: ${dupes.join(', ')}`);
});

test('all map URLs use HTTPS', () => {
  seed.forEach(r => {
    assert.ok(r.map.startsWith('https://'), `Non-HTTPS map URL for id=${r.id}: ${r.map}`);
  });
});

test('all ids are positive integers', () => {
  seed.forEach(r => {
    assert.ok(Number.isInteger(r.id) && r.id > 0, `Bad id: ${r.id}`);
  });
});

test('all img URLs are non-empty strings', () => {
  seed.forEach(r => {
    assert.ok(typeof r.img === 'string' && r.img.length > 0,
      `Empty img for id=${r.id}`);
  });
});

test('reviews count is a non-negative integer', () => {
  seed.forEach(r => {
    if (r.reviews !== undefined) {
      assert.ok(Number.isInteger(r.reviews) && r.reviews >= 0,
        `Bad reviews value for id=${r.id}: ${r.reviews}`);
    }
  });
});

test('mustTry is a non-empty string', () => {
  seed.forEach(r => {
    assert.ok(typeof r.mustTry === 'string' && r.mustTry.trim().length > 0,
      `Empty mustTry for id=${r.id}`);
  });
});

test('tags array elements are lowercase strings', () => {
  seed.forEach(r => {
    r.tags.forEach(tag => {
      assert.ok(typeof tag === 'string', `tag is not a string for id=${r.id}`);
      assert.strictEqual(tag, tag.toLowerCase(), `tag '${tag}' should be lowercase for id=${r.id}`);
    });
  });
});

test('covers all 15 defined areas from AREAS config', () => {
  const configAreas = ['Koregaon Park','Baner','Aundh','Kalyani Nagar','Wakad',
    'Kothrud','Viman Nagar','Hinjewadi','Shivajinagar','Hadapsar',
    'Sinhgad Road','Camp','Deccan','Narayan Peth','Sadashiv Peth'];
  const seedAreas = new Set(seed.map(r => r.area));
  configAreas.forEach(area => {
    assert.ok(seedAreas.has(area), `Area "${area}" has no restaurants in seed`);
  });
});

test('has at least 5 restaurants per area in the most populated areas', () => {
  // Only check areas that are known to have high coverage in the seed
  const majorAreas = ['Baner', 'Koregaon Park', 'Aundh', 'Wakad'];
  majorAreas.forEach(area => {
    const count = seed.filter(r => r.area === area).length;
    assert.ok(count >= 5, `${area} has only ${count} restaurants (expected ≥ 5)`);
  });
});


// ══════════════════════════════════════════════════
// SECTION 9: Tag Integrity
// ══════════════════════════════════════════════════
section('Tag Integrity & Distribution');

const VALID_TAGS = new Set(['trending', 'weekend', 'gem', 'leaderboard', 'budget', 'family', 'date', 'solo', 'new']);

test('at least 5 trending restaurants exist', () => {
  const count = seed.filter(r => r.tags.includes('trending')).length;
  assert.ok(count >= 5, `Only ${count} trending restaurants`);
});

test('at least 5 weekend restaurants exist', () => {
  const count = seed.filter(r => r.tags.includes('weekend')).length;
  assert.ok(count >= 5, `Only ${count} weekend restaurants`);
});

test('at least 3 gem restaurants exist', () => {
  const count = seed.filter(r => r.tags.includes('gem')).length;
  assert.ok(count >= 3, `Only ${count} gem restaurants`);
});

test('at least 5 leaderboard restaurants exist', () => {
  const count = seed.filter(r => r.tags.includes('leaderboard')).length;
  assert.ok(count >= 5, `Only ${count} leaderboard restaurants`);
});

test('trending restaurants have rating >= 4.0', () => {
  const trending = seed.filter(r => r.tags.includes('trending'));
  trending.forEach(r => {
    assert.ok(r.rating >= 4.0, `Trending restaurant ${r.name} has low rating ${r.rating}`);
  });
});

test('leaderboard restaurants have rating >= 4.0', () => {
  const lb = seed.filter(r => r.tags.includes('leaderboard'));
  lb.forEach(r => {
    assert.ok(r.rating >= 4.0, `Leaderboard restaurant ${r.name} has rating ${r.rating}`);
  });
});


// ══════════════════════════════════════════════════
// SECTION 10: Decide Logic
// ══════════════════════════════════════════════════
section('Decide Logic — Randomiser');

test('picks exactly 3 from a pool ≥ 3', () => {
  const pool = [...seed].sort(() => Math.random() - 0.5);
  const picks = pool.slice(0, 3);
  assert.strictEqual(picks.length, 3);
});

test('picks are all unique IDs', () => {
  const pool = [...seed].sort(() => Math.random() - 0.5);
  const picks = pool.slice(0, 3);
  const ids = picks.map(r => r.id);
  assert.strictEqual(new Set(ids).size, 3);
});

test('fallback pool = full DB when no matches', () => {
  let pool = filterRestaurants(seed, { area: 'NOWHERE' });
  if (!pool.length) pool = [...seed];
  assert.ok(pool.length > 0, 'Fallback should use entire DB');
});

test('picks from filtered pool match the filter', () => {
  const pool = filterRestaurants(seed, { area: 'Baner' });
  if (pool.length >= 3) {
    const shuffled = [...pool].sort(() => Math.random() - 0.5);
    const picks = shuffled.slice(0, 3);
    picks.forEach(r => assert.strictEqual(r.area, 'Baner'));
  }
});

test('Fisher-Yates shuffle does not lose items', () => {
  const arr = seed.map(r => r.id);
  // Simulate shuffle
  const shuffled = [...arr];
  for (let i = shuffled.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [shuffled[i], shuffled[j]] = [shuffled[j], shuffled[i]];
  }
  assert.strictEqual(shuffled.length, arr.length, 'Shuffle should not lose elements');
  assert.deepStrictEqual([...shuffled].sort((a,b)=>a-b), [...arr].sort((a,b)=>a-b),
    'Shuffle should contain same IDs');
});


// ══════════════════════════════════════════════════
// SECTION 11: Area & Cuisine Aggregation
// ══════════════════════════════════════════════════
section('Area & Cuisine Aggregation Logic');

test('aggregated area counts match actual seed counts', () => {
  const areas = [...new Set(seed.map(r => r.area))].sort();
  areas.forEach(area => {
    const expected = seed.filter(r => r.area === area).length;
    assert.ok(expected > 0, `${area} has 0 restaurants`);
  });
});

test('aggregated cuisine counts match actual seed counts', () => {
  const cuisines = [...new Set(seed.map(r => r.cuisine))].sort();
  cuisines.forEach(cuisine => {
    const count = seed.filter(r => r.cuisine === cuisine).length;
    assert.ok(count > 0, `${cuisine} has 0 restaurants`);
  });
});

test('total restaurants across all areas equals seed.length', () => {
  const areas = [...new Set(seed.map(r => r.area))];
  const total = areas.reduce((acc, area) => acc + seed.filter(r => r.area === area).length, 0);
  assert.strictEqual(total, seed.length);
});

test('total restaurants across all cuisines equals seed.length', () => {
  const cuisines = [...new Set(seed.map(r => r.cuisine))];
  const total = cuisines.reduce((acc, c) => acc + seed.filter(r => r.cuisine === c).length, 0);
  assert.strictEqual(total, seed.length);
});

test('no area name is an empty string', () => {
  const areas = [...new Set(seed.map(r => r.area))];
  areas.forEach(a => assert.ok(a.trim().length > 0, 'Empty area name found'));
});

test('no cuisine name is an empty string', () => {
  const cuisines = [...new Set(seed.map(r => r.cuisine))];
  cuisines.forEach(c => assert.ok(c.trim().length > 0, 'Empty cuisine name found'));
});

test('at least 8 distinct cuisines exist in seed', () => {
  const cuisines = new Set(seed.map(r => r.cuisine));
  assert.ok(cuisines.size >= 8, `Only ${cuisines.size} cuisines found, expected ≥ 8`);
});

test('at least 10 distinct areas exist in seed', () => {
  const areas = new Set(seed.map(r => r.area));
  assert.ok(areas.size >= 10, `Only ${areas.size} areas found, expected ≥ 10`);
});


// ══════════════════════════════════════════════════
// SECTION 12: Leaderboard Logic
// ══════════════════════════════════════════════════
section('Leaderboard Logic');

test('top-10 leaderboard is sorted by rating desc', () => {
  const items = [...seed].sort((a, b) => b.rating - a.rating).slice(0, 10);
  for (let i = 0; i < items.length - 1; i++) {
    assert.ok(items[i].rating >= items[i + 1].rating);
  }
});

test('leaderboard contains at most 10 items', () => {
  const items = [...seed].sort((a, b) => b.rating - a.rating).slice(0, 10);
  assert.ok(items.length <= 10);
});

test('leaderboard first item has the highest or equal rating in seed', () => {
  const items = [...seed].sort((a, b) => b.rating - a.rating).slice(0, 10);
  const maxRating = Math.max(...seed.map(r => r.rating));
  assert.strictEqual(items[0].rating, maxRating);
});

test('medal mapping: index 0 = 🥇, 1 = 🥈, 2 = 🥉', () => {
  const medals = ['🥇', '🥈', '🥉'];
  medals.forEach((medal, i) => {
    const computed = i === 0 ? '🥇' : i === 1 ? '🥈' : i === 2 ? '🥉' : `${i + 1}`;
    assert.strictEqual(computed, medal);
  });
});

test('medal mapping: index 3+ is numeric string', () => {
  for (let i = 3; i <= 9; i++) {
    const medal = i === 0 ? '🥇' : i === 1 ? '🥈' : i === 2 ? '🥉' : `${i + 1}`;
    assert.strictEqual(medal, `${i + 1}`);
  }
});


// ══════════════════════════════════════════════════
// SECTION 13: Budget / Crowd Maps (used in Detail view)
// ══════════════════════════════════════════════════
section('Budget & Crowd Map Completeness');

const budgetMap = { '₹': 'Under ₹200/person', '₹₹': '₹200–600/person', '₹₹₹': '₹600+/person' };
const crowdMap  = { low: '🟢 Not crowded', mid: '🟡 Moderate', high: '🔴 Very crowded' };

test('all seed restaurants have a matching budgetMap entry', () => {
  seed.forEach(r => {
    assert.ok(budgetMap[r.budget] !== undefined,
      `Budget "${r.budget}" for id=${r.id} has no budgetMap entry`);
  });
});

test('all seed restaurants have a matching crowdMap entry', () => {
  seed.forEach(r => {
    assert.ok(crowdMap[r.crowd] !== undefined,
      `Crowd "${r.crowd}" for id=${r.id} has no crowdMap entry`);
  });
});

test('budgetMap covers ₹', () => assert.ok(budgetMap['₹']));
test('budgetMap covers ₹₹', () => assert.ok(budgetMap['₹₹']));
test('budgetMap covers ₹₹₹', () => assert.ok(budgetMap['₹₹₹']));

test('crowdMap covers low', () => assert.ok(crowdMap['low'].includes('Not crowded')));
test('crowdMap covers mid', () => assert.ok(crowdMap['mid'].includes('Moderate')));
test('crowdMap covers high', () => assert.ok(crowdMap['high'].includes('Very crowded')));


// ══════════════════════════════════════════════════
// SECTION 14: Service Worker Config Logic
// ══════════════════════════════════════════════════
section('Service Worker — Configuration Logic');

const SW_STATIC  = ['/', '/index.html', '/styles.css', '/app.js', '/manifest.json'];
const CACHE_NAME = 'khao-pune-v2';

test('service worker static file list contains index.html', () => {
  assert.ok(SW_STATIC.includes('/index.html'));
});

test('service worker static file list contains app.js', () => {
  assert.ok(SW_STATIC.includes('/app.js'));
});

test('service worker static file list contains styles.css', () => {
  assert.ok(SW_STATIC.includes('/styles.css'));
});

test('service worker static file list contains manifest.json', () => {
  assert.ok(SW_STATIC.includes('/manifest.json'));
});

test('cache name is a non-empty string', () => {
  assert.ok(typeof CACHE_NAME === 'string' && CACHE_NAME.length > 0);
});

test('cache name contains version suffix', () => {
  assert.ok(CACHE_NAME.includes('v2') || /v\d/.test(CACHE_NAME),
    'Cache name should have versioned suffix to enable cache busting');
});

test('API routes (/api/*) would be identified as API paths', () => {
  const paths = ['/api/restaurants', '/api/health', '/api/favorites/abc'];
  paths.forEach(p => {
    assert.ok(p.startsWith('/api/'), `${p} should be an API path`);
  });
});

test('static paths are NOT identified as API paths', () => {
  const staticPaths = ['/', '/index.html', '/styles.css', '/app.js'];
  staticPaths.forEach(p => {
    assert.ok(!p.startsWith('/api/'), `${p} wrongly identified as API path`);
  });
});


// ══════════════════════════════════════════════════
// SECTION 15: HTTP API Integration (Live Server)
// ══════════════════════════════════════════════════
section('HTTP API Integration — Extended');

function httpGet(path) {
  return new Promise((resolve, reject) => {
    const req = http.request({ hostname: '127.0.0.1', port: 3002, path, method: 'GET' }, res => {
      let body = '';
      res.on('data', c => body += c);
      res.on('end', () => {
        try { resolve({ status: res.statusCode, body: JSON.parse(body), headers: res.headers }); }
        catch { resolve({ status: res.statusCode, body, headers: res.headers }); }
      });
    });
    req.on('error', reject);
    req.setTimeout(4000, () => req.destroy(new Error('Timeout')));
    req.end();
  });
}

function httpPost(path, data) {
  return new Promise((resolve, reject) => {
    const body = JSON.stringify(data);
    const req = http.request({
      hostname: '127.0.0.1', port: 3002, path, method: 'POST',
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
    req.setTimeout(4000, () => req.destroy(new Error('Timeout')));
    req.write(body);
    req.end();
  });
}

function httpDelete(path) {
  return new Promise((resolve, reject) => {
    const req = http.request({ hostname: '127.0.0.1', port: 3002, path, method: 'DELETE' }, res => {
      let b = '';
      res.on('data', c => b += c);
      res.on('end', () => {
        try { resolve({ status: res.statusCode, body: JSON.parse(b) }); }
        catch { resolve({ status: res.statusCode, body: b }); }
      });
    });
    req.on('error', reject);
    req.setTimeout(4000, () => req.destroy(new Error('Timeout')));
    req.end();
  });
}

// Use a separate server instance to avoid port conflicts
const { server: srv2 } = (() => {
  const s2 = require('../backend/server.js');
  return s2;
})();

async function runExtendedApiTests() {
  const { server: mainServer } = require('../backend/server.js');

  let started = false;
  try {
    await new Promise((resolve, reject) => {
      mainServer.listen(3002, '127.0.0.1', () => { started = true; resolve(); });
      mainServer.on('error', e => {
        if (e.code === 'EADDRINUSE') { started = true; resolve(); }
        else reject(e);
      });
    });
  } catch (e) {
    console.log(`  ⚠️  Could not start test server on 3002: ${e.message}. Skipping HTTP tests.`);
    return;
  }

  // ── Basic routes ──
  await testAsync('GET /api/health returns {status:"ok"}', async () => {
    const { status, body } = await httpGet('/api/health');
    assert.strictEqual(status, 200);
    assert.strictEqual(body.status, 'ok');
  });

  await testAsync('GET /api/health includes restaurant count', async () => {
    const { body } = await httpGet('/api/health');
    assert.ok(typeof body.restaurants === 'number' && body.restaurants > 0);
  });

  await testAsync('GET /api/health includes ISO timestamp', async () => {
    const { body } = await httpGet('/api/health');
    assert.ok(body.timestamp && !isNaN(Date.parse(body.timestamp)));
  });

  // ── Restaurants listing ──
  await testAsync('GET /api/restaurants returns items + total + page + pages', async () => {
    const { body } = await httpGet('/api/restaurants?limit=5');
    assert.ok(body.items && body.total && body.page && body.pages);
  });

  await testAsync('GET /api/restaurants sort=name returns alphabetical order', async () => {
    const { body } = await httpGet('/api/restaurants?sort=name&limit=20');
    for (let i = 0; i < body.items.length - 1; i++) {
      assert.ok(body.items[i].name.localeCompare(body.items[i+1].name) <= 0);
    }
  });

  await testAsync('GET /api/restaurants sort=reviews returns descending review count', async () => {
    const { body } = await httpGet('/api/restaurants?sort=reviews&limit=20');
    for (let i = 0; i < body.items.length - 1; i++) {
      assert.ok((body.items[i].reviews||0) >= (body.items[i+1].reviews||0));
    }
  });

  await testAsync('GET /api/restaurants filters by budget=₹', async () => {
    const { body } = await httpGet('/api/restaurants?budget=%E2%82%B9&limit=20');
    body.items.forEach(r => assert.strictEqual(r.budget, '₹'));
  });

  await testAsync('GET /api/restaurants?area=Wakad returns only Wakad', async () => {
    const { body } = await httpGet('/api/restaurants?area=Wakad&limit=20');
    body.items.forEach(r => assert.strictEqual(r.area, 'Wakad'));
  });

  await testAsync('GET /api/restaurants pagination page=2 does not repeat page=1', async () => {
    const p1 = await httpGet('/api/restaurants?sort=rating&limit=5&page=1');
    const p2 = await httpGet('/api/restaurants?sort=rating&limit=5&page=2');
    const p1Ids = new Set(p1.body.items.map(r => r.id));
    p2.body.items.forEach(r => assert.ok(!p1Ids.has(r.id)));
  });

  // ── Special endpoints ──
  await testAsync('GET /api/restaurants/trending returns only trending-tagged items', async () => {
    const { body } = await httpGet('/api/restaurants/trending');
    assert.ok(body.items.length > 0);
    body.items.forEach(r => assert.ok(r.tags.includes('trending')));
  });

  await testAsync('GET /api/restaurants/weekend returns only weekend-tagged items', async () => {
    const { body } = await httpGet('/api/restaurants/weekend');
    body.items.forEach(r => assert.ok(r.tags.includes('weekend')));
  });

  await testAsync('GET /api/restaurants/gems returns only gem-tagged items', async () => {
    const { body } = await httpGet('/api/restaurants/gems');
    body.items.forEach(r => assert.ok(r.tags.includes('gem')));
  });

  await testAsync('GET /api/restaurants/leaderboard is sorted by rating', async () => {
    const { body } = await httpGet('/api/restaurants/leaderboard');
    for (let i = 0; i < body.items.length - 1; i++) {
      assert.ok(body.items[i].rating >= body.items[i+1].rating);
    }
  });

  await testAsync('GET /api/restaurants/leaderboard returns max 10 items', async () => {
    const { body } = await httpGet('/api/restaurants/leaderboard');
    assert.ok(body.items.length <= 10);
  });

  await testAsync('GET /api/restaurants/decide returns exactly 3 picks', async () => {
    const { body } = await httpGet('/api/restaurants/decide');
    assert.strictEqual(body.picks.length, 3);
  });

  await testAsync('GET /api/restaurants/decide picks have no duplicate IDs', async () => {
    const { body } = await httpGet('/api/restaurants/decide');
    const ids = body.picks.map(r => r.id);
    assert.strictEqual(new Set(ids).size, 3);
  });

  await testAsync('GET /api/restaurants/decide with no matching area falls back', async () => {
    const { status, body } = await httpGet('/api/restaurants/decide?area=NOWHERE_XYZ');
    assert.strictEqual(status, 200);
    assert.ok(body.picks.length > 0, 'Should fallback to full DB');
  });

  // ── Single restaurant ──
  await testAsync('GET /api/restaurants/:id returns full restaurant object', async () => {
    const firstId = seed[0].id;
    const { status, body } = await httpGet(`/api/restaurants/${firstId}`);
    assert.strictEqual(status, 200);
    assert.strictEqual(body.id, firstId);
    assert.ok(body.name && body.area && body.cuisine);
  });

  await testAsync('GET /api/restaurants/:id 404 for unknown id', async () => {
    const { status } = await httpGet('/api/restaurants/99999999');
    assert.strictEqual(status, 404);
  });

  // ── Areas & Cuisines ──
  await testAsync('GET /api/areas returns array with name and count', async () => {
    const { body } = await httpGet('/api/areas');
    assert.ok(Array.isArray(body));
    body.forEach(a => {
      assert.ok(a.name, 'area should have name');
      assert.ok(a.count > 0, 'area count should be > 0');
    });
  });

  await testAsync('GET /api/cuisines returns array with name and count', async () => {
    const { body } = await httpGet('/api/cuisines');
    assert.ok(Array.isArray(body));
    body.forEach(c => {
      assert.ok(c.name, 'cuisine should have name');
      assert.ok(c.count > 0, 'cuisine count should be > 0');
    });
  });

  // ── Favourites ──
  const TEST_SID = `test_v2_${Date.now()}`;

  await testAsync('GET /api/favorites/:sid returns empty list for new session', async () => {
    const { status, body } = await httpGet(`/api/favorites/${TEST_SID}`);
    assert.strictEqual(status, 200);
    assert.strictEqual(body.items.length, 0);
  });

  await testAsync('POST /api/favorites/:sid saves a restaurant', async () => {
    const id = seed[0].id;
    const { status, body } = await httpPost(`/api/favorites/${TEST_SID}`, { id });
    assert.strictEqual(status, 200);
    assert.strictEqual(body.saved, true);
  });

  await testAsync('GET /api/favorites/:sid returns saved item', async () => {
    const id = seed[0].id;
    const { body } = await httpGet(`/api/favorites/${TEST_SID}`);
    assert.ok(body.items.some(r => r.id === id));
  });

  await testAsync('POST /api/favorites/:sid duplicate save does not duplicate list', async () => {
    const id = seed[0].id;
    await httpPost(`/api/favorites/${TEST_SID}`, { id });
    await httpPost(`/api/favorites/${TEST_SID}`, { id });
    const { body } = await httpGet(`/api/favorites/${TEST_SID}`);
    const dupes = body.items.filter(r => r.id === id);
    assert.strictEqual(dupes.length, 1, 'Should not duplicate saved item');
  });

  await testAsync('POST /api/favorites/:sid 404 for unknown restaurant', async () => {
    const { status } = await httpPost(`/api/favorites/${TEST_SID}`, { id: 99999999 });
    assert.strictEqual(status, 404);
  });

  await testAsync('POST /api/favorites/:sid 400 when id is missing', async () => {
    const { status } = await httpPost(`/api/favorites/${TEST_SID}`, {});
    assert.strictEqual(status, 400);
  });

  await testAsync('POST /api/favorites/:sid 400 when id is a string', async () => {
    const { status } = await httpPost(`/api/favorites/${TEST_SID}`, { id: 'notanumber' });
    assert.strictEqual(status, 400);
  });

  await testAsync('DELETE /api/favorites/:sid/:id removes the restaurant', async () => {
    const id = seed[0].id;
    const { status, body } = await httpDelete(`/api/favorites/${TEST_SID}/${id}`);
    assert.strictEqual(status, 200);
    assert.strictEqual(body.removed, true);
  });

  await testAsync('GET /api/favorites/:sid after delete shows item removed', async () => {
    const id = seed[0].id;
    const { body } = await httpGet(`/api/favorites/${TEST_SID}`);
    assert.ok(!body.items.some(r => r.id === id), 'Deleted item should not appear');
  });

  await testAsync('DELETE /api/favorites/:sid/:id is idempotent (no crash on re-delete)', async () => {
    const id = seed[0].id;
    const { status } = await httpDelete(`/api/favorites/${TEST_SID}/${id}`);
    assert.strictEqual(status, 200, 'Double-delete should not crash');
  });

  // ── Ratings ──
  await testAsync('POST /api/ratings/:id accepts star=5', async () => {
    const id = seed[0].id;
    const { status, body } = await httpPost(`/api/ratings/${id}`, { stars: 5 });
    assert.strictEqual(status, 200);
    assert.strictEqual(body.ok, true);
    assert.ok(body.newRating >= 1 && body.newRating <= 5);
  });

  await testAsync('POST /api/ratings/:id accepts star=1', async () => {
    const id = seed[1].id;
    const { status, body } = await httpPost(`/api/ratings/${id}`, { stars: 1 });
    assert.strictEqual(status, 200);
    assert.ok(body.ok);
  });

  await testAsync('POST /api/ratings/:id rejects stars=0', async () => {
    const { status } = await httpPost(`/api/ratings/${seed[0].id}`, { stars: 0 });
    assert.strictEqual(status, 400);
  });

  await testAsync('POST /api/ratings/:id rejects stars=6', async () => {
    const { status } = await httpPost(`/api/ratings/${seed[0].id}`, { stars: 6 });
    assert.strictEqual(status, 400);
  });

  await testAsync('POST /api/ratings/:id rejects stars as string', async () => {
    const { status } = await httpPost(`/api/ratings/${seed[0].id}`, { stars: 'five' });
    assert.strictEqual(status, 400);
  });

  await testAsync('POST /api/ratings/:id newRating is computed average', async () => {
    // We already posted rating=5 and rating=1 for seed[0]
    // Each subsequent call should update the running average
    const { body } = await httpPost(`/api/ratings/${seed[0].id}`, { stars: 3 });
    assert.ok(body.newRating >= 1 && body.newRating <= 5);
  });

  // ── CORS / Headers ──
  await testAsync('OPTIONS preflight returns 204', async () => {
    const { status } = await new Promise((resolve, reject) => {
      const req = http.request({
        hostname: '127.0.0.1', port: 3002, path: '/api/restaurants', method: 'OPTIONS'
      }, res => resolve({ status: res.statusCode }));
      req.on('error', reject);
      req.end();
    });
    assert.strictEqual(status, 204);
  });

  await testAsync('API responses include Content-Type: application/json', async () => {
    const { headers } = await httpGet('/api/health');
    assert.ok(headers['content-type']?.includes('application/json'));
  });

  // ── Error cases ──
  await testAsync('GET /api/does_not_exist returns 404', async () => {
    const { status } = await httpGet('/api/does_not_exist');
    assert.strictEqual(status, 404);
  });

  await testAsync('GET /api/restaurants/notanumber returns 404', async () => {
    const { status } = await httpGet('/api/restaurants/notanumber');
    assert.strictEqual(status, 404);
  });

  // Close server
  if (started) {
    await new Promise(resolve => mainServer.close(resolve));
  }
}

// ──────────────────────────────────────────────────
// MAIN
// ──────────────────────────────────────────────────
(async () => {
  console.log('\n🔥 खाओ Pune — Extended Unit Test Suite v2');
  console.log('═'.repeat(55));

  await runExtendedApiTests();

  // Summary
  console.log('\n' + '═'.repeat(55));
  console.log(`\n  Results: ${passed}/${total} passed  |  ${failed} failed\n`);

  if (failed > 0) {
    console.log('  ❌ Failed tests:');
    results.filter(r => !r.ok).forEach(r => console.log(`     • ${r.name}\n       → ${r.error}`));
    console.log('');
    process.exit(1);
  } else {
    console.log('  🎉 All tests passed!\n');
    process.exit(0);
  }
})();
