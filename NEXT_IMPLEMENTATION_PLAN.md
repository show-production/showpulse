# ShowPulse — Remaining Implementation Plan

## Context
ShowPulse is a self-hosted Rust/Axum live show management platform. The full pipeline works end-to-end: timecode sources (Generator/LTC/MTC) -> countdown engine -> WebSocket -> crew browsers. All core features, UI/UX polish, authentication, and security hardening are complete. Remaining work focuses on nice-to-have features.

**Repository:** https://github.com/show-production/showpulse

---

## Current Status (What's Done)

| Component | Status |
|-----------|--------|
| Timecode types (24/25/29.97df/30 fps, drop-frame math) | Done |
| Built-in timecode generator (Freerun/Countdown/Clock/Loop) | Done |
| Timecode manager (source switching) | Done |
| LTC Audio Decoding (cpal, bi-phase detection, BCD parsing) | Done |
| MTC MIDI Decoding (midir, quarter-frame, full-frame SysEx) | Done |
| Cue & Department data models + JSON persistence | Done |
| Act data model (name, sort_order) + CRUD + act shift | Done |
| Show name (get/set, displayed in navbar) | Done |
| Cue numbering (auto-generated Q1/Q2/Q3, editable) | Done |
| 44 REST API endpoints + 1 WebSocket | Done |
| WebSocket hub with per-department filtering | Done |
| 10Hz countdown engine with per-department cue state tracking | Done |
| Frontend: Show view (timer, Ready/Go, act-grouped cues, floating controls) | Done |
| Frontend: Editor view (act-grouped cue list, drag-and-drop, inline edit, multi-select bulk ops, timeline strip, cue/act duplication, dept + act CRUD, CSV/JSON import) | Done |
| Frontend: Settings (source, frame rate, theme, LTC/MTC devices, show name, export/import) | Done |
| UI/UX: Disconnection banner, keyboard hints, confirm modals | Done |
| UI/UX: Toast notifications, loading spinner, passed cues toggle | Done |
| UI/UX: Responsive table scroll, 44px touch targets, favicon | Done |
| UI/UX: Speed suffix, live color preview, TC size slider label | Done |
| Acts & collapsible act groups (double-click header or floating controls) | Done |
| Flow controls in timer panel (Now, Auto, Collapse All, Expand All) | Done |
| Always-visible T- countdown + T+ elapsed time after trigger | Done |
| Warning entry easing (CSS animation chain) | Done |
| Vivid department colors (per-element opacity, dept-dot in card tags) | Done |
| Navbar rebuild (three-section flex: tabs / show name / connection + user) | Done |
| Cue state: active until replaced by next same-department cue | Done |
| Ready / 3-2-1 / Go countdown visualization with traffic-light colors | Done |
| Bulk cue import (JSON + CSV, replaces existing, dept name resolution) | Done |
| Documentation (README, GETTING_STARTED, PROJECT_OVERVIEW, plans) | Done |
| Show view clarity: passed count badge, active strips, uniform cards | Done |
| Frame-accurate timecode broadcast (10Hz with cached cue states) | Done |
| Script maintenance (-501 lines, -18%): CRUD helpers, module cleanup, JSDoc | Done |
| User management & 5 roles (Viewer/CrewLead/Operator/Manager/Admin) | Done |
| Timer lock (exclusive Manager control, Admin bypass) | Done |
| QR code onboarding (`GET /api/qr`) | Done |
| Security hardening (CORS, body limit, concurrency limit, WS limit, headers) | Done |
| 73 unit & integration tests | Done |
| Hebrew / RTL internationalization (i18n engine, DOM tagging, JS externalization) | Done |
| Mobile-first responsive overhaul (PWA meta, touch targets, modal/nav/timer fixes) | Done |

### Completed Phases

**Phase 1 — LTC Audio Decoding:** cpal-based decoder with bi-phase zero-crossing detection, 80-bit frame extraction, BCD parsing, sync word (0x3FFD). Dedicated OS thread. API: `GET /api/ltc/devices`, `PUT /api/ltc/device`, `POST /api/ltc/stop`.

**Phase 2 — MTC MIDI Decoding:** midir-based decoder with quarter-frame accumulation (8 messages -> full TC), full-frame SysEx parsing. Dedicated OS thread. API: `GET /api/mtc/devices`, `PUT /api/mtc/device`, `POST /api/mtc/stop`.

**Phase 3 — UI/UX Improvements (15 items):** Disconnection banner, keyboard hints, confirm modals replacing native `confirm()`, "Lead Time" column rename, speed suffix, data panel separation, `setSource()` fix, table scroll, touch targets, loading spinner, toast notifications, passed cues toggle, TC size label, live color preview, favicon.

**Phase 4 — CSV/JSON Cue Import:** `POST /api/cues/import` bulk endpoint that replaces all existing cues, department validation, single persist. Frontend CSV parser with column aliases, JSON array/wrapper support, import button in Editor view. `importShow()` deletes all existing departments+cues before importing new ones.

**Phase 5 — User Feedback Items:**
1. Sticky timecode display + transport at top of Show view
2. Per-department cue state: active until replaced by next same-department cue (rewrote countdown engine)
3. Ready/Go countdown visualization with consistent layout (no size jumps between states)
4. Cue numbering: auto-generated (Q1, Q2...), displayed in cue cards, manage table, Ready/Go, editable in modal
5. Stable cue ordering: cues stay in timecode order, state changes expressed through color/border only (no position shifts)

**Phase 6 — Display Overhaul (Operator Focus):**
1. Dominant timecode: 8rem default, reduced padding, readable across the room
2. Transport hidden behind toggle: Show view is a read-only cue monitor by default
3. Countdown dominant on cue cards: 1.4rem bold countdown, dimmed 0.7rem trigger TC
4. DOM diffing: cue cards updated in place by ID, no innerHTML replacement, smooth CSS transitions
5. Keyboard hints removed from sticky header to reclaim vertical space

**Phase 7 — Dashboard Layout Overhaul v2:**
1. 5-section vertical layout: stacked passed deck -> stacked triggered deck -> timer+controls -> Ready/Go zone -> coming cues
2. Stacked deck containers: cards overlap with negative margins (~8px edge visible), hover to expand, fold on scroll
3. Transport controls split into 2 rows: Prev/Play/Pause/Stop/Next + Goto input below
4. Dedicated animated Ready/Go zone: READY -> 3 -> 2 -> 1 -> GO! with CSS pop/shake/flash animations
5. Click-to-goto: clicking any cue card loads its timecode into the Goto input
6. Prev/Next cue navigation buttons step through cues by timecode order
7. Scroll-fold: above-timer sections collapse to thin bars when scrolling down in upcoming cues
8. New keyboard shortcuts: N (next cue), B (previous cue)

**Phase 8 — Show View Clarity Redesign:**
1. Replaced stacked passed cue deck with count badge ("N passed") + expandable dropdown
2. Replaced stacked triggered cue deck with compact active strips (28px rows with dept-color border + checkmark)
3. Unified all cue card sizing: same padding and font sizes for all tiers (active/warning/near/far/distant/passed)
4. Tier differentiation is color-only: border color, text color, box-shadow glow, opacity — no size changes
5. Eliminates all layout shifts when cues change state during live show
6. Traffic-light Ready/Go countdown colors: red (READY) -> red-orange (3) -> orange (2) -> yellow-green (1) -> green (GO!)
7. Timer controls moved below timer in centered row (meta+timer on top, controls below)
8. Scroll-fold collapses above-timer sections (max-height:0 + opacity transition, freeing space)

**Phase 9 — Ready/Go & Broadcast Polish:**
1. Ready/Go two-element countdown: READY label stays visible while 3->2->1 digits appear alongside (both 1.4rem, fixed 2.2rem row height)
2. GO! shows department name: "GO! — Sound" in green, replaces READY label at zero
3. Traffic-light colors on READY text, digits, and progress bar: red (>3s) -> orange (3) -> yellow (2) -> green (1) -> green (GO!)
4. Fixed-height countdown row prevents layout shifts during state transitions
5. Frame-accurate timecode: countdown engine broadcasts every 100ms tick (was second-boundary only), cue states cached and recomputed on second change
6. Scroll-fold space collapse: above-timer sections now use max-height:0 + overflow:hidden transition (was opacity-only, leaving dead space)
7. Backend-driven `CueState::Go`: engine emits Go state for 2s after trigger, frontend uses single unified `renderReadyGo()` code path
8. Progress bar fills 0%->100% as cue approaches trigger
9. In-place DOM updates during 3-2-1 countdown preserve CSS transitions (no innerHTML rebuilds)

---

## Phase 10: Unit & Integration Tests -- Done
**Goal:** Establish test coverage for critical logic.

73 tests implemented:
- Unit tests in `src/timecode/types.rs` (34): round-trip frame math, drop-frame edge cases, parse/display, add_frames, to_seconds_f64
- Unit tests in `src/cue/store.rs` (24): CRUD, cascading delete, sorting, filtering, bulk import, cue numbers, persistence round-trip
- Integration tests in `tests/api.rs` (15): HTTP endpoint tests for departments and cues CRUD, bulk import, status codes

---

## Phase 10.5: Cue Field Expansion -- Done
**Goal:** Align cue model with professional show controller features.

New fields on `Cue`: `duration` (Option\<u32\>), `armed` (bool), `color` (Option\<String\>), `continue_mode` (ContinueMode enum), `post_wait` (Option\<f64\>).
New `ContinueMode` enum: Stop, AutoContinue, AutoFollow.
Updated `CueStatus` broadcast: includes `armed`, `duration`, `color`, `elapsed_sec`.
Countdown engine: filters disarmed cues, duration-based Passed transition, elapsed_sec computation.

---

## Phase 10.6: Backend-Driven Go State + ReadyGo Polish -- Done
**Goal:** Fix GO! visual inconsistency and polish ReadyGo rendering.

1. **Backend Go state**: Added `CueState::Go` to state machine. Countdown engine emits `Go` for 2 seconds after trigger (`GO_HOLD_SECONDS`), eliminating frontend race conditions
2. **Progress bar direction**: Fixed to fill 0%->100% (was inverted 100%->0%) in both ReadyGo zone and upcoming flow cards
3. **Traffic-light READY text**: Status text color now follows the same red->orange->yellow->green sequence as digits and progress bar
4. **Smooth DOM transitions**: ReadyGo zone uses in-place DOM updates during 3-2-1 countdown instead of full innerHTML rebuilds, preserving CSS transitions on progress bar
5. **Frontend cleanup**: Removed `renderGoFlash()`, `readygoCueId`, `readygoGoTimer` globals — no longer needed with backend-driven Go state
6. Mock data files updated with all new cue fields (duration, armed, color, continue_mode, post_wait)

---

## Phase 11: Authentication -- Done (superseded by Phase 14)
**Goal:** Auth to protect admin operations while keeping crew view open.

Originally PIN-based, now replaced by user-based auth with 5 roles (see Phase 14).
- `require_auth` middleware: skips auth if no users configured, allows GET freely, protects POST/PUT/DELETE
- Token via `Authorization: Bearer <token>` header or `?token=` query param (for WebSocket)
- Endpoints: `GET /api/auth/status`, `POST /api/auth/login`, `POST /api/auth/logout`
- Config: `SHOWPULSE_PIN` env var seeds admin user on first run (unset + no users = open access)

---

## Phase 12: Security Hardening -- Mostly Done
**Goal:** Production-ready security posture for LAN deployment.

Implemented in `src/main.rs`:
- Security headers: `X-Content-Type-Options: nosniff`, `X-Frame-Options: DENY`
- CORS: restricted to `http://localhost:{port}` (same-origin)
- Body limit: `DefaultBodyLimit::max(1MB)`
- Concurrency limit: `ConcurrencyLimitLayer::new(50)`
- WebSocket client limit: `MAX_WS_CLIENTS = 100`
- Input validation in `src/cue/store.rs`: string clamping, color hex validation, timecode range validation, post_wait clamping

Remaining: rate limiting on login endpoint, CSP headers

---

## Phase 14: User Management & Role-Based Access -- Done
**Goal:** Multi-user authentication with 5 permission levels and exclusive timer control.

### Role Hierarchy

| Role | Level | Show | Manage | Settings | Timer Control | User CRUD |
|------|-------|------|--------|----------|---------------|-----------|
| Viewer | 1 | View (filtered to assigned depts) | -- | -- | -- | -- |
| Crew Lead | 2 | View (filtered to assigned depts) | -- | -- | -- | -- |
| Operator | 3 | View | Full (Editor) | -- | -- | -- |
| Manager | 4 | View | Full (Editor) | Full | Yes (must acquire lock) | -- |
| Admin | 5 | View | Full (Editor) | Full | Yes (bypasses lock) | Full |

### Timer Lock
- Only one Manager can control the timer at a time (exclusive lock)
- Admin always bypasses the lock
- Lock acquired via `POST /api/timer-lock`, released via `DELETE /api/timer-lock`
- Generator transport endpoints (play/pause/stop/goto/config) require Manager+ role AND timer lock

### Implementation

**Backend (`src/auth.rs`):**
- `Role` enum: Viewer(1), CrewLead(2), Operator(3), Manager(4), Admin(5) with `level()` helper
- `User` struct: id, name, pin, role, departments (persisted in `ShowData.users`)
- `TimerLock` struct + `TimerLockState` (Arc<RwLock<Option<TimerLock>>>)
- `Session` struct: carries user_id, name, role, departments per token
- `SessionStore`: maps tokens -> sessions, `open_access` mode for no-user setups
- `require_role()`: extracts session from request extensions, checks minimum role
- `require_timer_access()`: checks Admin or matching timer lock
- Login: `{ name, pin }` -> `{ token, role, name, departments }`

**API endpoints:**
- `GET/POST /api/users` — list (Admin, PINs stripped) / create (Admin)
- `PUT/DELETE /api/users/:id` — update / delete (Admin, self-delete blocked)
- `GET/POST/DELETE /api/timer-lock` — status / acquire (Manager+, 409 if taken) / release

**Frontend (`static/js/auth.js`):**
- Login overlay (z-index 310, above loading spinner)
- Role-based tab gating: Viewer/CrewLead -> Show only, Operator -> +Editor, Manager -> +Settings, Admin -> +Users panel
- Transport controls hidden for roles below Manager
- Timer lock UI: "Take Control" / "Release" button for Managers
- User management panel in Settings (Admin): list, add, edit, delete users with role + department assignment
- Token persisted to localStorage, auto-login on refresh, 401 -> re-show login

**Migration path:**
- `SHOWPULSE_PIN=xxxx` auto-creates admin user named "admin" on first run
- No users configured -> open access mode (all endpoints open, no login required)
- `ShowData.users` field uses `#[serde(default)]` for backwards-compatible JSON

---

## Phase 15: Acts, Show Name & Navbar Rebuild -- Done
**Goal:** Add act grouping for cues, configurable show name, and fix the navbar layout.

### Acts
- `Act` struct: `{ id: Uuid, name: String, sort_order: u32 }` with serde defaults
- CRUD: `GET/POST /api/acts`, `PUT/DELETE /api/acts/:id`, `POST /api/acts/:id/shift`
- Cues reference acts via optional `act_id` field
- Flow view groups cues by act with divider headers (line + inline text)
- Act groups collapsible: double-click header, or floating controls (Collapse All / Expand All)
- Collapsed state preserved across re-renders via `data-act-id` DOM attributes
- Editor view: Act CRUD panel with cue count per act, act selector in cue modal
- Demo seed: 3 acts (Pre-show, Act 1, Act 2) with cues assigned

### Show Name
- `GET/PUT /api/show/name` endpoints
- Show name displayed centered in navbar
- Editable in Settings view
- Included in show export/import

### Navbar Rebuild
- Three-section flex layout: tabs (shrink-to-fit) | show name (flex:1 centered) | nav-right (connection dot + user)
- WebSocket connection indicator (green/red dot) in nav-right
- Fixed orphaned CSS from previous `.topnav .brand .dot` structure

---

## Phase 16: Flow Controls & Act Header Polish -- Done
**Goal:** Add flow controls for cue list navigation, polish act dividers.

- Auto-scroll (Auto) and jump-to-current (Now) buttons added as flow controls
- Collapse All / Expand All list controls added
- Controls placed in timer panel bottom row (same row as GoTo — GoTo left, controls right)
- Act header styling: increased spacing between act groups, colored separator lines
- Keyboard shortcuts: A (auto-scroll toggle), C (jump to current)

---

## Phase 17: Script Maintenance -- Done
**Goal:** Clean, hardened, structured codebase. Easy to understand and maintain.

Results: -501 lines (-18% total JS), zero new features added.

1. **CRUD helpers** (`apiSave`, `apiDelete`): Eliminated 8 copy-paste save/delete patterns across department, cue, act, and user management
2. **Module cleanup**: Merged standalone `diffCueList()` into `diffCueListWithActs()`, split `updateFlowCard()` into 3 focused functions (`updateWarningRow`, `clearWarningRow`, `updateProgressBar`), extracted `canControlTimer()` guard
3. **Dead code removal**: Removed `getMyUserId()` stub, cleaned up unused globals
4. **Error hardening**: WS message validation (type checks before DOM access), edge case handling
5. **Documentation**: JSDoc on all previously undocumented functions, file header indices updated

---

## Phase 18: Visual Polish -- Done
**Goal:** Always-visible countdown, warning easing, vivid department colors.

1. **T- countdown always visible**: Countdown badge stays visible during warning/go states (was previously hidden)
2. **T+ elapsed time**: After trigger, shows `T+Xm XXs` using `elapsed_sec` from WS broadcast (replaces checkmark)
3. **Warning entry easing**: CSS animation chain — `warn-enter` (0.6s smooth border/glow transition) followed by `warn-pulse` (1.5s infinite loop at 0.6s delay). Countdown row slides open with `max-height`/`opacity`/`padding-top` transitions
4. **Vivid department colors**: Removed card-level opacity, applied per-element dimming to text/countdown only. Dept-bar and dept-dot stay at full brightness across all tiers. `updateFlowCard()` refreshes dept-bar and dept-dot colors every render cycle

---

## Phase 19: Editor Tab Overhaul -- Done
**Goal:** Transform the Manage tab into a full-featured Editor with professional cue list editing capabilities.

7 milestones implemented (M1-M7):

1. **Act-Grouped Cue List (M1):** Cues grouped by act with collapsible headers showing cue count and time span. Replaces old flat cue table
2. **Drag & Drop (M2):** Grip handle to drag cues within and between acts. Drop on act headers to move cues. Auto-calculates new timecodes. Uses HTML5 Drag & Drop API with grip handle activation
3. **Inline Quick Edit (M3):** Double-click label, timecode, department, or warning time to edit in place. Enter saves, Escape cancels. Uses event delegation with dblclick
4. **Multi-Select & Bulk Ops (M4):** Checkbox per cue, shift-click range select, act header select-all. Floating bulk action bar: move to act, duplicate, delete, arm/disarm. Bulk ops run in parallel via Promise.all
5. **Visual Timeline Strip (M5):** Horizontal timeline above cue list with act regions, department-colored cue markers, green playhead synced to current TC at 5Hz. Click markers to scroll to cue
6. **Duplicate Cue (M6):** One-click duplicate with TC+5s offset. Add-cue-to-act button on act headers
7. **Duplicate Act (M7):** Clone entire act with all cues, prompt for time offset

**Key files:** `static/js/manage.js` (all editor logic), `static/css/manage.css` (all editor styles), `static/js/state.js` (DOM cache: cueListBody, timelineStrip; secondsToTcObj utility), `static/js/ui-helpers.js` (init calls, playhead interval), `static/index.html` (timeline strip div, cue list container)

**State additions:** `selectedCues` (Set), `cueListCollapsed` (Set), `dragCueId`, `lastSelectedCueId`

All vanilla JS, zero external dependencies.

---

## Phase 20: Timeline Editor + Branding + Polish -- Done
**Goal:** Evolve the timeline strip into an interactive editor, integrate brand identity, polish UI.

### Timeline Editor (Phases 1-5)
1. **Zoom & Pan (Phase 1):** Mouse wheel cursor-anchored zoom (0.8/1.25 factor, min 5s visible), drag-to-pan on zoomed track. View state: `tlView.start`, `tlView.end`, `tlView.fullMin`, `tlView.fullMax`
2. **Click-to-Scrub (Phase 3):** Clicking unzoomed timeline track sends `POST /api/generator/goto` with computed timecode
3. **Minimap (Phase 4):** When zoomed, a 10px minimap shows full timeline with viewport indicator rect (accent border + 15% opacity fill)
4. **Tooltips (Phase 5):** Rich tooltips on cue marker hover via event delegation on single reused DOM element. Shows label, timecode, department (with color dot), and warning time
5. **Selection Sync (Phase 5):** Two-way sync between timeline markers and cue list checkboxes. `.tl-cue--selected` class with scaleX(2.5) + glow

### Branding Integration
- **Favicon:** Inline pulse waveform SVG data URI (no external files)
- **Login overlay:** Logomark SVG above h2 title
- **Loading overlay:** Logomark with breathing animation + "ShowPulse" text (replaces spinner)
- **Nav bar:** Full horizontal logo (waveform + text) top-left before tabs, 39px height
- **Print reports:** Horizontal logo in page headers, small logomark in footer
- All SVGs inlined for offline/single-binary compatibility, system font stack (no Google Fonts)

### UI Polish
- **Checkboxes:** Reduced to 12px, opacity 0.45 default / 0.7 hover / 0.85 checked
- **Timeline scoping:** CSS `#view-manage.active ~ .timeline-strip` — only visible on Editor tab
- **Show name centering:** Absolute positioning (`left: 50%; transform: translateX(-50%)`) for true center regardless of nav content
- **Sidebar overlap fix:** Increased sidebar top padding to 3.5rem to clear hamburger toggle button
- **Flow controls relocation:** Moved cue list controls (Now, Auto, Collapse, Expand) from floating bottom-right pill into the timer panel bottom row alongside GoTo
- **Auth fix:** `clearAuth()` on open-access mode to prevent stale localStorage tokens blocking permissions

### Data Generator
- `gen-rihanna.py`: Generates realistic 106-cue Rihanna concert (5 acts, 8 departments, 15+ songs, timecodes 00:15:00–01:25:00)

**Key files:** `static/js/timeline.js` (extracted timeline module), `static/js/manage.js`, `static/js/state.js` (CONST.NAV_LOGO), `static/js/import-export.js` (printLogo/printMark), `static/css/manage.css` (timeline/tooltip/minimap styles), `static/css/shell.css` (nav logo, show name, login/loading logo), `static/css/show.css` (sidebar padding fix), `static/index.html` (favicon, logos, meta tags)

---

## Phase 21: Hebrew / RTL Internationalization -- Done
**Goal:** Full Hebrew translation and RTL layout support for Israeli production crews.

- **Phase A — i18n infrastructure:** `i18n.js` module with `t(key, params)` lookup, `{param}` interpolation, `setLanguage()`, `applyLanguage()`. English and Hebrew dictionaries (~120 keys each). Language radio toggle in Settings with localStorage persistence. Script loaded second (after state.js).
- **Phase B — HTML `data-i18n` attributes:** All 5 modals (department, cue, act, user, confirm) tagged with `data-i18n`, `data-i18n-placeholder`, `data-i18n-title` attributes for static text translation.
- **Phase C — `applyI18nToDOM()` wiring:** DOM scanner function applies translations from `data-i18n*` attributes. Called at init and on language change via `refreshAllViews()`.
- **Phase D — JS string externalization:** ~100 hardcoded English strings across 9 JS files replaced with `t()` calls. Covers toasts, error messages, modal titles, button labels, status text, dashboard labels, filter labels, bulk operation feedback. Entity name keys (`entity.department/cue/act/user`) for generic CRUD helpers.
- **Phase E — Hebrew review:** Native speaker review complete. Ready/Go kept in English for all languages. Nav logo RTL fix (`direction: ltr`).
- **Phase F — Mobile + RTL verification:** Mobile-first responsive overhaul (8 sub-phases). Timer panel overflow fix. Touch targets, full-screen modals, `hover:none` action reveals.

**Key files:** `static/js/i18n.js` (dictionaries + engine), all 9 other JS files (t() calls), `static/index.html` (data-i18n attributes)

---

## Phase 22: Mobile-First Responsive Overhaul -- Done
**Goal:** Production-ready mobile experience for crew on phones/tablets.

- PWA meta tags (theme-color, apple-mobile-web-app)
- CSS variables: `--touch-min: 44px`, `--nav-height: 48px`
- Nav: hide logo/auth label at 640px, hide show name at 480px
- Show view: 38px transport buttons, stacked tc-left, full-width sidebar, hidden shortcuts
- Editor: 44px cue items, reduced timeline, bulk bar wrap
- Settings: data buttons wrap + touch sizing
- Modals: full-screen on phones, 44px footer buttons
- Touch: `@media (hover: none)` reveals hover-only actions, tap highlight suppression
- Timer panel overflow fix: removed min-width on buttons, stacked bottom row vertically at 480px

---

## Phase 13: Nice-to-haves (LOW PRIORITY)

| Feature | Description | Status |
|---------|-------------|--------|
| **QR code** | Generate QR with server URL for crew onboarding | Done (`GET /api/qr`) |
| **Multi-show** | Extend `ShowData` with show switching, show archiving | Planned |
| **Generator presets** | Save/load named configs in data file | Planned |
| **Print view** | CSS `@media print` stylesheet (analytical print report with charts already exists in `import-export.js`) | Planned |
| **Wake lock** | Prevent screen sleep on crew devices during show | Done |
| **Audio/vibration alerts** | Warning threshold alerts on crew devices | Planned |
| **Portable dist** | Embed `static/` into binary via rust-embed, single 4.1 MB .exe | Done |
| **Rate limiting** | Rate-limit login endpoint (tower middleware) | Done (5 attempts/60s per IP) |
| **CSP headers** | Content-Security-Policy header | Done |
| **URL auto-login** | `?user=Name&pin=1234` query param login for kiosk/headless clients | Done |
| **Admin dashboard** | Live connected users panel with auth status, timer lock, online duration | Done |
| **WS client cleanup** | Immediate stale connection removal on disconnect (tokio::select!) | Done |

---

## Verification Checklist

- [x] `cargo build` — compiles without errors
- [x] `cargo test` — 73 tests pass
- [x] Manual test: `cargo run` -> browser at `http://localhost:8080`
- [x] LTC: test with LTC audio from a generator app or DAW
- [x] MTC: test with MIDI loopback or DAW sending MTC
- [x] CSV import: test with 30-cue show file (`test-import-cues.csv`)
- [x] JSON import: test with 30-cue show file (`test-import-show.json`)
- [x] Each phase committed and pushed to GitHub

## Commit Strategy
One commit per completed feature or phase, pushed to GitHub after each.
