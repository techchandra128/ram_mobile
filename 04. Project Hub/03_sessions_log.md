# Sessions Log

Running record of every working session — what we did, what decisions were made.
A future Claude reads this to know exactly where we left off.

---

## How to Use This File
- Read this at the start of every session after `01_current.md`
- After a session ends, add an entry at the TOP (newest first)
- Keep each entry short — bullet points only, no essays

---

## Session: 2026-06-06 — Knowledge Base Setup

### What We Did
- Identified that `01. Apps - Final Version` is the new final working directory (freshly copied)
- Found `02. Mobile App Files/` already has its own git repo → remote: `ram_mobile.git`
- Found `01. Web App Files/` also has its own git → same remote
- Initialized git at root level for hub files only
- Created `.gitignore` at root — ignores web/mobile/prototypes folders
- Created `push_hub.bat` at root — pushes only CLAUDE.md and Project Hub files
- Removed redundant `git init` blocks from `push_web.bat` and `push_mobile.bat` (no longer needed)
- Rebuilt entire knowledge base structure (this session)

### Decisions Made
- Keep 3 separate git repos: web app, mobile app, and hub — each manages its own files
- Hub and CLAUDE.md get their own push file (`push_hub.bat`)
- `.claude/settings.json` old paths cleaned up — old Mobile App path no longer exists

### Files Changed
- `.gitignore` (new)
- `push_hub.bat` (new)
- `01. Web App Files/push_web.bat` (removed git init block)
- `02. Mobile App Files/push_mobile.bat` (removed git init block)
- `04. Project Hub/` — full rebuild (INDEX, feat_mobile_app, sessions_log, achievements)
- `CLAUDE.md` — updated with must-read files, both app context, auto-push protocol

---

## Session: 2026-06-05 — Main Page and Sidebar Overhaul

### What We Did
- Removed Journal page entirely (8 files deleted)
- Reordered sidebar nav: Diary → Smart Desk → Dashboard → All Files → All Sections → Playlists → Campaigns → My Library
- All Sections batch rendering — 100 rows at a time, "Load more" button
- Fixed layer bug in All Sections (`allFilesLayer` was missing from hide list)
- Replaced emoji icons in sidebar with Lucide SVG icons (downloaded locally)
- Deployed web app to GitHub Pages at `myramyoga.uk`

### Decisions Made
- Journal page permanently removed — not needed
- Lucide icon library saved locally at `libs/lucide.min.js` so it works offline
- Content Hub page planned (Editor's Picks + Community Shelf) — not started yet

### Files Changed
- `main_page_index.html`, `main_page_index.css`, `main_page_index.js`
- `allsections.js`
- `diary.js`, `smart_desk.js`, `allfiles.js`, `campaign.js`, `playlist.js`
- `settings.html`
- Deleted: entire `journal/` folder (8 files)

---
