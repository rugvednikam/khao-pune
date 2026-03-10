# 🔥 खाओ Pune v2

**Find the hottest places to eat in Pune — faster than you can say "Misal Pav".**

## 🚀 Quick Start

```bash
# 1. Install (no npm required — pure Node.js!)
node --version   # requires Node 18+

# 2. Start the backend
node backend/server.js

# 3. Open in browser
open http://localhost:3001
```

## 📁 Project Structure

```
khao-pune-v2/
├── backend/
│   ├── server.js      # Node.js HTTP server (REST API)
│   ├── seed.js        # 60+ Pune restaurant dataset
│   └── db.json        # Auto-created on first run
├── frontend/
│   ├── index.html     # PWA shell
│   ├── styles.css     # Dark neon UI
│   ├── app.js         # Frontend JS (API-connected)
│   ├── service-worker.js
│   ├── manifest.json
│   └── icons/
├── tests/
│   └── tests.js       # Unit + integration tests
└── package.json
```

## 🧪 Run Tests

```bash
node tests/tests.js
```

Tests cover:
- ✅ Seed data integrity (IDs, ratings, fields)
- ✅ Filter function (cuisine, area, budget, vibe, query)
- ✅ Pagination & sorting
- ✅ Section tags (trending, weekend, gem, leaderboard)
- ✅ Area coverage (all 15 areas)
- ✅ Decide logic
- ✅ DB read/write
- ✅ Full HTTP API (health, restaurants, areas, favorites, ratings)

## 🔌 REST API

| Method | Path | Description |
|--------|------|-------------|
| GET | `/api/health` | Server health check |
| GET | `/api/restaurants` | All restaurants (supports `?q=`, `?cuisine=`, `?area=`, `?budget=`, `?sort=`, `?page=`, `?limit=`) |
| GET | `/api/restaurants/:id` | Single restaurant |
| GET | `/api/restaurants/trending` | Trending restaurants |
| GET | `/api/restaurants/weekend` | Weekend hotspots |
| GET | `/api/restaurants/gems` | Hidden gems |
| GET | `/api/restaurants/leaderboard` | Top-rated list |
| GET | `/api/restaurants/decide` | 3 random picks (supports same filters) |
| GET | `/api/areas` | All areas with counts |
| GET | `/api/cuisines` | All cuisines with counts |
| GET | `/api/favorites/:session` | Get saved restaurants |
| POST | `/api/favorites/:session` | Save a restaurant `{ id: number }` |
| DELETE | `/api/favorites/:session/:id` | Remove saved restaurant |
| POST | `/api/ratings/:id` | Submit a rating `{ stars: 1–5 }` |

## 🎨 UI Features

- **Dark neon theme** — deep black + orange/purple/cyan accents
- **Mobile-first** — optimized for 320px+
- **PWA** — installable, offline support
- **Glassmorphism cards** — frosted glass effect
- **Smooth animations** — spring physics bottom sheets
- **Skeleton loading** — no layout shift
- **Funky typography** — Bebas Neue + Space Grotesk
- **Decide For Me** — smart random picker with filters
- **Saved list** — persisted locally + synced to server
- **Search** — instant debounced search with cuisine filters

## 🛠 Tech Stack

- **Backend**: Pure Node.js `http` module (zero npm dependencies!)
- **Database**: JSON file (no external DB needed)
- **Frontend**: Vanilla JS + CSS (no framework)
- **PWA**: Service Worker + Web App Manifest
- **Tests**: Pure Node.js `assert` module
