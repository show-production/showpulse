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
| **LTC Audio Decoding** (Phase 1) | **Done** |

Phase 1 delivered: cpal-based LTC decoder with bi-phase zero-crossing detection,
80-bit frame extraction, BCD parsing, sync word (0x3FFD) detection. Dedicated OS thread
for cpal Stream. API: `GET /api/ltc/devices`, `PUT /api/ltc/device`, `POST /api/ltc/stop`.
Audio device dropdown in Settings UI.

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

## Phase 4: UI/UX Improvements (HIGH PRIORITY)
**Goal:** Address usability, clarity, and safety issues identified in UX review.

**Files to modify:** `static/index.html`

### 4a. Critical UX Fixes

1. **Disconnection banner (safety-critical):**
   - Add a prominent overlay/banner ("Connection Lost — Reconnecting...") when `wsConnected` is false
   - Pulse the timecode display red or dim the Show view when disconnected
   - The current 8px status dot is insufficient for live show use

2. **Keyboard shortcut discoverability:**
   - Add a `?` button or footer hint on the Show tab: `Space: Play | P: Pause | Esc: Stop | G: Goto`
   - First-time users currently have no way to learn shortcuts

3. **Replace native `confirm()` dialogs:**
   - Use the existing modal component for delete confirmations
   - Native `confirm()` is visually jarring on the dark theme and blocks the main thread

### 4b. Clarity Fixes

4. **Rename "Warn" column** to "Lead Time" (or add a tooltip explaining it's the warning lead time in seconds)

5. **Speed field labeling:**
   - Add a suffix label like "1.0x" or convert to a labeled range slider
   - Currently ambiguous — "speed of what?"

6. **Move Export/Import out of Appearance panel:**
   - Create a separate "Data" panel, or place Export/Import below the Timecode panel
   - Show data management is unrelated to theme colors and hard to discover under Appearance

7. **Disable MTC source option (stub only):**
   - Disable the MTC radio button with a "(coming soon)" label until Phase 2 is complete
   - LTC is now fully implemented with device selection

### 4c. Code Quality

8. **Fix `setSource()` implicit event reference:**
   - Pass `event` explicitly instead of relying on implicit `event.target` (line ~1267)
   - Current approach is fragile and may break in strict mode

### 4d. Mobile / Responsive

9. **Cue table horizontal scroll:**
   - Add `overflow-x: auto` on the table container
   - Or switch to a card-based layout on mobile
   - Currently columns compress awkwardly on narrow screens

10. **Increase transport button touch targets:**
    - Minimum 44x44px tap targets on mobile
    - Current 0.85rem / 0.5rem padding is too small for live show use (gloves, low light)

### 4e. Minor Polish

11. **Add loading state:** Show a spinner or skeleton on initial data load
12. **API error handling:** Add toast or inline error feedback when save/delete fails
13. **Passed cues toggle:** Add a "Show passed" toggle to collapse/hide passed cues at 0.4 opacity
14. **Timecode size slider value label:** Show current value (e.g., "5rem") next to the slider
15. **Color picker live preview:** Change `onchange` to `oninput` for live preview while dragging
16. **Add favicon:** Help crew identify ShowPulse among browser tabs

---

## Phase 5: CSV/JSON Cue Import (MEDIUM PRIORITY)
**Goal:** Bulk-import cues from external files.

**Files to modify:** `src/api/cues.rs`, `src/cue/store.rs`, `src/main.rs`, `static/index.html`

1. Add `POST /api/cues/import` endpoint accepting JSON array of cues
2. Validate each cue's `department_id` exists
3. Return `{ imported: N, errors: [...] }` response
4. Add import button in Manage view (file picker for .json)

---

## Phase 6: Authentication (MEDIUM PRIORITY)
**Goal:** PIN-based auth to protect admin operations while keeping crew view open.

**Files to modify:** new `src/auth.rs`, `src/main.rs`, `src/config.rs`, `static/index.html`

1. Add PIN configuration (env var `SHOWPULSE_PIN`, default: no auth)
2. `POST /api/auth` — validate PIN, return session token cookie
3. Axum middleware layer: protect mutation endpoints (POST/PUT/DELETE)
4. Show view (`GET /ws`, `GET /api/*`) remains open — read-only for crew
5. Frontend: PIN prompt modal when accessing Manage/Settings if auth enabled

---

## Phase 7: Security Hardening (MEDIUM PRIORITY)
**Goal:** Production-ready security posture for LAN deployment.

**Files to modify:** `src/main.rs`

1. Add security headers middleware (X-Content-Type-Options, X-Frame-Options)
2. Configure CORS properly for LAN (allow same-origin, restrict external)
3. Input validation on all string fields (max lengths, sanitization)

---

## Phase 8: Nice-to-haves (LOW PRIORITY)

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
