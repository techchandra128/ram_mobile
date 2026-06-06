# Feature: Main Page

## What it is
The home screen of RAM. Has a collapsible sidebar on the left and layers for each section (Library, Dashboard, Diary, Smart Desk, etc.) that swap in and out.

---

## Sidebar

### Current State (as of 2026-06-05)
- Sidebar collapses to narrow (icon only) and expands to wide (icon + text)
- Toggle button (☰) at the top controls this
- Icons are now **Lucide SVG icons** — clean, outline-style, professional
- Lucide library saved locally at `libs/lucide.min.js` (works offline)
- `lucide.createIcons()` called in `main_page_index.js` after DOM loads

### Icon Mapping
| Nav Item | Lucide Icon |
|---|---|
| Diary | notebook-pen |
| Smart Desk | monitor |
| Dashboard | bar-chart-2 |
| All Files | folder-open |
| All Sections | layout-list |
| Playlists | music-2 |
| Campaigns | target |
| My Library | book-open |
| Settings | settings |
| Theme (dark) | moon |
| Theme (light) | sun |
| Toggle button | menu |

### Theme Toggle
- Two Lucide icons (`moon` and `sun`) sit inside the theme button
- JS hides/shows the correct one based on current theme
- IDs: `themeIconDark` and `themeIconLight`

---

## Layers
Each section is a `<div>` layer that gets shown/hidden by JS. File view is an iframe overlaid on top.

| Layer | ID | Controlled by |
|---|---|---|
| My Library | `mainPage` | `showLibrary()` |
| Dashboard | `dashboardLayer` | `showDashboard()` |
| Smart Desk | `smartDeskLayer` | `showSmartDesk()` |
| All Sections | `asLayer` | `showAllSections()` |
| Diary | `diaryLayer` | `showDiary()` |
| Campaigns | `campaignLayer` | `showCampaign()` |
| Playlists | `playlistsLayer` | `showPlaylists()` |
| All Files | `allFilesLayer` | `showAllFiles()` |
| Settings | `settingsLayer` | `showSettings()` |
| File View | `fileLayer` | `openFile()` / `closeFile()` |
