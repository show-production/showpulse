# ShowPulse - Project Overview & Code Review

## What is ShowPulse?

A self-hosted, local-WiFi show management platform for live productions. It reads SMPTE LTC and MIDI MTC timecode, manages cue lists for multiple departments (lighting, sound, pyro, etc.), and pushes real-time countdown alerts to crew devices via WebSocket-connected browsers.

## Architecture

**Stack:** Rust + Tokio + Axum (HTTP/WebSocket), JSON file persistence, no database. Single-page HTML/CSS/JS frontend.

**Runtime flow:**
1. Timecode sources (LTC/MTC/Generator) write current timecode to `watch` channels
2. `TimecodeManager` provides unified access to the active source
3. Countdown engine (10Hz loop) computes cue states and broadcasts via WebSocket
4. Crew devices receive filtered countdown data per department subscription

```
Timecode Sources --> TimecodeManager --> Countdown Engine --> WsHub --> Crew Browsers
  (LTC/MTC/Gen)                               |
                                           CueStore (JSON file)
```

## Running the App

```bash
cargo run
# Server starts on http://0.0.0.0:8080
```

- **Local access:** `http://localhost:8080`
- **LAN access:** `http://<your-ip>:8080` (ensure firewall allows port 8080)
- **Windows firewall:** `New-NetFirewallRule -DisplayName "ShowPulse" -Direction Inbound -Protocol TCP -LocalPort 8080 -Action Allow`

On first launch with no data file, the app seeds 6 demo departments, 3 acts, and 22 cues automatically.

Dependencies: Rust toolchain + cpal (audio) + midir (MIDI). On Windows, requires Visual Studio Build Tools with C++ workload.

## Frontend (Web UI)

Single-page app served from `static/index.html` with three tabs (Show, Editor, Settings):

| Tab | Purpose |
|-----|---------|
| **Show** | Clean dashboard: passed cues count badge (click to expand dropdown), active cue strips (compact rows with dept color + checkmark), centered timer with 2-row transport controls (Prev/Play/Pause/Stop/Next + Goto), animated Ready/Go countdown zone (READY stays visible while 3-2-1 digits appear alongside, then GO! with dept name — traffic-light colors, fixed-height layout, pop/flash effects), scrollable coming cues with uniform-size cards (color-only tier differentiation, no layout shifts). Act-grouped cue list with collapsible groups (double-click header or floating controls). Floating controls pill (Now/Auto/Collapse/Expand) at bottom-right. Always-visible T- countdown and T+ elapsed time. Warning entry easing animation. Vivid department colors across all tiers. Click any cue to load TC into Goto. Prev/Next cue navigation. Sidebar with merged crew status + department filter panel (clickable department names toggle cue filtering, online/offline dots per user). Sidebar auto-pins open for Manager+ on wide screens (≥1200px). DOM-diffed cue cards. Frame-accurate timecode display (10Hz). Show name in navbar. Tab state persisted to localStorage |
| **Editor** | Act-grouped cue list with collapsible headers (cue count + time span), drag-and-drop reordering (grip handle, within/between acts, auto-timecode recalculation), inline quick edit (double-click label/timecode/department/warning time), multi-select with bulk operations (checkbox + shift-click range, floating action bar: move to act/duplicate/delete/arm/disarm), interactive timeline strip (zoom/pan, click-to-scrub, minimap when zoomed, rich tooltips on hover, two-way selection sync with cue list, act regions, department-colored cue markers, green playhead synced at 5Hz), one-click cue duplicate (TC+5s offset, add-cue button on act headers), act duplication (clone all cues with time offset prompt). Department CRUD (left panel), Act CRUD (name + sort order), CSV/JSON bulk import |
| **Settings** | Timecode source selector (Generator/LTC/MTC) with device selectors, frame rate, generator mode, speed, start TC, show name editor, theme colors (live preview), TC size slider, server info panel (LAN IP, port, QR code) |

| **Auth** | Login overlay (name+PIN), role-based tab gating, timer lock acquire/release for Managers, user management panel for Admins, logout button + user label in navbar |

**Keyboard shortcuts (Show tab):** Space = Play, P = Pause, Escape = Stop, N = Next cue, B = Previous cue, G = Focus goto input, S = Toggle sidebar, A = Auto-scroll, C = Jump to current

**WebSocket:** Auto-connects for real-time timecode updates. Green dot indicator in top-right. Falls back to 1s polling if WebSocket disconnects.

## Current Implementation Status

### Completed

| Component | File(s) | Status |
|-----------|---------|--------|
| Timecode types | `src/timecode/types.rs` | Full: Timecode struct, FrameRate enum (24/25/29.97df/30), frame math, drop-frame support, parse/display |
| Timecode generator | `src/timecode/generator.rs` | Full: Freerun, Countdown, Clock (wall-clock sync), Loop modes. Variable speed. Command channel architecture |
| Timecode manager | `src/timecode/mod.rs` | Full: Source switching (LTC/MTC/Generator), unified status API, device management access |
| LTC decoder | `src/timecode/ltc.rs` | Full: cpal audio capture, bi-phase zero-crossing detection, 80-bit LTC frame extraction, BCD timecode parsing, sync word (0x3FFD). Dedicated OS thread. Device listing and selection API |
| MTC decoder | `src/timecode/mtc.rs` | Full: midir MIDI input, quarter-frame accumulation (8 messages -> full TC), full-frame SysEx parsing, frame rate detection. Dedicated OS thread. Port listing and selection API |
| Cue/Department models | `src/cue/types.rs` | Full: Department, Cue (with serde defaults + cue_number + duration/armed/color/continue_mode/post_wait), ContinueMode enum, ShowData, CueState (Upcoming/Warning/Go/Active/Passed), CueStatus (with armed/duration/color/elapsed_sec), CueImportError, CueImportResult |
| Cue store | `src/cue/store.rs` | Full: In-memory with JSON file persistence, CRUD for departments/cues/acts, show name, bulk import (replaces existing cues) with validation, act shift (moves all act cues), auto-generated cue numbers (Q1, Q2...), input sanitization (string clamping, color validation, post_wait clamping), auto-seed on empty store |
| REST API - Timecode | `src/api/timecode.rs` | Full: GET status, PUT source |
| REST API - Generator | `src/api/generator.rs` | Full: GET status, PUT config, POST play/pause/stop/goto |
| REST API - Departments | `src/api/departments.rs` | Full: CRUD (list, create, update, delete) |
| REST API - Cues | `src/api/cues.rs` | Full: CRUD + department filter + bulk import (`POST /api/cues/import`) + full show import (`POST /api/show/import`) |
| REST API - Acts | `src/api/acts.rs` | Full: CRUD + act shift (`POST /api/acts/:id/shift`) |
| REST API - Show | `src/api/show.rs` | Full: GET/PUT show name |
| REST API - LTC | `src/api/ltc.rs` | Full: GET devices, PUT device (select + start), POST stop |
| REST API - MTC | `src/api/mtc.rs` | Full: GET devices, PUT device (select + start), POST stop |
| WebSocket hub | `src/ws/hub.rs` | Full: Broadcast with per-client department filtering, subscribe protocol |
| Countdown engine | `src/engine/countdown.rs` | Full: 10Hz tick with frame-accurate broadcast, per-department cue state tracking (active until replaced by next dept cue), disarmed cue filtering, duration-based Passed transition, elapsed_sec computation, backend-driven Go state (2s `GO_HOLD_SECONDS` hold before Active), cached cue states with second-boundary recomputation, 60s passed-cue cleanup |
| Config | `src/config.rs` | Full: port, bind_address, data_file, optional PIN — all via env vars (`SHOWPULSE_PORT`, `SHOWPULSE_BIND`, `SHOWPULSE_DATA_FILE`, `SHOWPULSE_PIN`) |
| Authentication | `src/auth.rs` | Full: User-based auth with 5 roles (Viewer->Admin), `SessionStore` mapping tokens->sessions (persisted to JSON, survive restarts), `require_auth` middleware, `require_role()` + `require_timer_access()` guards, Bearer token or `?token=` query param |
| User management | `src/api/users.rs` | Full: CRUD (Admin only), PINs stripped from list response, self-delete blocked |
| Timer lock | `src/api/timer_lock.rs` | Full: Exclusive timer control — acquire (Manager+, 409 if taken), release, status |
| Server entrypoint | `src/main.rs` | Full: Axum router with 46 API routes + WS, auth middleware, CORS (same-origin), body limit (1MB), concurrency limit (50), security headers, state wiring, user seeding from SHOWPULSE_PIN, seed on startup, static file fallback |
| Web UI - Show view | `static/index.html`, `static/js/show.js` | Full: Clean dashboard with centered timer + 2-row transport (Prev/Next/Play/Pause/Stop + GoTo), act-grouped cue list with collapsible groups (double-click header), floating controls pill (Now/Auto/Collapse/Expand), traffic-light countdown colors, always-visible T-/T+ countdown, warning entry easing, vivid dept colors, DOM-diffed cards, sidebar with merged crew status + department filtering (clickable dept names), pinned sidebar for Manager+ on wide screens, disconnection banner. Show name in navbar. Tab persistence via localStorage |
| Web UI - Editor view | `static/index.html`, `static/js/manage.js`, `static/css/manage.css` | Full: Act-grouped cue list with collapsible headers, drag-and-drop reordering (HTML5 Drag & Drop API with grip handle), inline quick edit (dblclick event delegation), multi-select with bulk ops (floating action bar), visual timeline strip (5Hz playhead, department-colored markers), cue duplicate (TC+5s), act duplicate (with time offset). Department CRUD, Act CRUD, CSV/JSON bulk import |
| Web UI - Settings view | `static/index.html`, `static/js/settings.js` | Full: Source/FPS/mode config, LTC/MTC device selectors, theme customization (live preview), TC size slider, show name editor, show data export/import |
| Web UI - Timeline editor | `static/js/timeline.js`, `static/css/manage.css` | Full: Zoom/pan (cursor-anchored wheel zoom, drag-to-pan), click-to-scrub, minimap with viewport indicator, rich tooltips (label/TC/dept/warn), two-way selection sync with cue list checkboxes |
| Web UI - Branding | `static/index.html`, `static/css/shell.css` | Full: Inline SVG favicon, login/loading logomarks, nav bar horizontal logo (39px), print report logos. All SVGs inlined (offline compatible), system font stack |
| Web UI - UX polish | `static/index.html` | Full: Toast notifications, confirm modals (replaces native confirm), loading overlay with breathing logo, responsive table scroll, 44px touch targets, favicon, DOM diffing for flicker-free cue updates |
| Demo seed data | `src/cue/store.rs` | 6 departments, 3 acts, 22 fully populated cues (cue numbers, notes, durations, colors, continue modes, post_wait, act assignments) from 00:00:10 to 00:08:00 |
| Unit & integration tests | `src/`, `tests/api.rs` | 74 tests: timecode unit tests (34), cue store unit tests (25), REST endpoint integration tests (15) |

### Cue Data Model

| Field | Type | Required | Default |
|-------|------|----------|---------|
| `id` | UUID | No | Auto-generated |
| `department_id` | UUID | **Yes** | -- |
| `cue_number` | String | No | Auto-generated (Q1, Q2, Q3...) |
| `label` | String | No | "Untitled Cue" |
| `trigger_tc` | Timecode (HH:MM:SS:FF) | No | 00:00:00:00 |
| `warn_seconds` | u32 | No | 10 |
| `notes` | String | No | "" |
| `duration` | Option\<u32\> | No | None (point cue) |
| `armed` | bool | No | true |
| `color` | Option\<String\> | No | None (uses department color) |
| `continue_mode` | ContinueMode | No | "stop" |
| `post_wait` | Option\<f64\> | No | None |
| `act_id` | Option\<UUID\> | No | None (ungrouped) |

**ContinueMode** values: `stop`, `auto_continue`, `auto_follow`

### Act Data Model

| Field | Type | Required | Default |
|-------|------|----------|---------|
| `id` | UUID | No | Auto-generated |
| `name` | String | **Yes** | -- |
| `sort_order` | u32 | No | 0 |

### Not Yet Implemented

| Feature | Notes |
|---------|-------|
| Multi-show support | Show switching/archiving |
| Generator presets | Save/load named configs |
| Print view | CSS `@media print` stylesheet for Show tab. Note: an analytical print report is already implemented via `printCueSheet()` in `import-export.js` — this item is specifically about a styled print layout for the live Show view |
| Audio/vibration alerts | Warning threshold alerts on crew devices |

## Codebase Stats

| Category | Lines |
|----------|-------|
| Rust (`src/`) | ~4,820 |
| Rust tests (`tests/`) | ~580 |
| JavaScript (`static/js/`) | ~5,130 |
| CSS (`static/css/`) | ~2,075 |

Frontend JS modules (loaded in order): `state.js` -> `i18n.js` -> `api.js` -> `auth.js` -> `show.js` -> `manage.js` -> `timeline.js` -> `settings.js` -> `import-export.js` -> `ui-helpers.js`

## API Endpoints (46 REST + WS)

| Method | Endpoint | Purpose |
|--------|----------|---------|
| GET | `/api/timecode` | Current timecode + source + status |
| PUT | `/api/timecode/source` | Switch active source (ltc/mtc/generator) |
| GET | `/api/generator` | Generator state and config |
| PUT | `/api/generator` | Update generator config |
| POST | `/api/generator/play` | Start/resume |
| POST | `/api/generator/pause` | Pause |
| POST | `/api/generator/stop` | Stop and reset |
| POST | `/api/generator/goto` | Jump to timecode position |
| GET | `/api/ltc/devices` | List available audio input devices |
| PUT | `/api/ltc/device` | Select and start LTC audio device |
| POST | `/api/ltc/stop` | Stop LTC audio stream |
| GET | `/api/mtc/devices` | List available MIDI input ports |
| PUT | `/api/mtc/device` | Select and start MTC MIDI port |
| POST | `/api/mtc/stop` | Stop MTC MIDI input |
| GET | `/api/departments` | List departments |
| POST | `/api/departments` | Create department |
| PUT | `/api/departments/:id` | Update department |
| DELETE | `/api/departments/:id` | Delete department + its cues |
| GET | `/api/cues` | List cues (optional `?department_id=` filter), sorted by trigger_tc |
| GET | `/api/cues/:id` | Get single cue |
| POST | `/api/cues` | Create cue (only `department_id` required; `cue_number` auto-generated if empty) |
| PUT | `/api/cues/:id` | Update cue |
| DELETE | `/api/cues/:id` | Delete cue |
| POST | `/api/cues/import` | Bulk import cues — `?mode=append` to add, default replaces all (auto-backup before replace) |
| POST | `/api/show/import` | Import full show (departments + cues + acts) — replaces all existing data |
| GET | `/api/show/name` | Get show name |
| PUT | `/api/show/name` | Set show name (Manager+) |
| GET | `/api/acts` | List acts (sorted by sort_order) |
| POST | `/api/acts` | Create act (Operator+) |
| PUT | `/api/acts/:id` | Update act (Operator+) |
| DELETE | `/api/acts/:id` | Delete act (Operator+) — cues unassigned, not deleted |
| POST | `/api/acts/:id/shift` | Shift all cues in act to new start time (Operator+) |
| GET | `/api/server-info` | Server LAN IP, port, and URL (for Settings panel) |
| GET | `/api/qr` | Generate SVG QR code with server LAN URL for crew onboarding |
| GET | `/api/users` | List users (Admin only, PINs stripped) |
| POST | `/api/users` | Create user (Admin only) |
| PUT | `/api/users/:id` | Update user (Admin only) |
| DELETE | `/api/users/:id` | Delete user (Admin only, self-delete blocked) |
| GET | `/api/timer-lock` | Timer lock status (public) |
| POST | `/api/timer-lock` | Acquire timer lock (Manager+, 409 if taken) |
| DELETE | `/api/timer-lock` | Release timer lock (own or Admin override) |
| GET | `/api/auth/status` | Check if auth is enabled |
| POST | `/api/auth/login` | Authenticate with name+PIN, receive Bearer token + role |
| POST | `/api/auth/logout` | Invalidate session token |
| GET | `/ws` | WebSocket endpoint for live countdown data |

## Dependencies

```toml
axum = { version = "0.7", features = ["ws"] }
tokio = { version = "1", features = ["full"] }
serde = { version = "1", features = ["derive"] }
serde_json = "1"
uuid = { version = "1", features = ["v4", "serde"] }
tower-http = { version = "0.5", features = ["cors", "fs", "set-header"] }
tower = { version = "0.5", features = ["util", "limit", "load-shed"] }
tracing = "0.1"
tracing-subscriber = "0.3"
futures = "0.3"
cpal = "0.15"        # Audio input for LTC decoding
midir = "0.10"       # MIDI input for MTC decoding
qrcode = { version = "0.14", default-features = false, features = ["svg"] }
```

## Key Design Decisions

1. **Single binary deployment** - No database, no runtime dependencies. JSON file for persistence.
2. **Watch channels for timecode** - `tokio::sync::watch` provides latest-value semantics perfect for timecode (readers always get the most recent value, no backpressure).
3. **Broadcast channel for WebSocket** - `tokio::sync::broadcast` for fan-out to all connected clients.
4. **Frame-accurate broadcast with caching** - The countdown engine broadcasts at 10Hz for frame-accurate timecode display. Cue states are cached and only recomputed on second boundaries (expensive operation), while timecode strings update every tick (cheap).
5. **Department filtering** - Clients subscribe to specific departments, receiving only relevant cue data. Available in Show view (clickable department names in crew panel) and Editor view (dropdown).
6. **Drop-frame timecode** - Proper 29.97df frame math with correct drop compensation in both directions (to/from total frames).
7. **Auto-seed on empty store** - First launch populates demo data so the app is immediately usable for testing.
8. **Serde defaults on Cue** - Only `department_id` is mandatory; all other fields have sensible defaults for quick cue creation.
9. **Dedicated OS threads for audio/MIDI** - cpal's `Stream` and midir's connection are `!Send`, so they run on their own OS threads with command channels for control.
10. **Per-department cue state tracking** - A cue stays "active" until the next cue in the same department triggers, reflecting real show operations where each department works independently.
11. **Bulk import replaces existing data** - `POST /api/cues/import` clears all existing cues and replaces with the imported set. `importShow()` deletes all departments (cascading to cues) before creating new ones. This ensures a clean slate on every import.
12. **Auto-generated cue numbers** - Cues receive Q1, Q2, Q3... numbers automatically on creation if no custom number is provided, editable afterward.
13. **Uniform card sizing** - All cue cards use identical padding and font sizes regardless of tier/state. Differentiation is color/opacity only (border color, text color, glow). This eliminates layout shifts when cues change state during a live show.
14. **Act grouping with DOM diffing** - Flow view wraps cues in `.act-group` divs with divider headers. Collapsed state preserved across re-renders via `data-act-id` attributes.
15. **Generic CRUD helpers** - `apiSave()` and `apiDelete()` eliminate repeated save/delete patterns across department, cue, act, and user management.
16. **Per-element opacity** - Tier dimming is applied to individual text/countdown elements rather than the whole card, keeping department color bars and dots vivid at all times.

## Build Warnings

The build currently produces 2 harmless warnings about unused assignments in the LTC and MTC shutdown paths. These are structurally correct (the assignment clears the stream/connection before receiving a new one).
