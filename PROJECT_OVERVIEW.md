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

On first launch with no data file, the app seeds 6 demo departments and 22 cues automatically.

Dependencies: Rust toolchain + cpal (audio) + midir (MIDI). On Windows, requires Visual Studio Build Tools with C++ workload.

## Frontend (Web UI)

Single-page app served from `static/index.html` with three tabs:

| Tab | Purpose |
|-----|---------|
| **Show** | Clean dashboard: passed cues count badge (click to expand dropdown), active cue strips (compact rows with dept color + checkmark), centered timer with 2-row transport controls (Prev/Play/Pause/Stop/Next + Goto), animated Ready/Go countdown zone (READY stays visible while 3→2→1 digits appear alongside, then GO! with dept name — traffic-light colors, fixed-height layout, pop/flash effects), scrollable coming cues with uniform-size cards (color-only tier differentiation, no layout shifts). Click any cue to load TC into Goto. Prev/Next cue navigation. Above-timer sections collapse on scroll. Frame-accurate timecode display (10Hz). Department filter chips, DOM-diffed cue cards, passed cues toggle |
| **Manage** | Department CRUD (left panel), cue list table (right panel) with # column, department dropdown filter, sortable column headers, CSV/JSON bulk import, add/edit/delete modals with cue number field |
| **Settings** | Timecode source selector (Generator/LTC/MTC) with device selectors, frame rate, generator mode, speed, start TC, theme colors (live preview), TC size slider, show data export/import JSON |

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
| MTC decoder | `src/timecode/mtc.rs` | Full: midir MIDI input, quarter-frame accumulation (8 messages → full TC), full-frame SysEx parsing, frame rate detection. Dedicated OS thread. Port listing and selection API |
| Cue/Department models | `src/cue/types.rs` | Full: Department, Cue (with serde defaults + cue_number + duration/armed/color/continue_mode/post_wait), ContinueMode enum, ShowData, CueState (Upcoming/Warning/Go/Active/Passed), CueStatus (with armed/duration/color/elapsed_sec), CueImportError, CueImportResult |
| Cue store | `src/cue/store.rs` | Full: In-memory with JSON file persistence, CRUD for departments and cues, bulk import (replaces existing cues) with validation, auto-generated cue numbers (Q1, Q2...), input sanitization (string clamping, color validation, post_wait clamping), auto-seed on empty store |
| REST API - Timecode | `src/api/timecode.rs` | Full: GET status, PUT source |
| REST API - Generator | `src/api/generator.rs` | Full: GET status, PUT config, POST play/pause/stop/goto |
| REST API - Departments | `src/api/departments.rs` | Full: CRUD (list, create, update, delete) |
| REST API - Cues | `src/api/cues.rs` | Full: CRUD + department filter + bulk import (`POST /api/cues/import`) |
| REST API - LTC | `src/api/ltc.rs` | Full: GET devices, PUT device (select + start), POST stop |
| REST API - MTC | `src/api/mtc.rs` | Full: GET devices, PUT device (select + start), POST stop |
| WebSocket hub | `src/ws/hub.rs` | Full: Broadcast with per-client department filtering, subscribe protocol |
| Countdown engine | `src/engine/countdown.rs` | Full: 10Hz tick with frame-accurate broadcast, per-department cue state tracking (active until replaced by next dept cue), disarmed cue filtering, duration-based Passed transition, elapsed_sec computation, backend-driven Go state (2s `GO_HOLD_SECONDS` hold before Active), cached cue states with second-boundary recomputation, 60s passed-cue cleanup |
| Config | `src/config.rs` | Full: port, bind_address, data_file, optional PIN — all via env vars (`SHOWPULSE_PORT`, `SHOWPULSE_BIND`, `SHOWPULSE_DATA_FILE`, `SHOWPULSE_PIN`) |
| Authentication | `src/auth.rs` | Full: User-based auth with 5 roles (Viewer→Admin), `SessionStore` mapping tokens→sessions, `require_auth` middleware, `require_role()` + `require_timer_access()` guards, Bearer token or `?token=` query param |
| User management | `src/api/users.rs` | Full: CRUD (Admin only), PINs stripped from list response, self-delete blocked |
| Timer lock | `src/api/timer_lock.rs` | Full: Exclusive timer control — acquire (Manager+, 409 if taken), release, status |
| Server entrypoint | `src/main.rs` | Full: Axum router with 32 API routes + WS, auth middleware, CORS (same-origin), body limit (1MB), concurrency limit (50), security headers, state wiring, user seeding from SHOWPULSE_PIN, seed on startup, static file fallback |
| Web UI - Show view | `static/index.html` | Full: Clean dashboard with passed cues count badge (expandable dropdown), active cue strips (compact dept-colored rows), centered timer with 2-row transport + Prev/Next, animated Ready/Go zone (READY + digit two-element layout, fixed height, traffic-light colors on text+digits+progress bar, GO! with dept name, backend-driven Go state, in-place DOM updates for smooth transitions, progress bar fills 0%→100%), scrollable coming cues with uniform-size cards (color-only tier differentiation). Click-to-goto on cue cards/strips/passed items, Prev/Next cue navigation, scroll-fold collapses above-timer sections. Frame-accurate 10Hz timecode. DOM-diffed cards, department filters, passed cues toggle, disconnection banner |
| Web UI - Manage view | `static/index.html` | Full: Department CRUD, cue table with # column + sortable headers + department filter, bulk CSV/JSON import, add/edit/delete modals with cue number field |
| Web UI - Settings view | `static/index.html` | Full: Source/FPS/mode config, LTC/MTC device selectors, theme customization (live preview), TC size slider, show data export/import |
| Web UI - UX polish | `static/index.html` | Full: Toast notifications, confirm modals (replaces native confirm), loading spinner, responsive table scroll, 44px touch targets, favicon, DOM diffing for flicker-free cue updates |
| Demo seed data | `src/cue/store.rs` | 6 departments (Lighting, Sound, Video, Pyro, Automation, Stage Mgmt) + 22 cues from 00:00:10 to 00:08:00 |

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

**ContinueMode** values: `stop`, `auto_continue`, `auto_follow`

### Completed (Recent)

| Feature | Notes |
|---------|-------|
| Unit & integration tests | 73 tests: Timecode unit tests, CueStore unit tests, REST endpoint integration tests (`tests/api.rs`) |
| User management & roles | `src/auth.rs` — 5 roles (Viewer/CrewLead/Operator/Manager/Admin), user CRUD, timer lock, role-based UI gating. ENV: `SHOWPULSE_PIN` seeds admin user |
| QR code onboarding | `GET /api/qr` — SVG QR code with server URL for crew devices |
| Security hardening | CORS same-origin, body limit (1MB), concurrency limit (50), WS client limit (100), security headers |
| Cue field expansion | Duration, armed/disarmed, per-cue color, continue mode (stop/auto-continue/auto-follow), post-wait |

### Not Yet Implemented

| Feature | Notes |
|---------|-------|
| Multi-show support | Show switching/archiving |
| Generator presets | Save/load named configs |
| Print view | CSS print stylesheet for cue list |
| Portable distribution | Single-folder plug-and-play with embedded static files |

## API Endpoints (32 + WS)

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
| POST | `/api/cues/import` | Bulk import cues — replaces all existing cues (validates department_id, returns `{imported, errors}`) |
| POST | `/api/show/import` | Import full show (departments + cues) — replaces all existing data |
| PUT | `/api/cues/:id` | Update cue |
| DELETE | `/api/cues/:id` | Delete cue |
| GET | `/api/qr` | Generate SVG QR code with server URL for crew onboarding |
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
5. **Department filtering** - Clients subscribe to specific departments, receiving only relevant cue data. Available in both Show view (filter chips) and Manage view (dropdown).
6. **Drop-frame timecode** - Proper 29.97df frame math with correct drop compensation in both directions (to/from total frames).
7. **Auto-seed on empty store** - First launch populates demo data so the app is immediately usable for testing.
8. **Serde defaults on Cue** - Only `department_id` is mandatory; all other fields have sensible defaults for quick cue creation.
9. **Dedicated OS threads for audio/MIDI** - cpal's `Stream` and midir's connection are `!Send`, so they run on their own OS threads with command channels for control.
10. **Per-department cue state tracking** - A cue stays "active" until the next cue in the same department triggers, reflecting real show operations where each department works independently.
11. **Bulk import replaces existing data** - `POST /api/cues/import` clears all existing cues and replaces with the imported set. `importShow()` deletes all departments (cascading to cues) before creating new ones. This ensures a clean slate on every import.
12. **Auto-generated cue numbers** - Cues receive Q1, Q2, Q3... numbers automatically on creation if no custom number is provided, editable afterward.
13. **Uniform card sizing** - All cue cards use identical padding and font sizes regardless of tier/state. Differentiation is color/opacity only (border color, text color, glow). This eliminates layout shifts when cues change state during a live show.

## Build Warnings

The build currently produces 2 harmless warnings about unused assignments in the LTC and MTC shutdown paths. These are structurally correct (the assignment clears the stream/connection before receiving a new one).
