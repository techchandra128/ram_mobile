# Roadmap — Future Plans in Order

---

## Priority Order

### 1. Deploy Main Desktop App Online
- Host all static files (HTML/CSS/JS) on GitHub Pages
- Connect to `myramyoga.uk` domain via Cloudflare
- `server.js` is not needed on GitHub Pages — files are served directly
- `proxy.js` (AI middleman) needs separate hosting — decide later

**Status:** DONE (2026-06-05) — live at myramyoga.uk

---

### 2. Login System (Supabase Auth)
- Add signup and login pages using Supabase Auth (already built into existing Supabase project)
- Each user gets their own profile with username and password
- All user data (files, sections, revision history) is tied to their account
- Mouli's data and friends' data stay completely separate

**Status:** Not started

---

### 3. Content Hub Page
- New page accessible from sidebar
- Two sections inside:
  - **Editor's Picks** — books/content added by Mouli (admin curated, quality controlled)
  - **Community Shelf** — books/content uploaded by regular users, available to everyone
- Users browse Content Hub and import content into their own My Library
- Flow: Browse → Import → Appears in personal My Library → Start studying

**Status:** Planned — decisions made, no code yet
See [feat_content_hub.md](feat_content_hub.md) for full details when ready

---

### 4. Performance Improvements
- All Sections batch rendering already done (2026-06-05)
- Remaining performance issues will be revisited after going online
- Loading speed will naturally improve on GitHub Pages (always-on, proper caching)
- No-cache headers in `server.js` are a local-only concern — irrelevant after going online

**Status:** Partially done — rest deferred until online

---

## Decided But Not Yet Scheduled
- `proxy.js` (AI feature) needs a separate host when going online — options: Cloudflare Workers, Railway, Render
- Community uploads in Content Hub need moderation plan before building
