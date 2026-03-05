# ShowPulse — Remaining Implementation Plan

## Context
ShowPulse is a self-hosted Rust/Axum live show management platform. The full pipeline works end-to-end: timecode sources (Generator/LTC/MTC) → countdown engine → WebSocket → crew browsers. All core features, UI/UX polish, and cue import are complete. Remaining work focuses on testing, authentication, security hardening, and nice-to-have features.

**Repository:** https://github.com/DGProject2030/showpulse

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
| Cue numbering (auto-generated Q1/Q2/Q3, editable) | Done |
| 19 REST API endpoints (full CRUD + bulk import) | Done |
| WebSocket hub with per-department filtering | Done |
| 10Hz countdown engine with per-department cue state tracking | Done |
| Frontend: Show view (sticky TC, Ready/Go countdown, cue cards) | Done |
| Frontend: Manage view (dept + cue CRUD, sorting, filtering, CSV/JSON import) | Done |
| Frontend: Settings (source, frame rate, theme, LTC/MTC devices, export/import) | Done |
| UI/UX: Disconnection banner, keyboard hints, confirm modals | Done |
| UI/UX: Toast notifications, loading spinner, passed cues toggle | Done |
| UI/UX: Responsive table scroll, 44px touch targets, favicon | Done |
| UI/UX: Speed suffix, live color preview, TC size slider label | Done |
| Cue state: active until replaced by next same-department cue | Done |
| Ready / 3-2-1 / Go countdown visualization | Done |
| Bulk cue import (JSON + CSV, replaces existing, dept name resolution) | Done |
| Documentation (README, GETTING_STARTED, PROJECT_OVERVIEW, plans) | Done |

### Completed Phases

**Phase 1 — LTC Audio Decoding:** cpal-based decoder with bi-phase zero-crossing detection, 80-bit frame extraction, BCD parsing, sync word (0x3FFD). Dedicated OS thread. API: `GET /api/ltc/devices`, `PUT /api/ltc/device`, `POST /api/ltc/stop`.

**Phase 2 — MTC MIDI Decoding:** midir-based decoder with quarter-frame accumulation (8 messages → full TC), full-frame SysEx parsing. Dedicated OS thread. API: `GET /api/mtc/devices`, `PUT /api/mtc/device`, `POST /api/mtc/stop`.

**Phase 3 — UI/UX Improvements (15 items):** Disconnection banner, keyboard hints, confirm modals replacing native `confirm()`, "Lead Time" column rename, speed suffix, data panel separation, `setSource()` fix, table scroll, touch targets, loading spinner, toast notifications, passed cues toggle, TC size label, live color preview, favicon.

**Phase 4 — CSV/JSON Cue Import:** `POST /api/cues/import` bulk endpoint that replaces all existing cues, department validation, single persist. Frontend CSV parser with column aliases, JSON array/wrapper support, import button in Manage view. `importShow()` deletes all existing departments+cues before importing new ones.

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

---

## Phase 7: Unit & Integration Tests (HIGH PRIORITY)
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
   - Bulk import: valid cues, invalid dept_id, mixed, empty
   - Auto-generated cue numbers (Q1, Q2...)
   - JSON persistence round-trip (write + reload)
4. Integration tests in `tests/api.rs`:
   - Build test app with `Router` + test `AppState`
   - HTTP endpoint tests for departments and cues CRUD
   - Bulk import endpoint tests
   - Status code assertions (201 Created, 404 Not Found, 204 No Content)

---

## Phase 8: Authentication (MEDIUM PRIORITY)
**Goal:** PIN-based auth to protect admin operations while keeping crew view open.

**Files to modify:** new `src/auth.rs`, `src/main.rs`, `src/config.rs`, `static/index.html`

1. Add PIN configuration (env var `SHOWPULSE_PIN`, default: no auth)
2. `POST /api/auth` — validate PIN, return session token cookie
3. Axum middleware layer: protect mutation endpoints (POST/PUT/DELETE)
4. Show view (`GET /ws`, `GET /api/*`) remains open — read-only for crew
5. Frontend: PIN prompt modal when accessing Manage/Settings if auth enabled

---

## Phase 9: Security Hardening (MEDIUM PRIORITY)
**Goal:** Production-ready security posture for LAN deployment.

**Files to modify:** `src/main.rs`

1. Add security headers middleware (X-Content-Type-Options, X-Frame-Options)
2. Configure CORS properly for LAN (allow same-origin, restrict external)
3. Input validation on all string fields (max lengths, sanitization)

---

## Phase 10: Nice-to-haves (LOW PRIORITY)

| Feature | Description |
|---------|-------------|
| **Multi-show** | Extend `ShowData` with show name, add show switching API |
| **QR code** | Generate QR with server URL for crew onboarding |
| **Generator presets** | Save/load named configs in data file |
| **Print view** | CSS print stylesheet for cue list |
| **Wake lock** | Prevent screen sleep on crew devices during show |
| **Audio/vibration alerts** | Warning threshold alerts on crew devices |

---

## Verification Checklist

- [x] `cargo build` — compiles without errors
- [ ] `cargo test` — all tests pass (after Phase 7)
- [x] Manual test: `cargo run` → browser at `http://localhost:8080`
- [x] LTC: test with LTC audio from a generator app or DAW
- [x] MTC: test with MIDI loopback or DAW sending MTC
- [x] CSV import: test with 30-cue show file (`test-import-cues.csv`)
- [x] JSON import: test with 30-cue show file (`test-import-show.json`)
- [x] Each phase committed and pushed to GitHub

## Commit Strategy
One commit per completed feature or phase, pushed to GitHub after each.
