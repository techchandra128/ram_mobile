# RAM — Project Overview

## What is RAM?
RAM stands for **Read, Analyze, Memorize**. It is Mouli's personal reading and study web app.
Think of it like a smart notebook with shelves (folders), pages (files), and a revision calendar.

---

## Two Main Surfaces

### 1. Main Page (`main_page_index.html`)
The home screen. Like a library dashboard. Contains:
- Sidebar navigation
- My Library (folders and files)
- Dashboard (activity heatmap, stats)
- Smart Desk
- Diary
- All Files
- All Sections
- Playlists
- Campaigns

### 2. File View (`fileview.html`)
The reading and study screen. Has 5 columns:
- **Col 1 & 2** — Section list and management (like a table of contents)
- **Col 3** — The actual content/notes (like the page of a book)
- **Col 4** — Notes and tasks (sticky notes on the side)
- **Col 5** — Revision dashboard (tracks how well you know each section)

---

## Tech Stack

| Piece | What it does |
|---|---|
| `server.js` | Local engine — serves files like a post office |
| `proxy.js` | Talks to the AI (middleman between app and Claude) |
| `supabase_sync.js` | Syncs data to/from Supabase cloud database |
| `localStorage` | Where all data is saved in the browser |
| `start.vbs` / `stop.vbs` | On/off switches for the local server |
| CSS variables | Makes dark/light theme work everywhere |

---

## Domain & Hosting

| Piece | Detail |
|---|---|
| Domain | `myramyoga.uk` — bought via Cloudflare |
| Current hosting | GitHub Pages |
| Mobile app | Already live at `myramyoga.uk/mobile.html` |
| Desktop app | Not yet deployed online — runs locally only |
| Database | Supabase — already connected and syncing |

---

## Sidebar Nav Order (as of 2026-06-05)
1. Diary
2. Smart Desk
3. Dashboard
4. All Files
5. All Sections
6. Playlists
7. Campaigns
8. My Library
9. Settings (bottom)
10. Theme toggle (bottom)

---

## Revision System
- Uses spaced repetition — newer/harder topics revised more frequently (Fibonacci spacing)
- Well-retained topics move to a fixed monthly cycle
- Column 5 in File View is the revision dashboard

---

## Key Decisions Made
- Journal page permanently removed (2026-06-05)
- Content Hub page planned with two sections: **Editor's Picks** (admin) and **Community Shelf** (users)
- Going online plan: GitHub Pages (static files) + Supabase Auth (login) + Supabase DB (data per user)
