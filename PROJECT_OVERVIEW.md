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
| **Show** | Dominant sticky timecode (8rem default), collapsible transport, Ready/Go countdown, department filter chips, cue cards in stable timecode order (DOM-diffed, no position shifts), passed cues toggle |
| **Manage** | Department CRUD (left panel), cue list table (right panel) with # column, department dropdown filter, sortable column headers, CSV/JSON bulk import, add/edit/delete modals with cue number field |
| **Settings** | Timecode source selector (Generator/LTC/MTC) with device selectors, frame rate, generator mode, speed, start TC, theme colors (live preview), TC size slider, show data export/import JSON |

**Keyboard shortcuts (Show tab):** Space = Play, P = Pause, Escape = Stop, G = Focus goto input

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
| Cue/Department models | `src/cue/types.rs` | Full: Department, Cue (with serde defaults + cue_number), ShowData, CueState, CueStatus, CueImportError, CueImportResult |
| Cue store | `src/cue/store.rs` | Full: In-memory with JSON file persistence, CRUD for departments and cues, bulk import (replaces existing cues) with validation, auto-generated cue numbers (Q1, Q2...), auto-seed on empty store |
| REST API - Timecode | `src/api/timecode.rs` | Full: GET status, PUT source |
| REST API - Generator | `src/api/generator.rs` | Full: GET status, PUT config, POST play/pause/stop/goto |
| REST API - Departments | `src/api/departments.rs` | Full: CRUD (list, create, update, delete) |
| REST API - Cues | `src/api/cues.rs` | Full: CRUD + department filter + bulk import (`POST /api/cues/import`) |
| REST API - LTC | `src/api/ltc.rs` | Full: GET devices, PUT device (select + start), POST stop |
| REST API - MTC | `src/api/mtc.rs` | Full: GET devices, PUT device (select + start), POST stop |
| WebSocket hub | `src/ws/hub.rs` | Full: Broadcast with per-client department filtering, subscribe protocol |
| Countdown engine | `src/engine/countdown.rs` | Full: 10Hz tick, per-department cue state tracking (active until replaced by next dept cue), second-boundary broadcast, 60s passed-cue cleanup |
| Config | `src/config.rs` | Basic: port (8080) + data file path (showpulse-data.json) |
| Server entrypoint | `src/main.rs` | Full: Axum router with all routes, state wiring, seed on startup, static file fallback |
| Web UI - Show view | `static/index.html` | Full: Dominant sticky timecode (8rem), collapsible transport, DOM-diffed cue cards in stable timecode order, cue numbers, Ready/Go countdown, department filters, passed cues toggle, disconnection banner |
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

### Not Yet Implemented

| Feature | Notes |
|---------|-------|
| Unit & integration tests | No test coverage yet |
| Authentication | PIN-based auth, session tokens, rate limiting |
| Multi-show support | Show switching/archiving |
| Security headers/CORS hardening | Production hardening |
| QR code onboarding | For quick crew device setup |

## API Endpoints

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
| PUT | `/api/departments/{id}` | Update department |
| DELETE | `/api/departments/{id}` | Delete department + its cues |
| GET | `/api/cues` | List cues (optional `?department_id=` filter), sorted by trigger_tc |
| GET | `/api/cues/{id}` | Get single cue |
| POST | `/api/cues` | Create cue (only `department_id` required; `cue_number` auto-generated if empty) |
| POST | `/api/cues/import` | Bulk import cues — replaces all existing cues (validates department_id, returns `{imported, errors}`) |
| PUT | `/api/cues/{id}` | Update cue |
| DELETE | `/api/cues/{id}` | Delete cue |
| GET | `/ws` | WebSocket endpoint for live countdown data |

## Dependencies

```toml
axum = { version = "0.7", features = ["ws"] }
tokio = { version = "1", features = ["full"] }
serde = { version = "1", features = ["derive"] }
serde_json = "1"
uuid = { version = "1", features = ["v4", "serde"] }
tower-http = { version = "0.5", features = ["cors", "fs"] }
tracing = "0.1"
tracing-subscriber = "0.3"
futures = "0.3"
cpal = "0.15"        # Audio input for LTC decoding
midir = "0.10"       # MIDI input for MTC decoding
```

## Key Design Decisions

1. **Single binary deployment** - No database, no runtime dependencies. JSON file for persistence.
2. **Watch channels for timecode** - `tokio::sync::watch` provides latest-value semantics perfect for timecode (readers always get the most recent value, no backpressure).
3. **Broadcast channel for WebSocket** - `tokio::sync::broadcast` for fan-out to all connected clients.
4. **Second-boundary optimization** - The countdown engine only broadcasts when the timecode second changes, reducing WebSocket traffic.
5. **Department filtering** - Clients subscribe to specific departments, receiving only relevant cue data. Available in both Show view (filter chips) and Manage view (dropdown).
6. **Drop-frame timecode** - Proper 29.97df frame math with correct drop compensation in both directions (to/from total frames).
7. **Auto-seed on empty store** - First launch populates demo data so the app is immediately usable for testing.
8. **Serde defaults on Cue** - Only `department_id` is mandatory; all other fields have sensible defaults for quick cue creation.
9. **Dedicated OS threads for audio/MIDI** - cpal's `Stream` and midir's connection are `!Send`, so they run on their own OS threads with command channels for control.
10. **Per-department cue state tracking** - A cue stays "active" until the next cue in the same department triggers, reflecting real show operations where each department works independently.
11. **Bulk import replaces existing data** - `POST /api/cues/import` clears all existing cues and replaces with the imported set. `importShow()` deletes all departments (cascading to cues) before creating new ones. This ensures a clean slate on every import.
12. **Auto-generated cue numbers** - Cues receive Q1, Q2, Q3... numbers automatically on creation if no custom number is provided, editable afterward.

## Build Warnings

The build currently produces 2 harmless warnings about unused assignments in the LTC and MTC shutdown paths. These are structurally correct (the assignment clears the stream/connection before receiving a new one).
