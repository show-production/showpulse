# ShowPulse — Implementation Plan & History

**Purpose:** Original design spec and execution history. All 23 phases are complete.
For the forward-looking roadmap, see [COMPETITIVE_ANALYSIS.md](COMPETITIVE_ANALYSIS.md) Section 9.
For current architecture and API reference, see [PROJECT_OVERVIEW.md](PROJECT_OVERVIEW.md).

**Repository:** https://github.com/show-production/showpulse

---

## Table of Contents

1. [Original Design Spec](#original-design-spec) — what we planned to build
2. [Execution Summary](#execution-summary) — milestone table
3. [Phase History](#phase-history) — detailed narrative of each phase as built

---

## Original Design Spec

The following sections preserve the original design intent from before implementation. The actual implementation follows this closely, with deviations noted in the milestone table.

### Architecture

```
+-----------------------------------------------------+
|                   Host Machine                      |
|                                                     |
|  +----------+   +--------------+   +------------+  |
|  | SMPTE LTC|-->|              |   |  Frontend   |  |
|  | (Audio In)|  |   Backend    |-->|  (Static)   |  |
|  +----------+   |  (Rust)      |   |  served by  |  |
|  +----------+   |              |   |  backend    |  |
|  | MIDI MTC |-->|  WebSocket   |   +------+------+  |
|  | (MIDI In)|   |  Server      |         |         |
|  +----------+   |              |         |         |
|  +----------+   |  Internal TC |         |         |
|  | TC Gen / |-->|  Generator   |         |         |
|  | Emulator |   |              |         |         |
|  +----------+   +------+-------+         |         |
|                        |                 |         |
|                   WebSocket            HTTP         |
|                        |                 |         |
+------------------------+-----------------+---------+
                         |                 |
                    Local WiFi Network     |
                         |                 |
              +----------v-----------------v--+
              |   Crew Devices (Browsers)     |
              |   Phone / Tablet / Laptop     |
              +-------------------------------+
```

### Phase 1: Timecode Core (designed)

- **SMPTE LTC:** `cpal` crate for audio capture. LTC bit decoding from audio stream (80-bit LTC frame). Parse hours, minutes, seconds, frames.
- **MIDI MTC:** `midir` crate for MIDI input. Parse MTC Quarter Frame messages (F1 xx) and Full Frame messages (F0 7F ... F7). Reconstruct full timecode from quarter-frame nibbles.
- **Shared timecode state:** `tokio::watch::channel` — single source of truth for "current show time."

### Phase 1 (cont.): Timecode Generator (designed)

| Mode | Description |
|------|-------------|
| **Freerun** | Starts from configurable start time, counts up at selected frame rate |
| **Countdown** | Counts down from specified duration to 00:00:00:00 |
| **Clock** | Uses system clock as timecode — maps wall-clock HH:MM:SS to timecode |
| **Loop** | Plays a configurable timecode range on repeat |

Generator internals: Tokio task advancing current_tc based on elapsed wall-clock time. Variable speed (0.25x-4x). REST API for play/pause/stop/goto. Source switching (LTC/MTC/Generator) via API.

### Phase 2: Cue Management (designed)

Data model: Department (id, name, color), Cue (id, department_id, label, trigger_tc, warn_seconds, notes), Act (id, name, sort_order). JSON file persistence (`showpulse-data.json`). Full CRUD API for departments, cues, acts.

### Phase 3: Countdown Engine & WebSocket (designed)

10Hz engine loop: read current timecode → compute time_remaining per cue → determine state (upcoming/warning/go/active/passed) → build per-department messages → broadcast via WebSocket. Clients subscribe to departments on connect.

### Phase 4: Frontend — Crew View (designed)

Vanilla HTML/CSS/JS (no framework, no build step). Dark theme. Three tabs: Show (crew countdown view), Editor (cue management), Settings (timecode config). Auto-reconnect WebSocket with visual indicator.

### Phase 5: Admin & Polish (designed)

Multi-show support, print view, QR onboarding, generator presets.

---

## Execution Summary

All milestones complete. Original design was followed closely. Key deviation: vanilla JS instead of originally-considered Vite/Preact/Solid — simplified deployment to true single-binary with no build step.

| # | Milestone | Key Result | Status |
|---|-----------|-----------|--------|
| 1 | Timecode core | Server reads LTC/MTC, runs internal TC generator, exposes `/api/timecode` | Done |
| 2 | Cue management | CRUD API + JSON persistence | Done |
| 3 | Countdown engine | WebSocket broadcasts live countdowns at 10Hz | Done |
| 4 | Crew frontend | Phones display countdowns from WebSocket | Done |
| 5 | Admin frontend | Browser-based cue/department management | Done |
| 6 | UI/UX polish | 15 UX fixes + 5 user feedback items | Done |
| 7 | Cue import | Bulk JSON/CSV import with validation | Done |
| 8 | Display overhaul | Dominant TC, DOM diffing, countdown-focused cards | Done |
| 9 | Dashboard v2 | 5-section layout, Ready/Go zone, cue navigation, scroll-fold | Done |
| 10 | Testing | 73 unit & integration tests | Done |
| 10.5 | Cue field expansion | Duration, armed, color, continue_mode, post_wait | Done |
| 10.6 | Go state polish | Backend CueState::Go, traffic-light colors, progress bar | Done |
| 11 | Authentication | PIN-based auth, SessionStore, middleware | Done |
| 12 | Security hardening | CORS, body/concurrency limits, CSP, rate limiting | Done |
| 13 | Nice-to-haves | QR, wake lock, portable dist, rate limiting, CSP, URL auto-login, admin dashboard, WS cleanup, session persistence, tab persistence, pinned sidebar | Done (11/15) |
| 14 | User management | 5 roles (Viewer→Admin), timer lock, role-based UI | Done |
| 15 | Acts & show name | Act CRUD, act grouping, show name, navbar rebuild | Done |
| 16 | Flow controls | Now/Auto/Collapse/Expand, act header polish | Done |
| 17 | Script maintenance | -501 lines (-18%), CRUD helpers, JSDoc | Done |
| 18 | Visual polish | T-/T+ countdown, warning easing, vivid dept colors | Done |
| 19 | Editor overhaul | Drag-and-drop, inline edit, multi-select, timeline strip, duplication | Done |
| 20 | Timeline + branding | Zoom/pan, minimap, tooltips, selection sync, SVG branding | Done |
| 21 | i18n | Hebrew/RTL, i18n engine, ~120 keys, data-i18n attributes | Done |
| 22 | Mobile responsive | PWA meta, touch targets, full-screen modals, hover:none | Done |
| 23 | Session/tab/crew panel | Persistent sessions, tab persistence, merged crew+dept panel, pinned sidebar | Done |

**Remaining nice-to-haves** (4 items not yet implemented): multi-show support, generator presets, print view, audio/vibration alerts. These are now part of the strategic roadmap in [COMPETITIVE_ANALYSIS.md](COMPETITIVE_ANALYSIS.md) Section 9.

---

## Phase History

Detailed narrative of each phase as actually implemented.

### Phases 1-2: LTC & MTC Decoding

**Phase 1 — LTC Audio Decoding:** cpal-based decoder with bi-phase zero-crossing detection, 80-bit frame extraction, BCD parsing, sync word (0x3FFD). Dedicated OS thread. API: `GET /api/ltc/devices`, `PUT /api/ltc/device`, `POST /api/ltc/stop`.

**Phase 2 — MTC MIDI Decoding:** midir-based decoder with quarter-frame accumulation (8 messages → full TC), full-frame SysEx parsing. Dedicated OS thread. API: `GET /api/mtc/devices`, `PUT /api/mtc/device`, `POST /api/mtc/stop`.

### Phase 3: UI/UX Improvements (15 items)

Disconnection banner, keyboard hints, confirm modals replacing native `confirm()`, "Lead Time" column rename, speed suffix, data panel separation, `setSource()` fix, table scroll, touch targets, loading spinner, toast notifications, passed cues toggle, TC size label, live color preview, favicon.

### Phase 4: CSV/JSON Cue Import

`POST /api/cues/import` bulk endpoint that replaces all existing cues, department validation, single persist. Frontend CSV parser with column aliases, JSON array/wrapper support, import button in Editor view. `importShow()` deletes all existing departments+cues before importing new ones.

### Phase 5: User Feedback Items

1. Sticky timecode display + transport at top of Show view
2. Per-department cue state: active until replaced by next same-department cue (rewrote countdown engine)
3. Ready/Go countdown visualization with consistent layout (no size jumps between states)
4. Cue numbering: auto-generated (Q1, Q2...), displayed in cue cards, manage table, Ready/Go, editable in modal
5. Stable cue ordering: cues stay in timecode order, state changes expressed through color/border only (no position shifts)

### Phase 6: Display Overhaul (Operator Focus)

1. Dominant timecode: 8rem default, reduced padding, readable across the room
2. Transport hidden behind toggle: Show view is a read-only cue monitor by default
3. Countdown dominant on cue cards: 1.4rem bold countdown, dimmed 0.7rem trigger TC
4. DOM diffing: cue cards updated in place by ID, no innerHTML replacement, smooth CSS transitions
5. Keyboard hints removed from sticky header to reclaim vertical space

### Phase 7: Dashboard Layout Overhaul v2

1. 5-section vertical layout: stacked passed deck → stacked triggered deck → timer+controls → Ready/Go zone → coming cues
2. Stacked deck containers: cards overlap with negative margins (~8px edge visible), hover to expand, fold on scroll
3. Transport controls split into 2 rows: Prev/Play/Pause/Stop/Next + Goto input below
4. Dedicated animated Ready/Go zone: READY → 3 → 2 → 1 → GO! with CSS pop/shake/flash animations
5. Click-to-goto: clicking any cue card loads its timecode into the Goto input
6. Prev/Next cue navigation buttons step through cues by timecode order
7. Scroll-fold: above-timer sections collapse to thin bars when scrolling down in upcoming cues
8. New keyboard shortcuts: N (next cue), B (previous cue)

### Phase 8: Show View Clarity Redesign

1. Replaced stacked passed cue deck with count badge ("N passed") + expandable dropdown
2. Replaced stacked triggered cue deck with compact active strips (28px rows with dept-color border + checkmark)
3. Unified all cue card sizing: same padding and font sizes for all tiers
4. Tier differentiation is color-only: border color, text color, box-shadow glow, opacity — no size changes
5. Eliminates all layout shifts when cues change state during live show
6. Traffic-light Ready/Go countdown colors: red (READY) → red-orange (3) → orange (2) → yellow-green (1) → green (GO!)
7. Timer controls moved below timer in centered row
8. Scroll-fold collapses above-timer sections (max-height:0 + opacity transition)

### Phase 9: Ready/Go & Broadcast Polish

1. Ready/Go two-element countdown: READY label stays visible while 3→2→1 digits appear alongside
2. GO! shows department name: "GO! — Sound" in green
3. Traffic-light colors on READY text, digits, and progress bar
4. Fixed-height countdown row prevents layout shifts
5. Frame-accurate timecode: countdown engine broadcasts every 100ms tick, cue states cached and recomputed on second change
6. Scroll-fold space collapse: max-height:0 + overflow:hidden transition
7. Backend-driven `CueState::Go`: engine emits Go state for 2s after trigger
8. Progress bar fills 0%→100% as cue approaches trigger
9. In-place DOM updates during 3-2-1 countdown preserve CSS transitions

### Phase 10: Unit & Integration Tests

73 tests implemented:
- Unit tests in `src/timecode/types.rs` (34): round-trip frame math, drop-frame edge cases, parse/display, add_frames, to_seconds_f64
- Unit tests in `src/cue/store.rs` (24): CRUD, cascading delete, sorting, filtering, bulk import, cue numbers, persistence round-trip
- Integration tests in `tests/api.rs` (15): HTTP endpoint tests for departments and cues CRUD, bulk import, status codes

### Phase 10.5: Cue Field Expansion

New fields on `Cue`: `duration` (Option\<u32\>), `armed` (bool), `color` (Option\<String\>), `continue_mode` (ContinueMode enum), `post_wait` (Option\<f64\>). Countdown engine: filters disarmed cues, duration-based Passed transition, elapsed_sec computation.

### Phase 10.6: Backend-Driven Go State + ReadyGo Polish

1. Backend Go state: `CueState::Go` emitted for 2s after trigger (`GO_HOLD_SECONDS`)
2. Progress bar: fixed to fill 0%→100%
3. Traffic-light READY text color follows same sequence as digits and progress bar
4. Smooth DOM transitions: in-place updates preserve CSS transitions
5. Frontend cleanup: removed `renderGoFlash()`, `readygoCueId`, `readygoGoTimer` globals

### Phase 11: Authentication (superseded by Phase 14)

Originally PIN-based, now replaced by user-based auth with 5 roles.
- `require_auth` middleware: skips auth if no users configured, allows GET freely, protects POST/PUT/DELETE
- Token via `Authorization: Bearer <token>` header or `?token=` query param
- Config: `SHOWPULSE_PIN` env var seeds admin user on first run

### Phase 12: Security Hardening

- Security headers: `X-Content-Type-Options: nosniff`, `X-Frame-Options: DENY`, `Content-Security-Policy`
- CORS: restricted to same-origin
- Body limit: 1MB. Concurrency limit: 50. WebSocket client limit: 100
- Rate limiting: 5 login attempts per 60s per IP
- Input validation: string clamping, color hex validation, timecode range validation, post_wait clamping

### Phase 14: User Management & Role-Based Access

**Role Hierarchy:**

| Role | Level | Show | Manage | Settings | Timer | Users |
|------|-------|------|--------|----------|-------|-------|
| Viewer | 1 | View (dept-filtered) | -- | -- | -- | -- |
| Crew Lead | 2 | View (dept-filtered) | -- | -- | -- | -- |
| Operator | 3 | View | Full | -- | -- | -- |
| Manager | 4 | View | Full | Full | Lock required | -- |
| Admin | 5 | View | Full | Full | Bypasses lock | Full |

**Backend:** `Role` enum with `level()` helper. `User` struct with id, name, pin, role, departments. `TimerLock` for exclusive Manager control. `Session` struct with u64 Unix epoch `created_at`, serializable, persisted to `ShowData.sessions`.

**Frontend:** Login overlay, role-based tab gating, transport hidden below Manager, timer lock UI, user management panel in Settings (Admin).

**Migration:** `SHOWPULSE_PIN=xxxx` seeds admin user. No users = open access. `#[serde(default)]` for backwards compatibility.

### Phase 15: Acts, Show Name & Navbar Rebuild

**Acts:** `Act` struct with CRUD. Cues reference acts via optional `act_id`. Flow view groups by act with collapsible divider headers. Demo seed: 3 acts.

**Show Name:** `GET/PUT /api/show/name`. Centered in navbar. Included in export/import.

**Navbar:** Three-section flex layout: tabs | show name | nav-right (connection dot + user).

### Phase 16: Flow Controls & Act Header Polish

Auto-scroll (Auto) and jump-to-current (Now) buttons. Collapse All / Expand All. Controls in timer panel bottom row. Act header styling with colored separator lines. Keyboard shortcuts: A (auto-scroll), C (jump to current).

### Phase 17: Script Maintenance

Results: -501 lines (-18% total JS), zero new features.
1. CRUD helpers (`apiSave`, `apiDelete`): eliminated 8 copy-paste patterns
2. Module cleanup: merged `diffCueList()` into `diffCueListWithActs()`, split `updateFlowCard()` into 3 functions
3. Dead code removal, error hardening, JSDoc on all functions

### Phase 18: Visual Polish

1. T- countdown always visible during warning/go states
2. T+ elapsed time after trigger using `elapsed_sec` from WS broadcast
3. Warning entry easing: CSS animation chain (`warn-enter` 0.6s + `warn-pulse` 1.5s infinite)
4. Vivid department colors: per-element dimming, dept-bar and dept-dot stay full brightness

### Phase 19: Editor Tab Overhaul (7 milestones)

1. **Act-Grouped Cue List:** Collapsible headers with cue count and time span
2. **Drag & Drop:** HTML5 DnD with grip handle, within/between acts, auto-timecode recalculation
3. **Inline Quick Edit:** Double-click label/timecode/department/warning. Enter saves, Escape cancels
4. **Multi-Select & Bulk Ops:** Checkbox + shift-click range. Floating action bar: move/duplicate/delete/arm/disarm
5. **Visual Timeline Strip:** Act regions, department-colored markers, 5Hz playhead, click-to-scroll
6. **Duplicate Cue:** One-click with TC+5s offset. Add-cue button on act headers
7. **Duplicate Act:** Clone with all cues, time offset prompt

### Phase 20: Timeline Editor + Branding + Polish

**Timeline Editor:** Cursor-anchored zoom (0.8/1.25 factor), drag-to-pan, click-to-scrub, 10px minimap with viewport indicator, rich tooltips, two-way selection sync with cue list.

**Branding:** Inline SVG favicon, login/loading logomarks with breathing animation, nav bar horizontal logo (39px), print report logos. All inlined for offline/single-binary compatibility.

**UI Polish:** Reduced checkboxes, timeline scoping to Editor tab, show name centering, sidebar overlap fix, flow controls relocation, auth fix for open-access mode.

**Data Generator:** A Python script was used during development to generate a 106-cue Rihanna concert dataset (5 acts, 8 departments) for testing. The script is not included in the repository.

### Phase 21: Hebrew / RTL Internationalization

- i18n engine: `i18n.js` with `t(key, params)` lookup, `{param}` interpolation, `setLanguage()`, `applyLanguage()`
- English and Hebrew dictionaries (~120 keys each). Language toggle in Settings
- HTML `data-i18n` attributes on all 5 modals. `applyI18nToDOM()` scanner
- ~100 hardcoded strings across 9 JS files replaced with `t()` calls
- Native Hebrew speaker review. Ready/Go kept in English for all languages

### Phase 22: Mobile-First Responsive Overhaul

- PWA meta tags (theme-color, apple-mobile-web-app)
- CSS variables: `--touch-min: 44px`, `--nav-height: 48px`
- Nav: hide logo/auth at 640px, show name at 480px
- Show view: 38px transport, stacked tc-left, full-width sidebar
- Editor: 44px cue items, reduced timeline, bulk bar wrap
- Modals: full-screen on phones, 44px footer buttons
- Touch: `@media (hover: none)` reveals hover-only actions

### Phase 23: Session Persistence, Tab Persistence & Crew Panel

1. **Session persistence:** `Session.created_at` changed from `Instant` to `u64` Unix epoch. `SessionStore` with optional `CueStore` ref for auto-persisting to `ShowData.sessions`. Sessions survive server restarts.
2. **Tab persistence:** Active tab saved to `localStorage('showpulse-tab')`, restored on page load via `switchTab()`.
3. **Merged crew + department panel:** Crew status panel shows department names as clickable cue filters. Filtered-out departments dim to 0.35 opacity. "All" button resets.
4. **Pinned sidebar:** Manager+ on ≥1200px screens gets sidebar pinned open (`position: relative` flex member). Backdrop and toggle hidden when pinned.

---

## Verification Checklist

- [x] `cargo build` — compiles without errors
- [x] `cargo test` — 73 tests pass
- [x] Manual test: `cargo run` → browser at `http://localhost:8080`
- [x] LTC: test with LTC audio from a generator app or DAW
- [x] MTC: test with MIDI loopback or DAW sending MTC
- [x] CSV import: tested with 30-cue show file
- [x] JSON import: tested with 30-cue show file
- [x] Each phase committed and pushed to GitHub
