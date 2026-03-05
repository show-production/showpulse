# ShowPulse — Remaining Implementation Plan

## Context
ShowPulse is a self-hosted Rust/Axum live show management platform. The core pipeline works end-to-end (generator → cue engine → WebSocket → browser). What's missing are hardware timecode inputs (LTC/MTC), tests, import, auth, and polish features.

**Repository:** https://github.com/DGProject2030/showpulse

---

## Current Status (What's Done)

| Component | Status |
|-----------|--------|
| Timecode types (24/25/29.97df/30 fps, drop-frame math) | Done |
| Built-in timecode generator (Freerun/Countdown/Clock/Loop) | Done |
| Timecode manager (source switching) | Done |
| Cue & Department data models + JSON persistence | Done |
| 18 REST API endpoints (full CRUD) | Done |
| WebSocket hub with per-department filtering | Done |
| 10Hz countdown engine with cue state computation | Done |
| Frontend: Show view (live countdown cards) | Done |
| Frontend: Manage view (dept + cue CRUD, sorting, filtering) | Done |
| Frontend: Settings (source, frame rate, theme, export/import) | Done |
| Keyboard shortcuts, responsive design, theme persistence | Done |
| Documentation (README, GETTING_STARTED, PROJECT_OVERVIEW) | Done |

---

## Phase 1: LTC Audio Decoding (HIGH PRIORITY)
**Goal:** Receive SMPTE LTC timecode from an audio input device.

**Files to modify:** `Cargo.toml`, `src/timecode/ltc.rs`, `src/timecode/mod.rs`, `src/api/timecode.rs`, `static/index.html`

1. Add `cpal = "0.15"` dependency to Cargo.toml
2. Implement `LtcDecoder` in `src/timecode/ltc.rs`:
   - List available audio input devices via `cpal::default_host()`
   - Spawn audio capture task using cpal's input stream
   - Decode LTC bi-phase signal: detect zero-crossings, extract 80-bit LTC frames
   - Parse timecode from LTC bits (hours/minutes/seconds/frames)
   - Send decoded `Timecode` via the existing `watch::Sender`
3. Add API endpoints for device management:
   - `GET /api/ltc/devices` — list available audio inputs
   - `PUT /api/ltc/device` — select active audio device
4. Update frontend settings panel with audio device selector dropdown

**Technical notes:**
- LTC is a bi-phase modulated audio signal carrying 80-bit frames
- Each frame contains sync word (0x3FFD) + timecode data + user bits
- Must handle varying sample rates (44.1kHz, 48kHz, 96kHz)
- Must handle varying LTC speeds (0.5x–2x playback)

---

## Phase 2: MTC MIDI Decoding (HIGH PRIORITY)
**Goal:** Receive MIDI Time Code from a MIDI input port.

**Files to modify:** `Cargo.toml`, `src/timecode/mtc.rs`, `src/timecode/mod.rs`, `src/api/timecode.rs`, `static/index.html`

1. Add `midir = "0.10"` dependency to Cargo.toml
2. Implement `MtcDecoder` in `src/timecode/mtc.rs`:
   - List available MIDI input ports via `midir::MidiInput`
   - Open selected MIDI port, register callback
   - Parse quarter-frame messages (0xF1): accumulate 8 messages → full TC
   - Parse full-frame SysEx messages for immediate sync
   - Send decoded `Timecode` via the existing `watch::Sender`
3. Add API endpoints:
   - `GET /api/mtc/devices` — list available MIDI inputs
   - `PUT /api/mtc/device` — select active MIDI port
4. Update frontend settings panel with MIDI port selector dropdown

**Technical notes:**
- Quarter-frame messages: 8 messages carry 4 bits each → reconstruct full timecode
- Full-frame SysEx (F0 7F 7F 01 01 hh mm ss ff F7) provides instant sync
- Frame rate encoded in high nibble of hours byte
- Two-frame latency inherent in quarter-frame protocol

---

## Phase 3: Unit & Integration Tests (HIGH PRIORITY)
**Goal:** Establish test coverage for critical logic.

**Files to modify:** `Cargo.toml` (dev-deps), `src/timecode/types.rs`, `src/cue/store.rs`, `src/engine/countdown.rs`, new `tests/api.rs`

1. Add dev-dependencies: `tempfile`, `tower` (for oneshot testing)
2. Unit tests in `src/timecode/types.rs` (`#[cfg(test)]` module):
   - Round-trip: `to_total_frames` ↔ `from_total_frames` for all 4 frame rates
   - Drop-frame edge cases (minute boundaries, 10-minute boundaries)
   - `Timecode::parse` valid/invalid inputs
   - `add_frames` positive/negative/wrapping
   - `to_seconds_f64` / `from_seconds_f64` accuracy
3. Unit tests in `src/cue/store.rs`:
   - CRUD operations (create, read, update, delete)
   - Department cascading delete removes associated cues
   - Cue list sorting by trigger_tc
   - Department filter on list_cues
   - JSON persistence round-trip (write + reload)
4. Integration tests in `tests/api.rs`:
   - Build test app with `Router` + test `AppState`
   - HTTP endpoint tests for departments and cues CRUD
   - Status code assertions (201 Created, 404 Not Found, 204 No Content)

---

## Phase 4: CSV/JSON Cue Import (MEDIUM PRIORITY)
**Goal:** Bulk-import cues from external files.

**Files to modify:** `src/api/cues.rs`, `src/cue/store.rs`, `src/main.rs`, `static/index.html`

1. Add `POST /api/cues/import` endpoint accepting JSON array of cues
2. Validate each cue's `department_id` exists
3. Return `{ imported: N, errors: [...] }` response
4. Add import button in Manage view (file picker for .json)

---

## Phase 5: Authentication (MEDIUM PRIORITY)
**Goal:** PIN-based auth to protect admin operations while keeping crew view open.

**Files to modify:** new `src/auth.rs`, `src/main.rs`, `src/config.rs`, `static/index.html`

1. Add PIN configuration (env var `SHOWPULSE_PIN`, default: no auth)
2. `POST /api/auth` — validate PIN, return session token cookie
3. Axum middleware layer: protect mutation endpoints (POST/PUT/DELETE)
4. Show view (`GET /ws`, `GET /api/*`) remains open — read-only for crew
5. Frontend: PIN prompt modal when accessing Manage/Settings if auth enabled

---

## Phase 6: Security Hardening (MEDIUM PRIORITY)
**Goal:** Production-ready security posture for LAN deployment.

**Files to modify:** `src/main.rs`

1. Add security headers middleware (X-Content-Type-Options, X-Frame-Options)
2. Configure CORS properly for LAN (allow same-origin, restrict external)
3. Input validation on all string fields (max lengths, sanitization)

---

## Phase 7: Nice-to-haves (LOW PRIORITY)

| Feature | Description |
|---------|-------------|
| **Multi-show** | Extend `ShowData` with show name, add show switching API |
| **QR code** | Generate QR with server URL for crew onboarding |
| **Generator presets** | Save/load named configs in data file |
| **Print view** | CSS print stylesheet for cue list |

---

## Verification Checklist

- [ ] `cargo build` — compiles without errors after each phase
- [ ] `cargo test` — all tests pass after Phase 3
- [ ] Manual test: `cargo run` → browser at `http://localhost:8080`
- [ ] LTC: test with LTC audio from a generator app or DAW
- [ ] MTC: test with MIDI loopback or DAW sending MTC
- [ ] Each phase committed and pushed to GitHub

## Commit Strategy
One commit per completed phase, pushed to GitHub after each.
