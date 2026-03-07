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
| 25 REST API endpoints (full CRUD + bulk import + auth + QR) | Done |
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
| Show view clarity: passed count badge, active strips, uniform cards | Done |
| Traffic-light Ready/Go colors on text+digits+bar (red→orange→green) | Done |
| Timer vertical layout (meta+timer row, controls row below) | Done |
| Ready/Go two-element layout (READY + digit, fixed height, GO! with dept name) | Done |
| Frame-accurate timecode broadcast (10Hz with cached cue states) | Done |
| Scroll-fold collapses space (max-height:0 transition, not just opacity) | Done |

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

**Phase 7 — Dashboard Layout Overhaul v2:**
1. 5-section vertical layout: stacked passed deck → stacked triggered deck → timer+controls → Ready/Go zone → coming cues
2. Stacked deck containers: cards overlap with negative margins (~8px edge visible), hover to expand, fold on scroll
3. Transport controls split into 2 rows: Prev/Play/Pause/Stop/Next + Goto input below
4. Dedicated animated Ready/Go zone: READY → 3 → 2 → 1 → GO! with CSS pop/shake/flash animations
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
6. Traffic-light Ready/Go countdown colors: red (READY) → red-orange (3) → orange (2) → yellow-green (1) → green (GO!)
7. Timer controls moved below timer in centered row (meta+timer on top, controls below)
8. Scroll-fold collapses above-timer sections (max-height:0 + opacity transition, freeing space)

**Phase 9 — Ready/Go & Broadcast Polish:**
1. Ready/Go two-element countdown: READY label stays visible while 3→2→1 digits appear alongside (both 1.4rem, fixed 2.2rem row height)
2. GO! shows department name: "GO! — Sound" in green, replaces READY label at zero
3. Traffic-light colors on READY text, digits, and progress bar: red (>3s) → orange (3) → yellow (2) → green (1) → green (GO!)
4. Fixed-height countdown row prevents layout shifts during state transitions
5. Frame-accurate timecode: countdown engine broadcasts every 100ms tick (was second-boundary only), cue states cached and recomputed on second change
6. Scroll-fold space collapse: above-timer sections now use max-height:0 + overflow:hidden transition (was opacity-only, leaving dead space)
7. Backend-driven `CueState::Go`: engine emits Go state for 2s after trigger, frontend uses single unified `renderReadyGo()` code path
8. Progress bar fills 0%→100% as cue approaches trigger
9. In-place DOM updates during 3-2-1 countdown preserve CSS transitions (no innerHTML rebuilds)

---

## Phase 10: Unit & Integration Tests ✅ Done
**Goal:** Establish test coverage for critical logic.

73 tests implemented:
- Unit tests in `src/timecode/types.rs`: round-trip frame math, drop-frame edge cases, parse/display, add_frames, to_seconds_f64
- Unit tests in `src/cue/store.rs`: CRUD, cascading delete, sorting, filtering, bulk import, cue numbers, persistence round-trip
- Integration tests in `tests/api.rs`: HTTP endpoint tests for departments and cues CRUD, bulk import, status codes

---

## Phase 10.5: Cue Field Expansion ✅ Done
**Goal:** Align cue model with professional show controller features.

New fields on `Cue`: `duration` (Option\<u32\>), `armed` (bool), `color` (Option\<String\>), `continue_mode` (ContinueMode enum), `post_wait` (Option\<f64\>).
New `ContinueMode` enum: Stop, AutoContinue, AutoFollow.
Updated `CueStatus` broadcast: includes `armed`, `duration`, `color`, `elapsed_sec`.
Countdown engine: filters disarmed cues, duration-based Passed transition, elapsed_sec computation.

---

## Phase 10.6: Backend-Driven Go State + ReadyGo Polish ✅ Done
**Goal:** Fix GO! visual inconsistency and polish ReadyGo rendering.

1. **Backend Go state**: Added `CueState::Go` to state machine. Countdown engine emits `Go` for 2 seconds after trigger (`GO_HOLD_SECONDS`), eliminating frontend race conditions
2. **Progress bar direction**: Fixed to fill 0%→100% (was inverted 100%→0%) in both ReadyGo zone and upcoming flow cards
3. **Traffic-light READY text**: Status text color now follows the same red→orange→yellow→green sequence as digits and progress bar
4. **Smooth DOM transitions**: ReadyGo zone uses in-place DOM updates during 3-2-1 countdown instead of full innerHTML rebuilds, preserving CSS transitions on progress bar
5. **Frontend cleanup**: Removed `renderGoFlash()`, `readygoCueId`, `readygoGoTimer` globals — no longer needed with backend-driven Go state
6. Mock data files updated with all new cue fields (duration, armed, color, continue_mode, post_wait)

---

## Phase 11: Authentication ✅ Done (superseded by Phase 14)
**Goal:** Auth to protect admin operations while keeping crew view open.

Originally PIN-based, now replaced by user-based auth with 5 roles (see Phase 14).
- `require_auth` middleware: skips auth if no users configured, allows GET freely, protects POST/PUT/DELETE
- Token via `Authorization: Bearer <token>` header or `?token=` query param (for WebSocket)
- Endpoints: `GET /api/auth/status`, `POST /api/auth/login`, `POST /api/auth/logout`
- Config: `SHOWPULSE_PIN` env var seeds admin user on first run (unset + no users = open access)

---

## Phase 12: Security Hardening ✅ Mostly Done
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

## Phase 14: User Management & Role-Based Access ✅ Done
**Goal:** Multi-user authentication with 5 permission levels and exclusive timer control.

### Role Hierarchy

| Role | Level | Show | Manage | Settings | Timer Control | User CRUD |
|------|-------|------|--------|----------|---------------|-----------|
| Viewer | 1 | View (filtered to assigned depts) | — | — | — | — |
| Crew Lead | 2 | View (filtered to assigned depts) | — | — | — | — |
| Operator | 3 | View | Full | — | — | — |
| Manager | 4 | View | Full | Full | Yes (must acquire lock) | — |
| Admin | 5 | View | Full | Full | Yes (bypasses lock) | Full |

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
- `SessionStore`: maps tokens → sessions, `open_access` mode for no-user setups
- `require_role()`: extracts session from request extensions, checks minimum role
- `require_timer_access()`: checks Admin or matching timer lock
- Login: `{ name, pin }` → `{ token, role, name, departments }`

**API endpoints:**
- `GET/POST /api/users` — list (Admin, PINs stripped) / create (Admin)
- `PUT/DELETE /api/users/:id` — update / delete (Admin, self-delete blocked)
- `GET/POST/DELETE /api/timer-lock` — status / acquire (Manager+, 409 if taken) / release

**Frontend (`static/js/auth.js`):**
- Login overlay (z-index 310, above loading spinner)
- Role-based tab gating: Viewer/CrewLead → Show only, Operator → +Manage, Manager → +Settings, Admin → +Users panel
- Transport controls hidden for roles below Manager
- Timer lock UI: "Take Control" / "Release" button for Managers
- User management panel in Settings (Admin): list, add, edit, delete users with role + department assignment
- Token persisted to localStorage, auto-login on refresh, 401 → re-show login

**Migration path:**
- `SHOWPULSE_PIN=xxxx` auto-creates admin user named "admin" on first run
- No users configured → open access mode (all endpoints open, no login required)
- `ShowData.users` field uses `#[serde(default)]` for backwards-compatible JSON

---

## Phase 13: Nice-to-haves (LOW PRIORITY)

| Feature | Description | Status |
|---------|-------------|--------|
| **QR code** | Generate QR with server URL for crew onboarding | ✅ Done (`GET /api/qr`) |
| **Multi-show** | Extend `ShowData` with show name, add show switching API | Planned |
| **Generator presets** | Save/load named configs in data file | Planned |
| **Print view** | CSS print stylesheet for cue list | Planned |
| **Wake lock** | Prevent screen sleep on crew devices during show | Planned |
| **Audio/vibration alerts** | Warning threshold alerts on crew devices | Planned |
| **Portable dist** | Embed `static/` into binary, auto-open browser, USB-ready | Planned |

---

## Verification Checklist

- [x] `cargo build` — compiles without errors
- [x] `cargo test` — 73 tests pass
- [x] Manual test: `cargo run` → browser at `http://localhost:8080`
- [x] LTC: test with LTC audio from a generator app or DAW
- [x] MTC: test with MIDI loopback or DAW sending MTC
- [x] CSV import: test with 30-cue show file (`test-import-cues.csv`)
- [x] JSON import: test with 30-cue show file (`test-import-show.json`)
- [x] Each phase committed and pushed to GitHub

## Commit Strategy
One commit per completed feature or phase, pushed to GitHub after each.
