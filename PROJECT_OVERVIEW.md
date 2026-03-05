# ShowPulse - Project Overview & Code Review

## What is ShowPulse?

A self-hosted, local-WiFi show management platform for live productions. It reads SMPTE LTC and MIDI MTC timecode, manages cue lists for multiple departments (lighting, sound, pyro, etc.), and pushes real-time countdown alerts to crew devices via WebSocket-connected browsers.

## Architecture

**Stack:** Rust + Tokio + Axum (HTTP/WebSocket), JSON file persistence, no database.

**Runtime flow:**
1. Timecode sources (LTC/MTC/Generator) write current timecode to `watch` channels
2. `TimecodeManager` provides unified access to the active source
3. Countdown engine (10Hz loop) computes cue states and broadcasts via WebSocket
4. Crew devices receive filtered countdown data per department subscription

```
Timecode Sources --> TimecodeManager --> Countdown Engine --> WsHub --> Crew Browsers
                                              |
                                          CueStore (JSON file)
```

## Current Implementation Status

### Completed (Phases 1 & 2)

| Component | File(s) | Status |
|-----------|---------|--------|
| Timecode types | `src/timecode/types.rs` | Full: Timecode struct, FrameRate enum (24/25/29.97df/30), frame math, drop-frame support, parse/display |
| Timecode generator | `src/timecode/generator.rs` | Full: Freerun, Countdown, Clock (wall-clock sync), Loop modes. Variable speed. Command channel architecture |
| Timecode manager | `src/timecode/mod.rs` | Full: Source switching (LTC/MTC/Generator), unified status API |
| LTC decoder | `src/timecode/ltc.rs` | Stub only - awaiting `cpal` integration |
| MTC decoder | `src/timecode/mtc.rs` | Stub only - awaiting `midir` integration |
| Cue/Department models | `src/cue/types.rs` | Full: Department, Cue, ShowData, CueState, CueStatus |
| Cue store | `src/cue/store.rs` | Full: In-memory with JSON file persistence, CRUD for departments and cues |
| REST API - Timecode | `src/api/timecode.rs` | Full: GET status, PUT source |
| REST API - Generator | `src/api/generator.rs` | Full: GET status, PUT config, POST play/pause/stop/goto |
| REST API - Departments | `src/api/departments.rs` | Full: CRUD (list, create, update, delete) |
| REST API - Cues | `src/api/cues.rs` | Full: CRUD + department filter |
| WebSocket hub | `src/ws/hub.rs` | Full: Broadcast with per-client department filtering, subscribe protocol |
| Countdown engine | `src/engine/countdown.rs` | Full: 10Hz tick, cue state computation, second-boundary broadcast optimization |
| Config | `src/config.rs` | Basic: port + data file path |
| Server entrypoint | `src/main.rs` | Full: Axum router with all routes, state wiring, static file fallback |

### Not Yet Implemented

| Feature | Plan Reference |
|---------|---------------|
| LTC audio decoding | Phase 1.2 - needs `cpal` crate |
| MTC MIDI decoding | Phase 1.2 - needs `midir` crate |
| Frontend (Crew view) | Phase 4 - countdown display, department selector, wake lock |
| Frontend (Admin view) | Phase 5 - cue editor, department CRUD UI, generator controls |
| Authentication | Security Plan - PIN-based auth, session tokens, rate limiting |
| CSV/JSON cue import | Phase 2.2 - `POST /api/cues/import` |
| Multi-show support | Phase 5.1 |
| Security headers/CORS hardening | Security Plan |
| QR code onboarding | Phase 5.1 |

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
| GET | `/api/departments` | List departments |
| POST | `/api/departments` | Create department |
| PUT | `/api/departments/{id}` | Update department |
| DELETE | `/api/departments/{id}` | Delete department + its cues |
| GET | `/api/cues` | List cues (optional `?department_id=` filter) |
| GET | `/api/cues/{id}` | Get single cue |
| POST | `/api/cues` | Create cue |
| PUT | `/api/cues/{id}` | Update cue |
| DELETE | `/api/cues/{id}` | Delete cue |
| GET | `/ws` | WebSocket endpoint for live countdown data |

## Key Design Decisions

1. **Single binary deployment** - No database, no runtime dependencies. JSON file for persistence.
2. **Watch channels for timecode** - `tokio::sync::watch` provides latest-value semantics perfect for timecode (readers always get the most recent value, no backpressure).
3. **Broadcast channel for WebSocket** - `tokio::sync::broadcast` for fan-out to all connected clients.
4. **Second-boundary optimization** - The countdown engine only broadcasts when the timecode second changes, reducing WebSocket traffic.
5. **Department filtering** - Clients subscribe to specific departments, receiving only relevant cue data.
6. **Drop-frame timecode** - Proper 29.97df frame math with correct drop compensation in both directions (to/from total frames).

## Build & Run

```bash
cargo run
# Server starts on http://0.0.0.0:8080
```

Dependencies: Rust toolchain. On Windows, requires Visual Studio Build Tools with C++ workload.

## Warnings

The build currently produces 2 dead-code warnings for `LtcDecoder::start` and `MtcDecoder::start` - these are stub methods that will be called once the audio/MIDI integration is implemented.
