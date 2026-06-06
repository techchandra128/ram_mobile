# Feature: Mobile App

## What it is
A Progressive Web App (PWA) version of RAM — installable on phones, works offline.
Think of it as a trimmed-down version of the desktop app that fits a phone screen.

---

## Live URL
`myramyoga.uk/mobile.html` — deployed on GitHub Pages

---

## File Map

| File | What it does |
|---|---|
| `mobile.html` | Main entry point — shell of the app |
| `mobile.css` | Global mobile styles |
| `mobile.js` | Core JS — app init, routing, shared logic |
| `mobile_core.css / js` | Core layout and shared components |
| `mobile_library.css / js` | My Library screen — folders and files |
| `mobile_dashboard.css / js` | Dashboard screen — stats and heatmap |
| `mobile_diary.css / js` | Diary screen |
| `mobile_smartdesk.css / js` | Smart Desk screen |
| `sw_mobile.js` | Service worker — makes the app work offline and installable |
| `mobile_manifest.json` | PWA manifest — app name, icons, install settings |
| `series_modal.js` | Revision series modal (shared with web app) |
| `icon192.png / icon512.png` | App icons for install screen |

---

## How to Push

Run `push_mobile.bat` from inside `02. Mobile App Files/`

The bat file:
1. Asks for a new cache version number (e.g. 14.9) — updates `sw_mobile.js`
2. Stages all mobile files
3. Asks for a commit message
4. Pushes to GitHub → GitHub Pages deploys automatically in 1-2 minutes

**Cache version** must be bumped every push — this forces phones to download the new version instead of using the old cached one.

---

## Git Repo
- Location: `02. Mobile App Files/` (has its own `.git`)
- Remote: `https://github.com/techchandra128/ram_mobile.git`
- Branch: `master`

---

## Current State (as of 2026-06-06)
- PWA fully working — installable on Android and iOS
- Cornell notes layout — left/right columns with correct colors matching web version
- Diary, Smart Desk, Dashboard, Library screens all built
- Series modal integrated

---

## Known Differences vs Web App
| Feature | Web App | Mobile App |
|---|---|---|
| File view (5 columns) | Full | Adapted for small screen |
| Revision column (Col 5) | Full | Via series modal |
| Offline support | No (runs via server.js locally) | Yes (service worker) |
| Installable | No | Yes (PWA) |
