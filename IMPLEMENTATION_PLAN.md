# ShowPulse — Implementation Plan

## Architecture Overview

```
┌─────────────────────────────────────────────────────┐
│                   Host Machine                      │
│                                                     │
│  ┌──────────┐   ┌──────────────┐   ┌────────────┐  │
│  │ SMPTE LTC│──>│              │   │  Frontend   │  │
│  │ (Audio In)│  │   Backend    │──>│  (Static)   │  │
│  └──────────┘   │  (Rust)      │   │  served by  │  │
│  ┌──────────┐   │              │   │  backend    │  │
│  │ MIDI MTC │──>│  WebSocket   │   └─────┬──────┘  │
│  │ (MIDI In)│   │  Server      │         │         │
│  └──────────┘   │              │         │         │
│  ┌──────────┐   │  Internal TC │         │         │
│  │ TC Gen / │──>│  Generator   │         │         │
│  │ Emulator │   │              │         │         │
│  └──────────┘   └──────┬───────┘         │         │
│                        │                 │         │
│                   WebSocket            HTTP         │
│                        │                 │         │
└────────────────────────┼─────────────────┼─────────┘
                         │                 │
                    Local WiFi Network     │
                         │                 │
              ┌──────────▼─────────────────▼──┐
              │   Crew Devices (Browsers)     │
              │   Phone / Tablet / Laptop     │
              └───────────────────────────────┘
```

---

## Phase 1: Project Scaffolding & Timecode Core

### 1.1 Backend — Rust project setup
- **Framework:** Axum (async HTTP + WebSocket support, Tokio-based)
- **Project structure:**
  ```
  showpulse/
  ├── Cargo.toml
  ├── src/
  │   ├── main.rs              # Entry point, server startup
  │   ├── config.rs            # Runtime configuration (port, audio device, MIDI device)
  │   ├── timecode/
  │   │   ├── mod.rs
  │   │   ├── types.rs         # Timecode struct (HH:MM:SS:FF), frame rates
  │   │   ├── ltc.rs           # SMPTE LTC decoder (audio input)
  │   │   ├── mtc.rs           # MIDI MTC decoder (MIDI input)
  │   │   └── generator.rs     # Internal timecode generator/emulator
  │   ├── cue/
  │   │   ├── mod.rs
  │   │   ├── types.rs         # Cue, CueList, Department models
  │   │   └── store.rs         # In-memory cue store + JSON file persistence
  │   ├── engine/
  │   │   ├── mod.rs
  │   │   └── countdown.rs     # Compares current timecode to cue list, computes countdowns
  │   ├── ws/
  │   │   ├── mod.rs
  │   │   └── hub.rs           # WebSocket connection manager, broadcast
  │   ├── api/
  │   │   ├── mod.rs
  │   │   ├── cues.rs          # REST endpoints for cue CRUD
  │   │   ├── departments.rs   # REST endpoints for department management
  │   │   ├── timecode.rs      # REST endpoint for current timecode status
  │   │   └── auth.rs          # Authentication middleware
  │   └── web/                 # Embedded static frontend assets
  └── frontend/               # Frontend source (built separately, output embedded)
  ```

### 1.2 Timecode input
- **SMPTE LTC:** Use `cpal` crate for audio capture. Implement LTC bit decoding from the audio stream (80-bit LTC frame). Parse hours, minutes, seconds, frames.
- **MIDI MTC:** Use `midir` crate for MIDI input. Parse MTC Quarter Frame messages (F1 xx) and Full Frame messages (F0 7F ... F7). Reconstruct full timecode from quarter-frame nibbles.
- **Shared timecode state:** An `Arc<AtomicTimecode>` or `tokio::watch::channel` that all timecode sources write to and the engine reads from. Single source of truth for "current show time."

### 1.3 Timecode Generator / Emulator
A built-in software timecode source that eliminates the need for external LTC/MTC hardware. Essential for rehearsals, programming, testing, and venues without timecode infrastructure.

#### Modes
| Mode | Description |
|------|-------------|
| **Freerun** | Starts from a configurable start time (default `00:00:00:00`), counts up in real-time at the selected frame rate. Behaves like a stopwatch synced to wall clock. |
| **Countdown** | Counts down from a specified duration to `00:00:00:00`, then optionally stops or loops. Useful for intermission timers. |
| **Cue-to-cue jump** | Operator jumps directly to a timecode position (e.g., 5 seconds before a specific cue) for rehearsing individual cues without playing through the entire show. |
| **Clock (time-of-day)** | Uses the system clock as timecode — maps wall-clock HH:MM:SS to timecode HH:MM:SS:00. For shows triggered by real time rather than a timeline. |
| **Loop** | Plays a configurable timecode range on repeat (e.g., `01:00:00:00` to `01:05:00:00`). For rehearsing a specific section. |

#### Generator internals
```rust
struct TimecodeGenerator {
    mode: GeneratorMode,
    frame_rate: FrameRate,       // 24, 25, 29.97df, 30
    state: GeneratorState,       // stopped, running, paused
    start_tc: Timecode,          // starting position
    current_tc: Timecode,        // current position
    loop_in: Option<Timecode>,   // loop start point
    loop_out: Option<Timecode>,  // loop end point
    speed: f64,                  // playback rate (1.0 = realtime, 0.5 = half, 2.0 = double)
}

enum GeneratorMode {
    Freerun,
    Countdown { duration: Timecode },
    ClockSync,
    Loop { start: Timecode, end: Timecode },
}

enum GeneratorState {
    Stopped,
    Running,
    Paused,
}
```

- Runs as a Tokio task, advancing `current_tc` based on elapsed wall-clock time (using `tokio::time::Instant` for drift-free timing).
- Writes to the same shared timecode state as LTC/MTC decoders.
- Frame-accurate: advances exactly one frame per frame period (e.g., 33.33ms at 30fps).
- Variable speed playback for fast-forwarding through a show timeline.

#### Timecode source selection
Only one timecode source is active at a time. Selectable via API and admin UI:
```
Active source: [ LTC ] [ MTC ] [ Generator ]  (radio-button style)
```
When switching sources, the engine seamlessly reads from the new source on the next tick. No restart required.

#### REST API additions
| Method | Endpoint                          | Purpose                              |
|--------|-----------------------------------|--------------------------------------|
| GET    | `/api/generator`                  | Get generator state and config       |
| PUT    | `/api/generator`                  | Update generator config (mode, frame rate, speed, loop points) |
| POST   | `/api/generator/play`             | Start / resume playback              |
| POST   | `/api/generator/pause`            | Pause (hold current TC position)     |
| POST   | `/api/generator/stop`             | Stop and reset to start position     |
| POST   | `/api/generator/goto`             | Jump to a specific timecode position |
| PUT    | `/api/timecode/source`            | Switch active source (ltc / mtc / generator) |

#### Admin UI — Generator Controls
Transport-style controls on the admin page:
- **Play / Pause / Stop** buttons.
- **Timecode position display** — click to edit and jump to a position.
- **Frame rate selector** — dropdown for 24/25/29.97df/30.
- **Speed slider** — 0.25x to 4x, with a "1x" snap detent.
- **Mode selector** — freerun / countdown / clock / loop.
- **Loop in/out** — set range visually or by entering timecode values.
- **Jump-to-cue** — dropdown of all cues; selecting one seeks to `cue.trigger_tc - warn_seconds`.
- **Source selector** — switch between LTC, MTC, and Generator.

### 1.4 Deliverable
- Server starts, opens audio/MIDI device, decodes timecode, logs it to console.
- Internal timecode generator runs independently of hardware.
- `GET /api/timecode` returns current timecode as JSON regardless of source.
- `GET /api/generator` returns generator state.

---

## Phase 2: Cue Management (Backend)

### 2.1 Data model
```rust
struct Department {
    id: Uuid,
    name: String,         // e.g. "Lighting", "Sound", "Pyro"
    color: String,        // hex color for UI
}

struct Cue {
    id: Uuid,
    department_id: Uuid,
    label: String,        // e.g. "LX Cue 42"
    trigger_tc: Timecode, // timecode when this cue fires
    warn_seconds: u32,    // how many seconds before to start countdown (default 30)
    notes: String,
}

struct CueList {
    departments: Vec<Department>,
    cues: Vec<Cue>,       // sorted by trigger_tc
}
```

### 2.2 REST API
| Method | Endpoint                        | Purpose                        |
|--------|---------------------------------|--------------------------------|
| GET    | `/api/departments`              | List all departments           |
| POST   | `/api/departments`              | Create department              |
| PUT    | `/api/departments/:id`          | Update department              |
| DELETE | `/api/departments/:id`          | Delete department + its cues   |
| GET    | `/api/cues`                     | List all cues (filter by dept) |
| GET    | `/api/cues/:id`                 | Get single cue                 |
| POST   | `/api/cues`                     | Create cue                     |
| PUT    | `/api/cues/:id`                 | Update cue                     |
| DELETE | `/api/cues/:id`                 | Delete cue                     |
| POST   | `/api/cues/import`              | Import cues from CSV/JSON file |
| GET    | `/api/timecode`                 | Current timecode + status      |

### 2.3 Persistence
- **JSON file** on disk (`showpulse-data.json`). Loaded at startup, saved on mutation.
- No database dependency — keeps deployment simple for live production environments.
- Optional: support loading/saving named show files.

### 2.4 Deliverable
- Full CRUD for departments and cues via REST API.
- Data persists across restarts.

---

## Phase 3: Countdown Engine & WebSocket Broadcast

### 3.1 Engine loop
- Runs on a dedicated Tokio task at ~30Hz (every ~33ms).
- Each tick:
  1. Read current timecode from the shared state.
  2. For each cue, compute `time_remaining = cue.trigger_tc - current_tc`.
  3. Determine cue state: `upcoming | warning | active | passed`.
  4. Build a per-department message with the relevant cues and countdowns.
  5. Broadcast to connected WebSocket clients (filtered by department subscription).

### 3.2 WebSocket protocol
- **Endpoint:** `ws://host:port/ws`
- **Client subscribes** on connect by sending: `{ "subscribe": ["dept-id-1", "dept-id-2"] }` or `{ "subscribe": "all" }`
- **Server pushes** (every tick or on change):
  ```json
  {
    "timecode": "01:23:45:12",
    "frame_rate": 30,
    "status": "running",
    "cues": [
      {
        "id": "...",
        "department": "Lighting",
        "label": "LX Cue 42",
        "state": "warning",
        "countdown_sec": 12.4,
        "trigger_tc": "01:23:57:00"
      }
    ]
  }
  ```
- **Optimization:** Only send updates when state changes (countdown crosses a second boundary, cue state changes), not every tick.

### 3.3 Deliverable
- WebSocket clients receive live countdown data.
- Countdown accuracy within 1 frame of timecode.

---

## Phase 4: Frontend — Crew View

### 4.1 Tech stack
- **Framework:** Vanilla JS + Web Components, or lightweight (Preact/Solid). No heavy framework — keep bundle small for fast load on crew phones.
- **Styling:** CSS with custom properties for department colors. Dark theme default (typical backstage environment).
- **Build:** Vite. Output is static HTML/JS/CSS embedded into the Rust binary at compile time (`include_dir` or `rust-embed` crate).

### 4.2 Pages / Views

#### Crew Countdown View (`/` or `/#/crew`)
- **Primary display:** Large countdown timer for the next upcoming cue.
- Department selector (dropdown or tabs) to filter which cues to show.
- Color-coded states: green (upcoming, >30s), yellow (warning), red (imminent, <5s), flash on fire.
- Audio/vibration alert when countdown hits warning threshold.
- Auto-reconnect on WebSocket disconnect (with visual indicator).
- Wake-lock API to prevent screen from sleeping during show.

#### Admin / Show Manager View (`/#/admin`)
- Department CRUD (name, color).
- Cue list editor: table view, add/edit/delete cues, drag to reorder.
- CSV/JSON import for cue lists.
- Live timecode display showing current incoming timecode.
- System status: timecode source (LTC/MTC), connection health, connected clients count.
- Protected by authentication (see Security section).

### 4.3 Deliverable
- Crew can open `http://<host>:8080` on their phone and see live countdowns.
- Admin can manage show data from a browser.

---

## Phase 5: Frontend — Admin & Polish

### 5.1 Additional features
- **Multi-show support:** Save/load different show files.
- **Cue list print view:** Printable cue sheet for paper backup.
- **QR code on admin page:** For easy crew onboarding — scan QR to open crew view URL.
- **Generator presets:** Save/load named generator configurations (e.g., "Act 1 rehearsal loop", "Intermission countdown") for quick recall during tech rehearsals.

### 5.2 Deliverable
- Production-ready admin interface.
- Smooth crew onboarding workflow.

---

## Security Plan

### Network-level assumptions
ShowPulse runs on a **local, trusted WiFi network** (production VLAN or dedicated show network). It does NOT face the public internet. Security is designed accordingly — defense-in-depth without the overhead of a full internet-facing app.

### Authentication & Authorization

| Concern | Approach |
|---------|----------|
| **Admin access** | PIN-based authentication. Admin sets a 4-8 digit PIN on first run (stored as bcrypt hash in config). Admin endpoints require the PIN submitted via a login form, which returns a session token (short-lived JWT or opaque token stored in a `HttpOnly` cookie). |
| **Crew access** | No authentication required. Crew view is read-only — it only receives WebSocket data. No mutations possible from crew endpoints. |
| **Session management** | Tokens expire after 8 hours (typical show day). Configurable. |
| **Rate limiting** | Rate-limit the PIN login endpoint (5 attempts per minute per IP) to prevent brute-force. Use `tower` middleware. |

### Input Validation
- All REST inputs validated with `serde` deserialization + explicit validation (timecode format, string lengths, UUID format).
- Reject oversized request bodies (max 1MB).
- Sanitize cue labels/notes to prevent XSS if rendered in HTML (use text content, not innerHTML).

### WebSocket Security
- WebSocket connections are read-only for crew — server pushes data, ignores any unexpected client messages beyond the initial subscribe.
- Connection limit per IP (max 10) to prevent resource exhaustion from a misbehaving device.
- Heartbeat/ping-pong with 30s timeout to clean up stale connections.

### Data Security
- Show data files stored on local disk with standard filesystem permissions.
- No secrets in the show data file — PIN hash stored separately in a config file.
- No telemetry, no external network calls, no phoning home.

### CORS & Headers
- CORS restricted to same-origin (frontend is served by the same backend).
- Standard security headers: `X-Content-Type-Options: nosniff`, `X-Frame-Options: DENY`, `Referrer-Policy: no-referrer`.

### Threat Model Summary
| Threat | Mitigation |
|--------|-----------|
| Unauthorized cue editing | PIN auth on admin endpoints |
| Brute-force PIN | Rate limiting on login |
| XSS via cue data | Input sanitization, CSP headers |
| WebSocket flooding | Per-IP connection limits, heartbeat cleanup |
| Stale sessions | Token expiry (8h) |
| Data loss | JSON file persistence, manual backup/export |
| Network sniffing | Acceptable risk on local production network; optional TLS via self-signed cert for high-security venues |

---

## Tech Stack Summary

| Layer | Technology | Rationale |
|-------|-----------|-----------|
| Backend runtime | **Rust + Tokio** | Low latency, single binary deployment, no runtime deps |
| HTTP framework | **Axum** | First-class WebSocket support, tower middleware ecosystem |
| Audio input | **cpal** | Cross-platform audio capture |
| MIDI input | **midir** | Cross-platform MIDI |
| Serialization | **serde + serde_json** | Standard Rust JSON handling |
| Frontend build | **Vite** | Fast builds, small output |
| Frontend UI | **Preact** or **Solid** | Tiny bundle, reactive updates for countdown timers |
| Static embedding | **rust-embed** | Embed frontend into single binary |
| Auth tokens | **JWT (jsonwebtoken crate)** or opaque tokens | Stateless session validation |

---

## Milestone Sequence

| # | Milestone | Key Result | Status |
|---|-----------|-----------|--------|
| 1 | Timecode core | Server reads LTC/MTC, runs internal TC generator, exposes `/api/timecode` | **Done** |
| 2 | Cue management | CRUD API + JSON persistence working | **Done** |
| 3 | Countdown engine | WebSocket broadcasts live countdowns | **Done** |
| 4 | Crew frontend | Phones display countdowns from WebSocket | **Done** |
| 5 | Admin frontend | Browser-based cue/department management | **Done** |
| 6 | UI/UX polish | 15 UX fixes + 5 user feedback items (sticky TC, Ready/Go, cue numbers, per-dept state) | **Done** |
| 7 | Cue import | Bulk JSON/CSV import with validation, column aliases, dept name resolution | **Done** |
| 8 | Display overhaul | Dominant TC, collapsible transport, DOM diffing, countdown-focused cards | **Done** |
| 9 | Dashboard v2 | 5-section layout, stacked decks, animated Ready/Go zone, cue navigation, Prev/Next, scroll-fold | **Done** |
| 10 | Testing | 71 unit & integration tests for timecode, store, API endpoints | **Done** |
| 10.5 | Cue field expansion | Duration, armed, color, continue_mode, post_wait on Cue | **Done** |
| 11 | Authentication | PIN-based auth, SessionStore, require_auth middleware | **Done** |
| 12 | Security hardening | CORS, body limit, concurrency limit, security headers, input validation | **Done** |
| 13 | Polish & packaging | Multi-show, generator presets, print view, portable dist | Planned |

> **Note:** Milestones 1-12 are fully implemented. The actual implementation uses vanilla HTML/CSS/JS
> (modular files in `static/`) instead of Vite/Preact/Solid as originally planned — this simplifies
> deployment to a true single-binary with no build step. LTC uses `cpal` and MTC uses `midir` as
> specified. See [NEXT_IMPLEMENTATION_PLAN.md](NEXT_IMPLEMENTATION_PLAN.md) for the current roadmap.
