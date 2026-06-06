# CLAUDE.md — Operational Bible for RAM Project

---

## MUST-READ FILES — Every Single Session, No Skipping

Read these in order before doing anything else:

1. `04. Project Hub/INDEX.md` — file map, see what exists
2. `04. Project Hub/03_sessions_log.md` — what happened in previous sessions
3. `04. Project Hub/01_current.md` — what we are actively working on right now
4. Whichever feature file is relevant to today's task

If a feature file is **empty** — write it fully before starting work on that feature.
If a feature file **has content** — read it first, then update it after any significant change.

**What counts as significant:** architectural decisions, bugs found and fixed, features completed, plans changed, new pages added or removed.
**What to skip:** small tweaks like text changes, color fixes, minor adjustments.

---

## Who You Are Talking To
- Mouli — a vibe coder, not a technical expert
- Explain everything in plain, simple language
- Never use jargon unless absolutely necessary — and if you must, explain it with an analogy
- Talk like you are explaining to a smart 10-year-old who is unfamiliar with coding

---

## Core Workflow — Follow This Every Single Time

### Step 1: Understand First
- DO NOT jump to solutions
- DO NOT make assumptions
- Rephrase the problem in your own words using simple language
- Wait for Mouli to confirm you understood correctly

### Step 2: Confirm Understanding
Only after Mouli says "yes correct" or equivalent — move forward.
If he says "not quite" — rephrase again. Do not proceed until confirmed.

### Step 3: Suggest Approach
- Explain what you plan to do in plain language
- No code yet
- Wait for Mouli's approval on the approach

### Step 4: Ask "Shall I code now?"
- Ask ONLY for new features, complex changes, or anything that needs thought
- Do NOT ask for simple obvious tweaks (changing a size, color, text)
- If Mouli just said "change this to that" — just do it directly

### Step 5: Code
- Edit all files needed for that feature or fix together as one logical unit
- Say "Done" after completing the unit
- Follow with a short bullet summary of what changed

---

## After Making Changes — Update the Hub

After any significant change:
1. Update `04. Project Hub/01_current.md` with what was done
2. Update the relevant feature file
3. Add an entry to `04. Project Hub/03_sessions_log.md`
4. If something planned was completed — add it to `04. Project Hub/05_achievements.md`

Then ask Mouli: **"Hub files updated. Push to GitHub? (yes/no)"**
If yes — run `push_hub.bat` from the root folder.

---

## Coding Rules

### File Editing
- Edit files directly — Mouli's files are local, no need for downloads
- One logical unit at a time (a unit = all files needed for one feature/fix)
- Do not touch files unrelated to the current task

### Communication After Coding
- Say "Done" first
- Then 2-5 short bullet points of what changed — plain language only
- No long explanations unless Mouli asks

### When Something Is Unclear
- Ask ONE specific question — not multiple
- Frame it simply: "I'm not sure if you want X or Y — which one?"

---

## What NOT To Do — Ever
- Do not assume what Mouli wants — always confirm first
- Do not rewrite everything when a small fix is enough
- Do not use words like: refactor, asynchronous, callback, DOM, props, state, runtime, instance, deprecated, render, iterate — unless you immediately explain with an analogy
- Do not give long summaries after coding
- Do not ask "Shall I code now?" for small obvious changes
- Do not edit multiple unrelated things in one go
- Do not copy-paste Mouli's words back as "understanding" — rephrase in your own words

---

## Project Context

### What is RAM?
RAM stands for Read, Analyze, and Memorize. It is Mouli's personal reading and study web app.
Think of it like a smart notebook with shelves (folders), pages (files), and a revision calendar.

### Two Apps — Both Live Online

**1. Web App (Desktop)**
- Main file: `01. Web App Files/main_page_index.html`
- Live at: `myramyoga.uk`
- Push: run `01. Web App Files/push_web.bat`
- Git repo: inside `01. Web App Files/` → remote: `techchandra128/ram_mobile.git`

Two main screens:
- **Main Page** (`main_page_index.html`) — home screen with sidebar, library, dashboard, diary, smart desk, all sections, playlists, campaigns
- **File View** (`fileview.html`) — reading and study screen with 5 columns:
  - Col 1 & 2: Section list and management
  - Col 3: Actual content/notes
  - Col 4: Notes and tasks
  - Col 5: Revision dashboard

**2. Mobile App (PWA)**
- Main file: `02. Mobile App Files/mobile.html`
- Live at: `myramyoga.uk/mobile.html`
- Push: run `02. Mobile App Files/push_mobile.bat` (also bumps cache version in `sw_mobile.js`)
- Git repo: inside `02. Mobile App Files/` → remote: `techchandra128/ram_mobile.git`
- Installable on phones, works offline

### Tech Stack
| Piece | What it does |
|---|---|
| `server.js` | Local engine — serves files like a post office (web app, local only) |
| `proxy.js` | Talks to the AI — middleman between app and Claude |
| `supabase_sync.js` | Syncs data to/from Supabase cloud database |
| `localStorage` | Where all data is saved in the browser |
| `start.vbs` / `stop.vbs` | On/off switches for the local server |
| `sw_mobile.js` | Service worker — makes mobile app work offline |
| CSS variables | Makes dark/light theme work everywhere |

### Domain & Hosting
- Domain: `myramyoga.uk` — bought via Cloudflare
- Hosting: GitHub Pages
- Database: Supabase — connected and syncing

---

## Revision System
- Uses spaced repetition — newer/harder topics revised more frequently (Fibonacci spacing)
- Well-retained topics move to a fixed monthly cycle
- Column 5 in File View is the revision dashboard

---

## Push Workflow (3 separate push files)

| File | What it pushes | When to use |
|---|---|---|
| `01. Web App Files/push_web.bat` | Web app code | After web app changes |
| `02. Mobile App Files/push_mobile.bat` | Mobile app code + cache version | After mobile app changes |
| `push_hub.bat` (root) | CLAUDE.md + Project Hub files | After I update hub files |

---

## Git
- Each app folder has its own git repo
- Root folder has its own git repo for hub files only (managed by `push_hub.bat`)
- Commit after every meaningful completed feature or fix
- Keep commit messages simple: what changed, in plain words

---

## Golden Rule
**Understand → Confirm → Suggest → Approve → Code → Done → Update Hub → Push**
Never skip a step for anything non-trivial.
For trivial changes (size, color, text) — just do it.
