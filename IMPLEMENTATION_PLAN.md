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
  │   │   └── mtc.rs           # MIDI MTC decoder (MIDI input)
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
- **Shared timecode state:** An `Arc<AtomicTimecode>` or `tokio::watch::channel` that both decoders write to and the engine reads from. Single source of truth for "current show time."

### 1.3 Deliverable
- Server starts, opens audio/MIDI device, decodes timecode, logs it to console.
- `GET /api/timecode` returns current timecode as JSON.

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
- **Manual timecode mode:** For rehearsals without timecode hardware, allow manual timecode entry or a built-in clock.

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

| # | Milestone | Key Result |
|---|-----------|-----------|
| 1 | Timecode core | Server reads LTC/MTC, exposes `/api/timecode` |
| 2 | Cue management | CRUD API + JSON persistence working |
| 3 | Countdown engine | WebSocket broadcasts live countdowns |
| 4 | Crew frontend | Phones display countdowns from WebSocket |
| 5 | Admin frontend | Browser-based cue/department management |
| 6 | Security hardening | PIN auth, rate limiting, input validation |
| 7 | Polish & packaging | Single-binary release, QR onboarding, manual TC mode |
