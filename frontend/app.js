/* ═══════════════════════════════════════════════════
   खाओ Pune — Frontend App (API-connected)
═══════════════════════════════════════════════════ */
'use strict';

// ──────────────────────────────────────────────────
// CONFIG
// ──────────────────────────────────────────────────
// Local dev → hit localhost:3001
// Production (Netlify) → use BACKEND_URL set in config.js pointing to Render
const API_BASE = (window.location.hostname === 'localhost' || window.location.hostname === '127.0.0.1')
  ? `http://${window.location.hostname}:3001`
  : (window.BACKEND_URL || '');

// Unique session ID for favourites (stored in localStorage)
let SESSION_ID = localStorage.getItem('kp_session');
if (!SESSION_ID) {
  SESSION_ID = 'u_' + Math.random().toString(36).slice(2, 10);
  localStorage.setItem('kp_session', SESSION_ID);
}

// ──────────────────────────────────────────────────
// STATE
// ──────────────────────────────────────────────────
let savedIds = new Set(JSON.parse(localStorage.getItem('kp_saved') || '[]'));
let currentPage = 'home';
let searchActive = { q: '', cuisine: 'all' };
let deferredInstallPrompt = null;
let DB_CACHE = null; // local fallback cache

// Area config
const AREAS = [
  { name:'Koregaon Park', icon:'🎸' }, { name:'Baner',         icon:'🏙️' },
  { name:'Aundh',         icon:'🏡' }, { name:'Kalyani Nagar', icon:'🌿' },
  { name:'Wakad',         icon:'🍽️' }, { name:'Kothrud',       icon:'🌶️' },
  { name:'Viman Nagar',   icon:'✈️' }, { name:'Hinjewadi',     icon:'💻' },
  { name:'Shivajinagar',  icon:'🎓' }, { name:'Hadapsar',      icon:'🌇' },
  { name:'Sinhgad Road',  icon:'⛰️' }, { name:'Camp',          icon:'⛺' },
  { name:'Deccan',        icon:'🌅' }, { name:'Narayan Peth',  icon:'🫖' },
  { name:'Sadashiv Peth', icon:'🍮' },
];

// ──────────────────────────────────────────────────
// PWA / SERVICE WORKER
// ──────────────────────────────────────────────────
if ('serviceWorker' in navigator) {
  window.addEventListener('load', () => {
    navigator.serviceWorker.register('service-worker.js')
      .then(reg => console.log('[SW] registered', reg.scope))
      .catch(err => console.warn('[SW] error', err));
  });
}

window.addEventListener('beforeinstallprompt', e => {
  e.preventDefault();
  deferredInstallPrompt = e;
  if (!localStorage.getItem('kp_install_dismissed')) {
    document.getElementById('installBanner').classList.remove('hidden');
  }
});
window.addEventListener('appinstalled', () => {
  document.getElementById('installBanner').classList.add('hidden');
  showToast('App installed! 🎉');
});

document.getElementById('installBtn').addEventListener('click', async () => {
  if (!deferredInstallPrompt) return;
  deferredInstallPrompt.prompt();
  const { outcome } = await deferredInstallPrompt.userChoice;
  if (outcome === 'accepted') showToast('Installing खाओ Pune…');
  deferredInstallPrompt = null;
  document.getElementById('installBanner').classList.add('hidden');
});
document.getElementById('installDismiss').addEventListener('click', () => {
  document.getElementById('installBanner').classList.add('hidden');
  localStorage.setItem('kp_install_dismissed', '1');
});

// Online / offline
function updateOnlineStatus() {
  document.getElementById('offlineBanner').classList.toggle('hidden', navigator.onLine);
}
window.addEventListener('online',  updateOnlineStatus);
window.addEventListener('offline', updateOnlineStatus);

// ──────────────────────────────────────────────────
// API FETCH HELPER
// ──────────────────────────────────────────────────
async function apiFetch(path, opts = {}) {
  try {
    const res = await fetch(API_BASE + path, {
      headers: { 'Content-Type': 'application/json', ...opts.headers },
      ...opts,
    });
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    return await res.json();
  } catch (err) {
    console.warn('[API]', path, err.message);
    return null;
  }
}

// ──────────────────────────────────────────────────
// SAVED / FAVOURITE HELPERS
// ──────────────────────────────────────────────────
function isSaved(id) { return savedIds.has(id); }

function persistSaved() {
  localStorage.setItem('kp_saved', JSON.stringify([...savedIds]));
  updateSavedCount();
}

async function toggleSave(id, ev) {
  ev && ev.stopPropagation();
  if (savedIds.has(id)) {
    savedIds.delete(id);
    showToast('Removed from list');
    apiFetch(`/api/favorites/${SESSION_ID}/${id}`, { method: 'DELETE' });
  } else {
    savedIds.add(id);
    showToast('Saved ❤️');
    apiFetch(`/api/favorites/${SESSION_ID}`, {
      method: 'POST',
      body: JSON.stringify({ id }),
    });
  }
  persistSaved();
  refreshSaveButtons(id);
}

function refreshSaveButtons(id) {
  document.querySelectorAll(`[data-save-id="${id}"]`).forEach(btn => {
    const saved = isSaved(id);
    if (btn.classList.contains('rcard-save')) {
      btn.textContent = saved ? '❤️' : '🤍';
    } else {
      btn.textContent = saved ? '❤️ Saved' : '🤍 Save';
    }
    btn.classList.toggle('saved', saved);
  });
}

function updateSavedCount() {
  const cnt = savedIds.size;
  const el = document.getElementById('savedNavCnt');
  if (el) { el.textContent = cnt; el.classList.toggle('zero', cnt === 0); }
  const sb = document.getElementById('snavSavedCnt');
  if (sb) { sb.textContent = cnt; sb.classList.toggle('zero', cnt === 0); }
}

// ──────────────────────────────────────────────────
// CROWD BADGE
// ──────────────────────────────────────────────────
function crowdBadge(level) {
  const map = {
    low:  { cls: 'crowd-low',  txt: '🟢 Not crowded' },
    mid:  { cls: 'crowd-mid',  txt: '🟡 Moderate' },
    high: { cls: 'crowd-high', txt: '🔴 Very crowded' },
  };
  const c = map[level] || map.mid;
  return `<div class="crowd-badge ${c.cls}">${c.txt}</div>`;
}

// ──────────────────────────────────────────────────
// TOAST
// ──────────────────────────────────────────────────
function showToast(msg) {
  const t = document.getElementById('toast');
  t.textContent = msg;
  t.classList.remove('hidden');
  t.classList.add('show');
  clearTimeout(t._timer);
  t._timer = setTimeout(() => {
    t.classList.remove('show');
    setTimeout(() => t.classList.add('hidden'), 300);
  }, 2200);
}

// ──────────────────────────────────────────────────
// CARD RENDERER
// ──────────────────────────────────────────────────
function renderCard(r) {
  const s = isSaved(r.id);
  const delay = (Math.random() * .15).toFixed(2);
  return `
  <div class="rcard" onclick="openDetail(${r.id})" style="animation-delay:${delay}s">
    <div class="rcard-img-wrap">
      <img class="rcard-img" src="${escHtml(r.img)}" alt="${escHtml(r.name)}" loading="lazy"
           onerror="this.src='data:image/svg+xml,<svg xmlns=%22http://www.w3.org/2000/svg%22 viewBox=%220 0 400 200%22><rect fill=%22%230a0a0f%22 width=%22400%22 height=%22200%22/><text x=%2250%25%22 y=%2250%25%22 text-anchor=%22middle%22 dy=%22.3em%22 font-size=%2248%22>🍽️</text></svg>'">
      ${crowdBadge(r.crowd)}
      <button class="rcard-save ${s ? 'saved' : ''}" data-save-id="${r.id}"
              onclick="toggleSave(${r.id}, event)" aria-label="${s ? 'Unsave' : 'Save'}">${s ? '❤️' : '🤍'}</button>
    </div>
    <div class="rcard-body">
      <div class="rcard-name">${escHtml(r.name)}</div>
      <div class="rcard-meta">
        <span class="rcard-rating">⭐ ${r.rating}</span>
        <span class="dot">·</span>
        <span>${escHtml(r.area)}</span>
        <span class="dot">·</span>
        <span>${escHtml(r.cuisine)}</span>
      </div>
      <div class="rcard-must">🔥 <span>Must try:</span> ${escHtml(r.mustTry)}</div>
      <div class="rcard-footer">
        <span class="rcard-budget">${escHtml(r.budget)}</span>
        <a class="rcard-map" href="${escHtml(r.map)}" target="_blank" rel="noopener noreferrer"
           onclick="event.stopPropagation()">📍 Map</a>
      </div>
    </div>
  </div>`;
}

function escHtml(s) {
  return String(s ?? '')
    .replace(/&/g,'&amp;')
    .replace(/</g,'&lt;')
    .replace(/>/g,'&gt;')
    .replace(/"/g,'&quot;');
}

// ──────────────────────────────────────────────────
// HOME PAGE
// ──────────────────────────────────────────────────
async function buildHome() {
  // Area tiles (static, no API needed)
  document.getElementById('areaTiles').innerHTML = AREAS.map(a => `
    <div class="area-tile" onclick="showAreaPage('${escHtml(a.name)}')">
      <div class="area-tile-ico">${a.icon}</div>
      <div class="area-tile-name">${escHtml(a.name)}</div>
    </div>`).join('');

  // Parallel API requests
  const [trendRes, wkRes, gemRes, lbRes] = await Promise.all([
    apiFetch('/api/restaurants/trending'),
    apiFetch('/api/restaurants/weekend'),
    apiFetch('/api/restaurants/gems'),
    apiFetch('/api/restaurants/leaderboard'),
  ]);

  fillSection('trendingToday',   trendRes?.items, 'No trending restaurants found');
  fillSection('weekendHotspots', wkRes?.items,    'No weekend hotspots found');
  fillSection('hiddenGems',      gemRes?.items,   'No hidden gems found');
  buildLeaderboard(lbRes?.items);

  // Cache for offline fallback
  if (trendRes) DB_CACHE = { trending: trendRes.items, weekend: wkRes?.items, gems: gemRes?.items, leaderboard: lbRes?.items };
}

function fillSection(elId, items, emptyMsg) {
  const el = document.getElementById(elId);
  if (!el) return;
  if (!items || !items.length) {
    el.innerHTML = `<div class="api-error"><div class="err-ico">🍽️</div><div>${emptyMsg}</div></div>`;
    return;
  }
  el.innerHTML = items.map(r => renderCard(r)).join('');
}

function buildLeaderboard(items) {
  const el = document.getElementById('leaderboardList');
  if (!el) return;
  if (!items || !items.length) { el.innerHTML = ''; return; }
  el.innerHTML = items.map((r, i) => {
    const medal = i === 0 ? '🥇' : i === 1 ? '🥈' : i === 2 ? '🥉' : `${i + 1}`;
    const cls   = i === 0 ? 'lb-rank-1' : i === 1 ? 'lb-rank-2' : i === 2 ? 'lb-rank-3' : 'lb-rank-n';
    return `
    <div class="lb-row" onclick="openDetail(${r.id})">
      <div class="lb-rank ${cls}">${medal}</div>
      <img class="lb-img" src="${escHtml(r.img)}" alt="${escHtml(r.name)}" loading="lazy"
           onerror="this.style.background='var(--bg3)';this.style.display='block'">
      <div class="lb-info">
        <div class="lb-name">${escHtml(r.name)}</div>
        <div class="lb-sub">${escHtml(r.area)} · ${escHtml(r.cuisine)} · ${escHtml(r.budget)}</div>
      </div>
      <div class="lb-score">⭐ ${r.rating}</div>
    </div>`;
  }).join('');
}

// ──────────────────────────────────────────────────
// PAGE ROUTING
// ──────────────────────────────────────────────────
function showPage(name) {
  document.querySelectorAll('.page').forEach(p => p.classList.remove('active'));
  document.querySelectorAll('.bnav-btn').forEach(b => b.classList.remove('active'));
  document.querySelectorAll('.snav-btn').forEach(b => b.classList.remove('active'));

  const target = document.getElementById(`page-${name}`);
  if (target) target.classList.add('active');
  const navBtn = document.getElementById(`bnav-${name}`);
  if (navBtn) navBtn.classList.add('active');
  const sideBtn = document.getElementById(`snav-${name}`);
  if (sideBtn) sideBtn.classList.add('active');

  currentPage = name;
  if (name === 'saved')  buildSavedPage();
  if (name === 'search') {
    handleSearch('');
    setTimeout(() => document.getElementById('searchInput')?.focus(), 100);
  }
}

// ──────────────────────────────────────────────────
// AREA PAGE
// ──────────────────────────────────────────────────
async function showAreaPage(areaName) {
  document.getElementById('areaPageTitle').textContent = `📍 ${areaName}`;
  document.getElementById('areaCards').innerHTML = '<div class="spinner"></div>';
  showPage('area');

  const data = await apiFetch(`/api/restaurants?area=${encodeURIComponent(areaName)}&sort=rating&limit=200`);
  const el = document.getElementById('areaCards');
  if (!data || !data.items?.length) {
    el.innerHTML = `<div class="empty-state"><div class="empty-ico">🍽️</div><div class="empty-title">Coming Soon</div><div class="empty-sub">We're adding restaurants in ${escHtml(areaName)} soon!</div></div>`;
    return;
  }
  el.innerHTML = data.items.map(r => renderCard(r)).join('');
}

// ──────────────────────────────────────────────────
// SAVED PAGE
// ──────────────────────────────────────────────────
async function buildSavedPage() {
  const grid  = document.getElementById('savedCards');
  const empty = document.getElementById('savedEmpty');

  if (!savedIds.size) {
    grid.innerHTML = '';
    empty.classList.remove('hidden');
    return;
  }

  empty.classList.add('hidden');
  grid.innerHTML = '<div class="spinner"></div>';

  const data = await apiFetch(`/api/favorites/${SESSION_ID}`);
  if (data?.items?.length) {
    grid.innerHTML = data.items.map(r => renderCard(r)).join('');
  } else {
    // Fallback: use local ids, fetch all and filter
    const all = await apiFetch('/api/restaurants?limit=200');
    const items = all?.items?.filter(r => savedIds.has(r.id)) ?? [];
    if (!items.length) {
      grid.innerHTML = '';
      empty.classList.remove('hidden');
    } else {
      grid.innerHTML = items.map(r => renderCard(r)).join('');
    }
  }
}

// ──────────────────────────────────────────────────
// SEARCH
// ──────────────────────────────────────────────────
let searchDebounce = null;

function handleSearch(q) {
  searchActive.q = q;
  const clearBtn = document.getElementById('searchClear');
  if (clearBtn) clearBtn.classList.toggle('hidden', !q);
  clearTimeout(searchDebounce);
  searchDebounce = setTimeout(runSearch, 220);
}

function clearSearch() {
  const input = document.getElementById('searchInput');
  if (input) { input.value = ''; input.focus(); }
  handleSearch('');
}

function filterSearch(cuisine, btn) {
  document.querySelectorAll('.chip').forEach(b => b.classList.remove('active'));
  btn.classList.add('active');
  searchActive.cuisine = cuisine;
  runSearch();
}

async function runSearch() {
  const params = new URLSearchParams({ limit: 200, sort: 'rating' });
  if (searchActive.q)                    params.set('q', searchActive.q);
  if (searchActive.cuisine !== 'all' && searchActive.cuisine !== 'any')
    params.set('cuisine', searchActive.cuisine);

  const data  = await apiFetch(`/api/restaurants?${params}`);
  const grid  = document.getElementById('searchResults');
  const empty = document.getElementById('searchEmpty');

  if (!data || !data.items?.length) {
    grid.innerHTML = '';
    empty.classList.remove('hidden');
  } else {
    empty.classList.add('hidden');
    grid.innerHTML = data.items.map(r => renderCard(r)).join('');
  }
}

// ──────────────────────────────────────────────────
// DECIDE SHEET
// ──────────────────────────────────────────────────
function openDecide() {
  showDecideFilters();
  document.getElementById('decideOverlay').classList.remove('hidden');
  document.body.style.overflow = 'hidden';
}
function closeDecide() {
  document.getElementById('decideOverlay').classList.add('hidden');
  document.body.style.overflow = '';
}
function showDecideFilters() {
  document.getElementById('decideFilters').classList.remove('hidden');
  document.getElementById('decideResults').classList.add('hidden');
}

document.querySelectorAll('.fchips').forEach(group => {
  group.addEventListener('click', e => {
    const chip = e.target.closest('.fchip');
    if (!chip) return;
    group.querySelectorAll('.fchip').forEach(c => c.classList.remove('active'));
    chip.classList.add('active');
  });
});

function getFilterVal(groupId) {
  const active = document.querySelector(`#${groupId} .fchip.active`);
  return active ? active.dataset.val : 'any';
}

async function runDecide() {
  const btn = document.querySelector('.go-btn');
  if (btn) { btn.disabled = true; btn.textContent = '⏳ Finding picks…'; }

  const area    = getFilterVal('filterArea');
  const cuisine = getFilterVal('filterCuisine');
  const budget  = getFilterVal('filterBudget');
  const vibe    = getFilterVal('filterGroup');

  const params = new URLSearchParams();
  if (area    !== 'any') params.set('area',    area);
  if (cuisine !== 'any') params.set('cuisine', cuisine);
  if (budget  !== 'any') params.set('budget',  budget);
  if (vibe    !== 'any') params.set('vibe',    vibe);

  const data = await apiFetch(`/api/restaurants/decide?${params}`);

  if (btn) { btn.disabled = false; btn.textContent = '🎲 Show My 3 Picks'; }

  if (!data?.picks?.length) {
    showToast('No matching restaurants — try different filters!');
    return;
  }

  document.getElementById('decideResultCards').innerHTML = data.picks.map(r => renderCard(r)).join('');
  document.getElementById('decideFilters').classList.add('hidden');
  document.getElementById('decideResults').classList.remove('hidden');
}

// ──────────────────────────────────────────────────
// DETAIL SHEET
// ──────────────────────────────────────────────────
async function openDetail(id) {
  const heroEl = document.getElementById('detailHero');
  const bodyEl = document.getElementById('detailBody');
  heroEl.innerHTML = '<div class="spinner" style="margin-top:60px"></div>';
  bodyEl.innerHTML = '';
  document.getElementById('detailOverlay').classList.remove('hidden');
  document.body.style.overflow = 'hidden';

  const r = await apiFetch(`/api/restaurants/${id}`);
  if (!r) {
    heroEl.innerHTML = '<div class="api-error"><div class="err-ico">😵</div><div>Could not load details</div></div>';
    return;
  }

  const crowdMap  = { low:'🟢 Not crowded', mid:'🟡 Moderate', high:'🔴 Very crowded' };
  const budgetMap = { '₹':'Under ₹200/person', '₹₹':'₹200–600/person', '₹₹₹':'₹600+/person' };

  heroEl.innerHTML = `
    <img src="${escHtml(r.img)}" alt="${escHtml(r.name)}"
         onerror="this.parentElement.style.background='var(--bg3)';this.style.display='none'">
    <button class="detail-close" onclick="closeDetail()">✕</button>
    <div class="detail-hero-info">
      <div class="detail-name">${escHtml(r.name)}</div>
      <div class="detail-badges">
        <span class="detail-badge badge-rating">⭐ ${r.rating}</span>
        <span class="detail-badge badge-cuisine">${escHtml(r.cuisine)}</span>
        <span class="detail-badge badge-area">📍 ${escHtml(r.area)}</span>
      </div>
    </div>`;

  bodyEl.innerHTML = `
    <div class="detail-sec">
      <div class="detail-sec-title">Must Try</div>
      <div class="must-try-box">
        <span style="font-size:32px">🔥</span>
        <div>
          <div class="must-try-label">MUST-TRY DISH</div>
          <div class="must-try-dish">${escHtml(r.mustTry)}</div>
        </div>
      </div>
    </div>
    <div class="detail-sec">
      <div class="detail-sec-title">About</div>
      <div class="detail-about">${escHtml(r.desc)}</div>
    </div>
    <div class="detail-sec">
      <div class="detail-sec-title">Details</div>
      <div class="detail-row">
        <span class="detail-row-icon">👥</span>
        <span class="detail-row-lbl">Crowd level</span>
        <span class="detail-row-val">${crowdMap[r.crowd] || 'Unknown'}</span>
      </div>
      <div class="detail-row">
        <span class="detail-row-icon">💰</span>
        <span class="detail-row-lbl">Budget</span>
        <span class="detail-row-val">${escHtml(r.budget)} · ${budgetMap[r.budget] || ''}</span>
      </div>
      <div class="detail-row">
        <span class="detail-row-icon">🍽️</span>
        <span class="detail-row-lbl">Cuisine</span>
        <span class="detail-row-val">${escHtml(r.cuisine)}</span>
      </div>
      <div class="detail-row">
        <span class="detail-row-icon">📍</span>
        <span class="detail-row-lbl">Area</span>
        <span class="detail-row-val">${escHtml(r.area)}</span>
      </div>
      <div class="detail-row">
        <span class="detail-row-icon">🌟</span>
        <span class="detail-row-lbl">Reviews</span>
        <span class="detail-row-val">${(r.reviews || 0).toLocaleString()} reviews</span>
      </div>
    </div>
    <div class="detail-actions">
      <a href="${escHtml(r.map)}" target="_blank" rel="noopener noreferrer"
         class="action-btn btn-map">📍 View on Map</a>
      <button class="action-btn btn-save ${isSaved(id) ? 'saved' : ''}"
              data-save-id="${id}"
              onclick="toggleSave(${id}, event); this.textContent = isSaved(${id}) ? '❤️ Saved' : '🤍 Save'; this.classList.toggle('saved', isSaved(${id}))">
        ${isSaved(id) ? '❤️ Saved' : '🤍 Save'}
      </button>
    </div>`;
}

function closeDetail() {
  document.getElementById('detailOverlay').classList.add('hidden');
  document.body.style.overflow = '';
}

// ──────────────────────────────────────────────────
// STARTUP
// ──────────────────────────────────────────────────
function handleStartupAction() {
  const params = new URLSearchParams(window.location.search);
  const action = params.get('action');
  if (action === 'decide') openDecide();
  if (action === 'saved')  showPage('saved');
}

window.addEventListener('DOMContentLoaded', () => {
  const SPLASH_MS = 1800;
  setTimeout(() => {
    const splash = document.getElementById('splash');
    splash.classList.add('out');
    setTimeout(() => {
      splash.style.display = 'none';
      document.getElementById('app').classList.remove('hidden');
      buildHome();
      updateSavedCount();
      updateOnlineStatus();
      handleStartupAction();
    }, 500);
  }, SPLASH_MS);
});

// Keyboard shortcuts
document.addEventListener('keydown', e => {
  if (e.key === 'Escape') {
    if (!document.getElementById('detailOverlay').classList.contains('hidden')) { closeDetail(); return; }
    if (!document.getElementById('decideOverlay').classList.contains('hidden')) { closeDecide(); return; }
  }
});

// Android back button
window.addEventListener('popstate', () => {
  if (!document.getElementById('detailOverlay').classList.contains('hidden')) { closeDetail(); return; }
  if (!document.getElementById('decideOverlay').classList.contains('hidden')) { closeDecide(); return; }
  if (currentPage !== 'home') showPage('home');
});
history.pushState({}, '');

// ──────────────────────────────────────────────────
// EXPORTS (for testing)
// ──────────────────────────────────────────────────
if (typeof module !== 'undefined' && module.exports) {
  module.exports = { escHtml, crowdBadge, isSaved, renderCard };
}
